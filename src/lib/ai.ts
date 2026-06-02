import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { File as NodeFile } from 'buffer';
import sharp from 'sharp';

const IMAGE_MODEL = 'gpt-image-2';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://ai-pixel.online/v1',
});

type ModelProvider = 'openai';

export type ImageQuality = 'auto' | 'low' | 'medium' | 'high';
export type ImageSizeKey = string;

export interface ImageGenerationOptions {
  quality?: ImageQuality;
  size?: ImageSizeKey;
  outputFormat?: 'png' | 'jpeg' | 'webp';
  outputCompression?: number | null;
  moderation?: 'auto' | 'low';
}

const QUALITY_PROMPT: Record<ImageQuality, string> = {
  auto: 'balanced automatic quality, sharp details, clean commercial photography',
  low: 'fast draft quality, clean product composition',
  medium: 'balanced quality, sharp details, commercial e-commerce photography',
  high: 'premium quality, ultra-detailed, polished commercial advertising photography',
};

function normalizeSizeKey(size?: string) {
  const raw = String(size || '').trim();
  if (!raw || raw === 'auto') return { size: 'auto', width: 1024, height: 1024, apiSize: 'auto' as const };
  const m = raw.match(/^(\d+)\s*[xX×]\s*(\d+)$/);
  if (!m) return { size: 'auto', width: 1024, height: 1024, apiSize: 'auto' as const };
  const width = Math.max(16, Math.round(Number(m[1]) / 16) * 16);
  const height = Math.max(16, Math.round(Number(m[2]) / 16) * 16);
  const apiSize = width === height ? '1024x1024' : width > height ? '1536x1024' : '1024x1536';
  return { size: `${width}x${height}`, width, height, apiSize: apiSize as '1024x1024' | '1536x1024' | '1024x1536' | 'auto' };
}

function normalizeOptions(options?: ImageGenerationOptions) {
  const quality: ImageQuality = options?.quality === 'low' || options?.quality === 'medium' || options?.quality === 'high' ? options.quality : 'auto';
  return { quality, ...normalizeSizeKey(options?.size) };
}

