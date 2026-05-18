import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { File as NodeFile } from 'buffer';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function base64ToFileObject(base64: string): { file: NodeFile; filePath: string } {
  const match = base64.match(/^data:(image\/\w+);base64,/);
  const mimeType = match ? match[1] : 'image/png';
  const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
  const buf = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const filePath = path.join(os.tmpdir(), `ecom-${Date.now()}.${ext}`);
  const file = new NodeFile([buf], path.basename(filePath), { type: mimeType });
  return { file, filePath };
}

export async function removeBackground(imageBase64: string, customPrompt?: string): Promise<string> {
  const { file, filePath } = base64ToFileObject(imageBase64);
  const extra = customPrompt ? `, ${customPrompt}` : '';
  const fullPrompt = `Product on pure white background, professional product photography lighting, no shadows, centered, high resolution${extra}`;
  try {
    const resp = await openai.images.edit({
      model: 'gpt-image-1',
      image: file,
      prompt: fullPrompt,
      n: 1,
    });
    const data = resp.data[0];
    return data?.url || (data?.b64_json ? `data:image/png;base64,${data.b64_json}` : '');
  } finally {
    fs.unlink(filePath, () => {});
  }
}

export async function generateProductImage(prompt: string): Promise<string> {
  const resp = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: `Professional e-commerce product photography, ${prompt}, studio lighting, high resolution, commercial quality, white background option`,
    n: 1,
    size: '1024x1024',
  });
  const data = resp.data[0];
  return data?.url || (data?.b64_json ? `data:image/png;base64,${data.b64_json}` : '');
}(
  imageBase64: string, scene: string, customPrompt?: string,
): Promise<string> {
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
    const resp = await openai.images.edit({
      model: 'gpt-image-1',
      image: file,
      prompt: fullPrompt,
      n: 1,
    });
    const data = resp.data[0];
    return data?.url || (data?.b64_json ? `data:image/png;base64,${data.b64_json}` : '');
  } finally {
    fs.unlink(filePath, () => {});
  }
}
