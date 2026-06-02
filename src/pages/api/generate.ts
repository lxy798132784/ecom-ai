import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { removeBackground, generateLifestyleScene, customEdit, dispatchGeneration, dispatchBatch, ImageGenerationOptions } from '../../lib/ai';
import { normalizeEmail, findUserByEmail } from '../../lib/users';
import { FREE_MONTHLY_POINTS, PRO_MONTHLY_POINTS, calcImagePoints, normalizeQuality, normalizeSize } from '../../lib/pricing';

export const config = { api: { bodyParser: { sizeLimit: '50mb' }, maxDuration: 60 } };

const FREE_LIMIT = FREE_MONTHLY_POINTS;
const PRO_LIMIT = PRO_MONTHLY_POINTS;

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function usageKey(email: string, bucket: 'free' | 'pro', month = currentMonth()) {
  return `usage:${bucket}:${email}:${month}`;
}

async function getNumber(key: string): Promise<number> {
  try { return Number((await kv.get<number>(key)) || 0); } catch { return 0; }
}

async function getUsage(email: string, bucket: 'free' | 'pro'): Promise<number> {
  return getNumber(usageKey(email, bucket));
}

async function getCredits(email: string): Promise<number> {
  return getNumber(`credits:${email}`);
}

async function checkAndIncrement(email: string, plan: string, pointsCost: number) {
  const credits = await getCredits(email);
  if (plan === 'pro') {
    const usage = await getUsage(email, 'pro');
    if (usage + pointsCost <= PRO_LIMIT) {
      await kv.incrby(usageKey(email, 'pro'), pointsCost);
      return { allowed: true, limit: PRO_LIMIT, usage: usage + pointsCost, freeUsage: await getUsage(email, 'free'), proUsage: usage + pointsCost, credits, paidWith: 'pro' as const, plan, pointsCost };
    }
    return { allowed: false, limit: PRO_LIMIT, usage, freeUsage: await getUsage(email, 'free'), proUsage: usage, credits, plan, pointsCost, error: `PRO 积分不足：本次需要 ${pointsCost} 积分，剩余 ${Math.max(0, PRO_LIMIT - usage)} 积分` };
  }

  const freeUsage = await getUsage(email, 'free');
  if (freeUsage + pointsCost <= FREE_LIMIT) {
    await kv.incrby(usageKey(email, 'free'), pointsCost);
    return { allowed: true, limit: FREE_LIMIT, usage: freeUsage + pointsCost, freeUsage: freeUsage + pointsCost, proUsage: await getUsage(email, 'pro'), credits, paidWith: 'free' as const, plan, pointsCost };
  }

  if (credits >= pointsCost) {
    const nextCredits = Math.max(0, credits - pointsCost);
    await kv.set(`credits:${email}`, nextCredits);
    return { allowed: true, limit: FREE_LIMIT, usage: freeUsage, freeUsage, proUsage: await getUsage(email, 'pro'), credits: nextCredits, paidWith: 'credit' as const, plan, pointsCost };
  }

  return { allowed: false, limit: FREE_LIMIT, usage: freeUsage, freeUsage, proUsage: await getUsage(email, 'pro'), credits, plan, pointsCost, error: `积分不足：本次需要 ${pointsCost} 积分，免费剩余 ${Math.max(0, FREE_LIMIT - freeUsage)}，升级包剩余 ${credits}` };
}

function imageId(url: string) {
  const canonical = String(url || '').trim().split('#')[0].split('?')[0];
  return crypto.createHash('sha256').update(canonical || String(url || '')).digest('hex');
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
    const generationOptions: ImageGenerationOptions = { quality: normalizeQuality(body.quality), size: normalizeSize(body.size) };
    const pointsCost = calcImagePoints(generationOptions.quality, generationOptions.size);

    if (action !== 'text2img' && !image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const usageCheck = await checkAndIncrement(email, plan, pointsCost);
    if (!usageCheck.allowed) {
      return res.status(429).json({ error: usageCheck.error, limit: usageCheck.limit, usage: usageCheck.usage, freeUsage: usageCheck.freeUsage, proUsage: usageCheck.proUsage, credits: usageCheck.credits, plan: usageCheck.plan, pointsCost });
    }

    let url = '';
    let meta: any = {};

    if (action === 'text2img') {
      const textPrompt = body.prompt || body.text || scene || 'product photo';
      const result = batch
        ? await dispatchBatch(textPrompt, undefined, generationOptions)
        : await dispatchGeneration(textPrompt, preferredModel as any, generationOptions);
      url = result.url;
      meta = { provider: result.provider, model: result.model, cost: result.cost };
    } else if (action === 'custom') {
      url = await customEdit(image, prompt || body.customPrompt || 'enhance this product photo', generationOptions);
    } else if (action === 'whitebg') {
      url = await removeBackground(image, prompt || '', generationOptions);
    } else if (action === 'scene') {
      if (!scene) return res.status(400).json({ error: 'Scene required' });
      url = await generateLifestyleScene(image, scene, prompt || '', generationOptions);
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    if (!url) return res.status(500).json({ error: 'AI returned no image URL' });

    // 自动保存到用户历史：先去重再置顶，避免前端刷新或重复写入出现两张相同历史图。
    try {
      const historyKey = `history:${email}`;
      const deletedKeys = [`deleted:history:${email}`, `deleted:history-id:${email}`];
      await Promise.all([kv.srem(deletedKeys[0], url).catch(() => 0), kv.srem(deletedKeys[1], imageId(url)).catch(() => 0)]);
      await kv.lrem(historyKey, 0, url);
      await kv.lpush(historyKey, url);
      await kv.ltrim(historyKey, 0, 99);
    } catch {}

    return res.json({ url, usage: usageCheck.usage, limit: usageCheck.limit, freeUsage: usageCheck.freeUsage, proUsage: usageCheck.proUsage, credits: usageCheck.credits, paidWith: usageCheck.paidWith, plan: usageCheck.plan, pointsCost, quality: generationOptions.quality, size: generationOptions.size, ...meta });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Generation failed' });
  }
}