async function resizeOutput(url: string, options?: ImageGenerationOptions): Promise<string> {
  const { width, height, quality } = normalizeOptions(options);
  if (options?.size === 'auto') return url;
  try {
    const input = url.startsWith('data:')
      ? Buffer.from(url.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      : Buffer.from(await (await fetch(url)).arrayBuffer());
    const jpegQuality = options?.outputCompression ?? (quality === 'low' ? 78 : quality === 'high' ? 94 : 88);
    const requestedFormat = options?.outputFormat === 'webp' ? 'webp' : options?.outputFormat === 'png' ? 'png' : 'jpeg';
    if (requestedFormat === 'png') {
      const out = await sharp(input).resize(width, height, { fit: 'cover', position: 'centre' }).png().toBuffer();
      return `data:image/png;base64,${out.toString('base64')}`;
    }
    if (requestedFormat === 'webp') {
      const out = await sharp(input).resize(width, height, { fit: 'cover', position: 'centre' }).webp({ quality: jpegQuality }).toBuffer();
      return `data:image/webp;base64,${out.toString('base64')}`;
    }
    const out = await sharp(input).resize(width, height, { fit: 'cover', position: 'centre' }).jpeg({ quality: jpegQuality }).toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch {
    return url;
  }
}

function base64ToFileObject(base64: string): { file: NodeFile; filePath: string } {
  const match = base64.match(/^data:(image\/\w+);base64,/);
  const mimeType = match ? match[1] : 'image/png';
  const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
  const buf = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const filePath = path.join(os.tmpdir(), `ecom-${Date.now()}.${ext}`);
  const file = new NodeFile([buf], path.basename(filePath), { type: mimeType });
  return { file, filePath };
}

function imageDataToUrl(data: any): string {
  return data?.url || (data?.b64_json ? `data:image/png;base64,${data.b64_json}` : '');
}

export async function removeBackground(imageBase64: string, customPrompt?: string, options?: ImageGenerationOptions): Promise<string> {
  const { file, filePath } = base64ToFileObject(imageBase64);
  const extra = customPrompt ? `, ${customPrompt}` : '';
  const opt = normalizeOptions(options);
  const fullPrompt = `Product on pure white background, professional product photography lighting, no shadows, centered, ${QUALITY_PROMPT[opt.quality]}${extra}`;
  try {
    const resp = await openai.images.edit({
      model: IMAGE_MODEL,
      image: file,
      prompt: fullPrompt,
      n: 1,
      size: opt.apiSize,
      quality: opt.quality,
    } as any);
    return resizeOutput(imageDataToUrl(resp.data?.[0]), options);
  } finally { fs.unlink(filePath, () => {}); }
}

export async function generateLifestyleScene(imageBase64: string, scene: string, customPrompt?: string, options?: ImageGenerationOptions): Promise<string> {
  const { file, filePath } = base64ToFileObject(imageBase64);
  const extra = customPrompt ? `, ${customPrompt}` : '';
  const sceneMap: Record<string, string> = {
    kitchen: 'modern kitchen', 'living-room': 'cozy living room',
    bedroom: 'elegant bedroom', office: 'clean home office desk',
    outdoor: 'sunny outdoor garden', bathroom: 'spa bathroom',
    marble: 'luxury marble countertop', 'wooden-table': 'rustic wooden table',
  };
  const opt = normalizeOptions(options);
  const fullPrompt = `Place this product in a beautiful ${sceneMap[scene] || scene}. Professional photography, natural lighting, product clearly visible, realistic, ${QUALITY_PROMPT[opt.quality]}${extra}`;
  try {
    const resp = await openai.images.edit({
      model: IMAGE_MODEL,
      image: file,
      prompt: fullPrompt,
      n: 1,
      size: opt.apiSize,
      quality: opt.quality,
    } as any);
    return resizeOutput(imageDataToUrl(resp.data?.[0]), options);
  } finally { fs.unlink(filePath, () => {}); }
}

export async function customEdit(imageBase64: string, prompt: string, options?: ImageGenerationOptions): Promise<string> {
  const { file, filePath } = base64ToFileObject(imageBase64);
  try {
    const resp = await openai.images.edit({
      model: IMAGE_MODEL,
      image: file,
      prompt: `Transform this product photo: ${prompt}. Professional e-commerce photography, ${QUALITY_PROMPT[normalizeOptions(options).quality]}.`,
      n: 1,
      size: normalizeOptions(options).apiSize,
      quality: normalizeOptions(options).quality,
    } as any);
    return resizeOutput(imageDataToUrl(resp.data?.[0]), options);
  } finally { fs.unlink(filePath, () => {}); }
}

export async function generateProductImage(prompt: string, options?: ImageGenerationOptions): Promise<string> {
  const opt = normalizeOptions(options);
  const resp = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt: `Professional e-commerce product photography, ${prompt}, studio lighting, ${QUALITY_PROMPT[opt.quality]}, white background option`,
    n: 1,
    size: opt.apiSize,
    quality: opt.quality,
  } as any);
  return resizeOutput(imageDataToUrl(resp.data?.[0]), options);
}

export interface DispatchResult {
  url: string;
  provider: ModelProvider;
  model: string;
  cost: number;
  attempts: number;
}

export async function dispatchGeneration(prompt: string, preferredProvider?: ModelProvider, options?: ImageGenerationOptions): Promise<DispatchResult> {
  const url = await generateProductImage(prompt, options);
  if (!url) throw new Error('Image generation returned no image URL');
  return { url, provider: 'openai', model: IMAGE_MODEL, cost: 8, attempts: 1 };
}

export async function dispatchBatch(
  prompt: string, providers?: ModelProvider[], options?: ImageGenerationOptions,
): Promise<DispatchResult> {
  return dispatchGeneration(prompt, 'openai', options);
}
