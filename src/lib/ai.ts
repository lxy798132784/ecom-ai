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

export async function removeBackground(imageBase64: string): Promise<string> {
  const { file, filePath } = base64ToFileObject(imageBase64);
  try {
    const resp = await openai.images.edit({
      model: 'gpt-image-1',
      image: file,
      prompt: 'Product on pure white background, professional product photography lighting, no shadows, centered, high resolution',
      n: 1,
    });
    return resp.data[0]?.url || '';
  } finally {
    // cleanup temp if needed
    fs.unlink(filePath, () => {});
  }
}

export async function generateLifestyleScene(
  imageBase64: string,
  scene: string,
): Promise<string> {
  const { file, filePath } = base64ToFileObject(imageBase64);
  try {
    const resp = await openai.images.edit({
      model: 'gpt-image-1',
      image: file,
      prompt: `Place this product in a beautiful ${scene}. Professional photography, natural lighting, product clearly visible, high resolution, realistic`,
      n: 1,
    });
    return resp.data[0]?.url || '';
  } finally {
    fs.unlink(filePath, () => {});
  }
}

export async function generateAplusImage(prompt: string): Promise<string> {
  const resp = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: `E-commerce product infographic, Amazon A+ content style, clean design, ${prompt}, professional, high quality`,
    n: 1,
    size: '1024x1024',
  });
  return resp.data[0]?.url || '';
}
