import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { File as NodeFile } from 'buffer';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── 模型定义 ────────────────────────────────
type ModelProvider = 'openai' | 'zhipu' | 'xiaomi' | 'deepseek' | 'gemini';

interface ModelInfo {
  provider: ModelProvider;
  model: string;
  cost: number;       // 相对成本 1-10，1最便宜
  quality: number;    // 质量评分 1-10
  speed: 'fast' | 'medium' | 'slow';
}

const MODELS: Record<string, ModelInfo> = {
  openai:    { provider: 'openai',   model: 'gpt-image-2',         cost: 8,  quality: 9,  speed: 'medium' },
  openai_v1: { provider: 'openai',   model: 'gpt-image-1',         cost: 6,  quality: 8,  speed: 'fast' },
  zhipu:     { provider: 'zhipu',    model: 'cogview-3',           cost: 2,  quality: 7,  speed: 'fast' },
  xiaomi:    { provider: 'xiaomi',   model: 'mimo-v2-flash',       cost: 1,  quality: 6,  speed: 'fast' },
  deepseek:  { provider: 'deepseek', model: 'deepseek-v4-pro',     cost: 3,  quality: 8,  speed: 'medium' },
  gemini:    { provider: 'gemini',   model: 'gemini-2.5-flash-image', cost: 5, quality: 8, speed: 'fast' },
};

function getModelsByPriority(): ModelInfo[] {
  // 成本优先：便宜的快模型在前，贵的在后
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

// ─── OpenAI ───────────────────────────────────
export async function removeBackground(imageBase64: string, customPrompt?: string): Promise<string> {
  const { file, filePath } = base64ToFileObject(imageBase64);
  const extra = customPrompt ? `, ${customPrompt}` : '';
  const fullPrompt = `Product on pure white background, professional product photography lighting, no shadows, centered, high resolution${extra}`;
  try {
    const resp = await openai.images.edit({
      model: 'gpt-image-1', image: file, prompt: fullPrompt, n: 1,
    });
    const data = resp.data[0];
    return data?.url || (data?.b64_json ? `data:image/png;base64,${data.b64_json}` : '');
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
    const resp = await openai.images.edit({ model: 'gpt-image-1', image: file, prompt: fullPrompt, n: 1 });
    const data = resp.data[0];
    return data?.url || (data?.b64_json ? `data:image/png;base64,${data.b64_json}` : '');
  } finally { fs.unlink(filePath, () => {}); }
}

export async function customEdit(imageBase64: string, prompt: string): Promise<string> {
  const { file, filePath } = base64ToFileObject(imageBase64);
  try {
    const resp = await openai.images.edit({
      model: 'gpt-image-1', image: file,
      prompt: `Transform this product photo: ${prompt}. Professional e-commerce photography, high resolution, commercial quality.`,
      n: 1,
    });
    const data = resp.data[0];
    return data?.url || (data?.b64_json ? `data:image/png;base64,${data.b64_json}` : '');
  } finally { fs.unlink(filePath, () => {}); }
}

export async function generateProductImage(prompt: string): Promise<string> {
  const resp = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: `Professional e-commerce product photography, ${prompt}, studio lighting, high resolution, commercial quality, white background option`,
    n: 1, size: '1024x1024',
  });
  const data = resp.data[0];
  return data?.url || (data?.b64_json ? `data:image/png;base64,${data.b64_json}` : '');
}

