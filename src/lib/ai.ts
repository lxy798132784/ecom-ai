import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function base64ToTempFile(base64: string): string {
  const match = base64.match(/^data:(image\/\w+);base64,/);
  const mime = match ? match[1] : 'image/png';
  const ext = mime.split('/')[1] === 'jpeg' ? 'jpg' : mime.split('/')[1];
  const buf = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const tmp = path.join(os.tmpdir(), `ecom-${Date.now()}.${ext}`);
  fs.writeFileSync(tmp, buf);
  return tmp;
}

export async function removeBackground(imageBase64: string): Promise<string> {
  const tmpPath = base64ToTempFile(imageBase64);
  try {
    const resp = await openai.images.edit({
      model: 'gpt-image-1',
      image: fs.createReadStream(tmpPath) as any,
      prompt: 'Product on pure white background, professional product photography lighting, no shadows, centered, high resolution, remove all background replace with white',
      n: 1,
      size: '1024x1024',
    });
    return resp.data[0]?.url || '';
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

export async function generateLifestyleScene(
  imageBase64: string,
  scene: string,
): Promise<string> {
  const tmpPath = base64ToTempFile(imageBase64);
  try {
    const resp = await openai.images.edit({
      model: 'gpt-image-1',
      image: fs.createReadStream(tmpPath) as any,
      prompt: `Place this product in a beautiful ${scene}. Professional photography, natural lighting, product clearly visible, high resolution, realistic`,
      n: 1,
      size: '1024x1024',
    });
    return resp.data[0]?.url || '';
  } finally {
    fs.unlinkSync(tmpPath);
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
