import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { kv } from '@vercel/kv';
import { removeBackground, generateLifestyleScene, generateProductImage, customEdit } from '../../lib/ai';

export const config = { api: { bodyParser: { sizeLimit: '50mb' }, maxDuration: 60 } };

const FREE_LIMIT = 5;
const PRO_LIMIT = 500;

async function getUsageKey(email: string) {
  const month = new Date().toISOString().slice(0, 7);
  return `usage:${email}:${month}`;
}

async function getUsage(email: string): Promise<number> {
  try { return (await kv.get<number>(await getUsageKey(email))) || 0; } catch { return 0; }
}

async function checkAndIncrement(email: string, plan: string) {
  const usage = await getUsage(email);
  const limit = plan === 'pro' ? PRO_LIMIT : FREE_LIMIT;
  if (usage >= limit) {
    return { allowed: false, limit, usage, error: `${plan === 'pro' ? 'PRO' : '免费'}额度已用完（${limit} 次/月）` };
  }
  await kv.incr(await getUsageKey(email));
  return { allowed: true, limit, usage: usage + 1 };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });
  const plan = (token.plan as string) || 'free';

  let body: any;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  try {
    const { image, action, scene, prompt } = body;

    if (action === 'text2img') {
      // Text-to-image doesn't need uploaded image
    } else if (!image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Check usage
    const usageCheck = await checkAndIncrement(token.email!, plan);
    if (!usageCheck.allowed) {
      return res.status(429).json({ error: usageCheck.error, limit: usageCheck.limit, usage: usageCheck.usage });
    }

    let url = '';
    if (action === 'text2img') {
      const textPrompt = body.prompt || body.text || scene || 'product photo';
      url = await generateProductImage(textPrompt);
    } else if (action === 'custom') {
      url = await customEdit(image, prompt || body.customPrompt || 'enhance this product photo');
    } else if (action === 'whitebg') {
      url = await removeBackground(image, prompt || '');
    } else if (action === 'scene') {
      if (!scene) return res.status(400).json({ error: 'Scene required' });
      url = await generateLifestyleScene(image, scene, prompt || '');
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    if (!url) return res.status(500).json({ error: 'AI returned no image URL' });
    return res.json({ url, usage: usageCheck.usage, limit: usageCheck.limit });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Generation failed' });
  }
}
