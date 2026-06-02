import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { kv } from '@vercel/kv';
import { removeBackground, generateLifestyleScene, customEdit, dispatchGeneration, dispatchBatch } from '../../lib/ai';
import { normalizeEmail, findUserByEmail } from '../../lib/users';

export const config = { api: { bodyParser: { sizeLimit: '50mb' }, maxDuration: 60 } };

const FREE_LIMIT = 5;
const PRO_LIMIT = 1000;

async function getUsageKey(email: string) {
  const month = new Date().toISOString().slice(0, 7);
  return `usage:${email}:${month}`;
}

async function getUsage(email: string): Promise<number> {
  try { return (await kv.get<number>(await getUsageKey(email))) || 0; } catch { return 0; }
}

async function getCredits(email: string): Promise<number> {
  try { return (await kv.get<number>(`credits:${email}`)) || 0; } catch { return 0; }
}

async function checkAndIncrement(email: string, plan: string) {
  const usageKey = await getUsageKey(email);
  const usage = await getUsage(email);
  const limit = plan === 'pro' ? PRO_LIMIT : FREE_LIMIT;

  if (usage < limit) {
    await kv.incr(usageKey);
    return { allowed: true, limit, usage: usage + 1, credits: await getCredits(email), paidWith: 'monthly' as const, plan };
  }

  if (plan !== 'pro') {
    const credits = await getCredits(email);
    if (credits > 0) {
      const nextCredits = Math.max(0, credits - 1);
      await kv.set(`credits:${email}`, nextCredits);
      return { allowed: true, limit, usage, credits: nextCredits, paidWith: 'credit' as const, plan };
    }
  }

  return { allowed: false, limit, usage, credits: await getCredits(email), plan, error: `${plan === 'pro' ? 'PRO' : '免费'}额度已用完（${limit} 次/月）` };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });
  const email = normalizeEmail(String(token.email));
  const user = await findUserByEmail(email).catch(() => undefined);
  const plan = user?.plan || (token.plan as string) || 'free';

  let body: any;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  try {
    const { image, action, scene, prompt, model: preferredModel, batch } = body;

    if (action !== 'text2img' && !image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const usageCheck = await checkAndIncrement(email, plan);
    if (!usageCheck.allowed) {
      return res.status(429).json({ error: usageCheck.error, limit: usageCheck.limit, usage: usageCheck.usage, credits: usageCheck.credits });
    }

    let url = '';
    let meta: any = {};

    if (action === 'text2img') {
      const textPrompt = body.prompt || body.text || scene || 'product photo';
      const result = batch
        ? await dispatchBatch(textPrompt)
        : await dispatchGeneration(textPrompt, preferredModel as any);
      url = result.url;
      meta = { provider: result.provider, model: result.model, cost: result.cost };
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

    // 自动保存到用户历史：先去重再置顶，避免前端刷新或重复写入出现两张相同历史图。
    try {
      const historyKey = `history:${email}`;
      await kv.lrem(historyKey, 0, url);
      await kv.lpush(historyKey, url);
      await kv.ltrim(historyKey, 0, 99);
    } catch {}

    return res.json({ url, usage: usageCheck.usage, limit: usageCheck.limit, credits: usageCheck.credits, paidWith: usageCheck.paidWith, ...meta });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Generation failed' });
  }
}