// ─── 智谱 ────────────────────────────────────
export async function generateProductImageZhipu(prompt: string): Promise<string> {
  try {
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}` },
      body: JSON.stringify({ model: 'cogview-3', prompt: `Professional e-commerce product photography, ${prompt}, studio lighting, high resolution` }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || 'Zhipu API error');
    return data.data?.[0]?.url || '';
  } catch (e: any) { console.error('Zhipu fallback:', e.message); return ''; }
}

// ─── 小米MiMo ─────────────────────────────────
export async function generateProductImageXiaomi(prompt: string): Promise<string> {
  try {
    const resp = await fetch('https://api.xiaomimimo.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.XIAOMI_API_KEY}` },
      body: JSON.stringify({
        model: 'mimo-v2-flash',
        messages: [{ role: 'user', content: `Generate a professional e-commerce product photo: ${prompt}. Studio lighting, white background, high resolution.` }],
        max_tokens: 500,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || 'Xiaomi API error');
    // Extract image URL from response (format may vary)
    const content = data.choices?.[0]?.message?.content || '';
    const urlMatch = content.match(/https?:\/\/[^\s"'<>]+\.(png|jpg|jpeg|webp)/i);
    return urlMatch ? urlMatch[0] : '';
  } catch (e: any) { console.error('Xiaomi fallback:', e.message); return ''; }
}

// ─── DeepSeek ─────────────────────────────────
export async function generateProductImageDeepSeek(prompt: string): Promise<string> {
  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        messages: [{ role: 'user', content: `Create a professional e-commerce product image: ${prompt}. Studio lighting, white background. Return the image URL.` }],
        max_tokens: 500,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || 'DeepSeek API error');
    const content = data.choices?.[0]?.message?.content || '';
    const urlMatch = content.match(/https?:\/\/[^\s"'<>]+\.(png|jpg|jpeg|webp)/i);
    return urlMatch ? urlMatch[0] : '';
  } catch (e: any) { console.error('DeepSeek fallback:', e.message); return ''; }
}

// ─── Gemini Imagen ────────────────────────────
export async function generateProductImageGemini(prompt: string): Promise<string> {
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Professional e-commerce product photo: ${prompt}. Studio lighting, white background, high resolution commercial quality.` }] }],
        generationConfig: { responseModalities: ['Text', 'Image'] },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || 'Gemini API error');
    // Gemini returns inline image data
    for (const part of data.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
    return '';
  } catch (e: any) { console.error('Gemini fallback:', e.message); return ''; }
}

// ─── 模型调度器 ───────────────────────────────
export interface DispatchResult {
  url: string;
  provider: ModelProvider;
  model: string;
  cost: number;
  attempts: number;
}

export async function dispatchGeneration(prompt: string, preferredProvider?: ModelProvider): Promise<DispatchResult> {
  const models = getModelsByPriority();
  
  // 如果用户指定了provider，把它排到最前面
  if (preferredProvider) {
    const idx = models.findIndex(m => m.provider === preferredProvider);
    if (idx > 0) {
      const [pref] = models.splice(idx, 1);
      models.unshift(pref);
    }
  }

  for (const info of models) {
    try {
      let url = '';
      switch (info.provider) {
        case 'openai':   url = await generateProductImage(prompt); break;
        case 'zhipu':    url = await generateProductImageZhipu(prompt); break;
        case 'xiaomi':   url = await generateProductImageXiaomi(prompt); break;
        case 'deepseek': url = await generateProductImageDeepSeek(prompt); break;
        case 'gemini':   url = await generateProductImageGemini(prompt); break;
      }
      if (url) {
        return { url, provider: info.provider, model: info.model, cost: info.cost, attempts: 1 };
      }
    } catch (e: any) {
      console.warn(`[dispatch] ${info.provider} failed:`, e.message);
    }
  }

  throw new Error('All image generation models failed');
}

// ─── 批量生成（多模型并行，取最快结果）──────
export async function dispatchBatch(
  prompt: string, providers?: ModelProvider[],
): Promise<DispatchResult> {
  const candidates = providers 
    ? providers.map(p => MODELS[p]).filter(Boolean) 
    : getModelsByPriority().slice(0, 3); // 前3个最快的

  const results = await Promise.allSettled(
    candidates.map(async (info) => {
      let url = '';
      switch (info.provider) {
        case 'openai':   url = await generateProductImage(prompt); break;
        case 'zhipu':    url = await generateProductImageZhipu(prompt); break;
        case 'xiaomi':   url = await generateProductImageXiaomi(prompt); break;
        case 'deepseek': url = await generateProductImageDeepSeek(prompt); break;
        case 'gemini':   url = await generateProductImageGemini(prompt); break;
      }
      if (url) return { url, provider: info.provider, model: info.model, cost: info.cost, attempts: 1 } as DispatchResult;
      throw new Error(`${info.provider}: empty result`);
    }),
  );

  for (const r of results) {
    if (r.status === 'fulfilled') return r.value;
  }

  throw new Error('All parallel models failed');
}
