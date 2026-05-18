import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function removeBackground(imageBase64: string): Promise<string> {
  const resp = await openai.images.edit({
    model: 'gpt-image-1',
    image: Buffer.from(imageBase64.split(',')[1] || imageBase64, 'base64'),
    prompt: 'Product on pure white background, professional product photography lighting, no shadows on background, centered, high resolution',
    n: 1,
  });
  return resp.data[0]?.url || '';
}

export async function generateLifestyleScene(
  imageBase64: string,
  scene: string,
): Promise<string> {
  const resp = await openai.images.edit({
    model: 'gpt-image-1',
    image: Buffer.from(imageBase64.split(',')[1] || imageBase64, 'base64'),
    prompt: `Place this product in a beautiful ${scene}. Professional photography, natural lighting, product clearly visible, high resolution, realistic`,
    n: 1,
  });
  return resp.data[0]?.url || '';
}

export async function generateAplusImage(prompt: string): Promise<string> {
  const resp = await openai.images.generate({
    model: 'dall-e-3',
    prompt: `E-commerce product infographic, Amazon A+ content style, clean design, ${prompt}, professional, high quality`,
    n: 1,
    size: '1024x1024',
  });
  return resp.data[0]?.url || '';
}
