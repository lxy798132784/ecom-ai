import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { File as NodeFile } from 'buffer';

const SAFEAPI_BASE_URL = process.env.SAFEAPI_BASE_URL || 'https://safeapi.vip/v1';
const SAFEAPI_IMAGE_MODEL = process.env.SAFEAPI_IMAGE_MODEL || 'gpt-image-2';
const SAFEAPI_CHAT_MODEL = process.env.SAFEAPI_CHAT_MODEL || 'gpt-5.4-mini';
const IMAGE_API_KEY = process.env.SAFEAPI_API_KEY || process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: IMAGE_API_KEY,
  baseURL: SAFEAPI_BASE_URL,
});

// ─── 模型定义 ────────────────────────────────
type ModelProvider = 'safeapi';

interface ModelInfo {
  provider: ModelProvider;
  model: string;
  cost: number;       // 相对成本 1-10，1最便宜
  quality: number;    // 质量评分 1-10
  speed: 'fast' | 'medium' | 'slow';
}

const MODELS: Record<ModelProvider, ModelInfo> = {
  safeapi: { provider: 'safeapi', model: SAFEAPI_IMAGE_MODEL, cost: 5, quality: 9, speed: 'medium' },
};

function getModelsByPriority(): ModelInfo[] {
  return Object.values(MODELS).sort((a, b) => a.cost - b.cost);
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

// ─── SafeAPI / OpenAI-compatible image API ─────
export async function removeBackground(imageBase64: string, customPrompt?: string): Promise<string> {
  const { file, filePath } = base64ToFileObject(imageBase64);
  const extra = customPrompt ? `, ${customPrompt}` : '';
  const fullPrompt = `Product on pure white background, professional product photography lighting, no shadows, centered, high resolution${extra}`;
  try {
    const resp = await openai.images.edit({
      model: SAFEAPI_IMAGE_MODEL,
      image: file,
      prompt: fullPrompt,
      n: 1,
    });
    return imageDataToUrl(resp.data?.[0]);
  } finally { fs.unlink(filePath, () => {}); }
}

export async function generateLifestyleScene(imageBase64: string, scene: string, customPrompt?: string): Promise<string> {
  const { file, filePath } = base64ToFileObject(imageBase64);
  const extra = customPrompt ? `, ${customPrompt}` : '';
  const sceneMap: Record<string, string> = {
    kitchen: 'modern kitchen', 'living-room': 'cozy living room',
    bedroom: 'elegant bedroom', office: 'clean home office desk',
    outdoor: 'sunny outdoor garden', bathroom: 'spa bathroom',
    marble: 'luxury marble countertop', 'wooden-table': 'rustic wooden table',
  };
  const fullPrompt = `Place this product in a beautiful ${sceneMap[scene] || scene}. Professional photography, natural lighting, product clearly visible, high resolution, realistic${extra}`;
  try {
    const resp = await openai.images.edit({ model: SAFEAPI_IMAGE_MODEL, image: file, prompt: fullPrompt, n: 1 });
    return imageDataToUrl(resp.data?.[0]);
  } finally { fs.unlink(filePath, () => {}); }
}

export async function customEdit(imageBase64: string, prompt: string): Promise<string> {
  const { file, filePath } = base64ToFileObject(imageBase64);
  try {
    const resp = await openai.images.edit({
      model: SAFEAPI_IMAGE_MODEL,
      image: file,
      prompt: `Transform this product photo: ${prompt}. Professional e-commerce photography, high resolution, commercial quality.`,
      n: 1,
    });
    return imageDataToUrl(resp.data?.[0]);
  } finally { fs.unlink(filePath, () => {}); }
}

export async function generateProductImage(prompt: string): Promise<string> {
  const resp = await openai.images.generate({
    model: SAFEAPI_IMAGE_MODEL,
    prompt: `Professional e-commerce product photography, ${prompt}, studio lighting, high resolution, commercial quality, white background option`,
    n: 1,
    size: '1024x1024',
  });
  return imageDataToUrl(resp.data?.[0]);
}

// ─── 模型调度器：统一走 SafeAPI ───────────────
export interface DispatchResult {
  url: string;
  provider: ModelProvider;
  model: string;
  cost: number;
  attempts: number;
}

export async function dispatchGeneration(prompt: string, preferredProvider?: ModelProvider): Promise<DispatchResult> {
  const info = MODELS.safeapi;
  const url = await generateProductImage(prompt);
  if (!url) throw new Error('SafeAPI image generation returned no image URL');
  return { url, provider: info.provider, model: info.model, cost: info.cost, attempts: 1 };
}

// ─── 批量生成：当前所有模型统一为 SafeAPI，避免并行烧多份费用 ───────
export async function dispatchBatch(
  prompt: string, providers?: ModelProvider[],
): Promise<DispatchResult> {
  return dispatchGeneration(prompt, 'safeapi');
}

export { SAFEAPI_BASE_URL, SAFEAPI_IMAGE_MODEL, SAFEAPI_CHAT_MODEL };
