import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { kv } from '@vercel/kv';
import { removeBackground, generateLifestyleScene, customEdit, dispatchGeneration, dispatchBatch, ImageGenerationOptions } from '../../lib/ai';
import { normalizeEmail, findUserByEmail } from '../../lib/users';
import { FREE_MONTHLY_POINTS, PRO_MONTHLY_POINTS, calcImagePoints, normalizeQuality, normalizeSize } from '../../lib/pricing';
import { addGalleryImage, itemUrls } from '../../lib/galleryStore';
import sharp from 'sharp';

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

async function checkAvailable(email: string, plan: string, pointsCost: number) {
  const credits = await getCredits(email);
  if (plan === 'pro') {
    const usage = await getUsage(email, 'pro');
    if (usage + pointsCost <= PRO_LIMIT) {
      return { allowed: true, limit: PRO_LIMIT, usage, freeUsage: await getUsage(email, 'free'), proUsage: usage, credits, paidWith: 'pro' as const, plan, pointsCost };
    }
    return { allowed: false, limit: PRO_LIMIT, usage, freeUsage: await getUsage(email, 'free'), proUsage: usage, credits, plan, pointsCost, error: `PRO 积分不足：本次需要 ${pointsCost} 积分，剩余 ${Math.max(0, PRO_LIMIT - usage)} 积分` };
  }

  const freeUsage = await getUsage(email, 'free');
  if (freeUsage + pointsCost <= FREE_LIMIT) {
    return { allowed: true, limit: FREE_LIMIT, usage: freeUsage, freeUsage, proUsage: await getUsage(email, 'pro'), credits, paidWith: 'free' as const, plan, pointsCost };
  }

  if (credits >= pointsCost) {
    return { allowed: true, limit: FREE_LIMIT, usage: freeUsage, freeUsage, proUsage: await getUsage(email, 'pro'), credits, paidWith: 'credit' as const, plan, pointsCost };
  }

  return { allowed: false, limit: FREE_LIMIT, usage: freeUsage, freeUsage, proUsage: await getUsage(email, 'pro'), credits, plan, pointsCost, error: `积分不足：本次需要 ${pointsCost} 积分，免费剩余 ${Math.max(0, FREE_LIMIT - freeUsage)}，升级包剩余 ${credits}` };
}


function dataUrlToBuffer(input: string): Buffer | null {
  const match = String(input || '').match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

async function composeReferenceBoard(primary: string, references: string[] = []): Promise<string> {
  const imgs = Array.from(new Set([primary, ...references].filter(Boolean))).slice(0, 6);
  if (imgs.length <= 1) return primary;
  const buffers = imgs.map(dataUrlToBuffer).filter((x): x is Buffer => Boolean(x));
  if (buffers.length <= 1) return primary;
  const cell = 512;
  const cols = Math.min(3, buffers.length);
  const rows = Math.ceil(buffers.length / cols);
  const composites = await Promise.all(buffers.map(async (buf, idx) => ({
    input: await sharp(buf).resize(cell, cell, { fit: 'inside', background: { r: 15, g: 23, b: 42, alpha: 1 } }).extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 15, g: 23, b: 42, alpha: 1 } }).png().toBuffer(),
    left: (idx % cols) * cell,
    top: Math.floor(idx / cols) * cell,
  })));
  const out = await sharp({ create: { width: cols * cell, height: rows * cell, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } } })
    .composite(composites)
    .png()
    .toBuffer();
  return `data:image/png;base64,${out.toString('base64')}`;
}

async function chargeAfterSuccess(email: string, availability: Awaited<ReturnType<typeof checkAvailable>>) {
  if (!availability.allowed) return availability;
  if (availability.paidWith === 'pro') {
    const next = await kv.incrby(usageKey(email, 'pro'), availability.pointsCost);
    return { ...availability, usage: next, proUsage: next, freeUsage: await getUsage(email, 'free'), credits: await getCredits(email) };
  }
  if (availability.paidWith === 'free') {
    const next = await kv.incrby(usageKey(email, 'free'), availability.pointsCost);
    return { ...availability, usage: next, freeUsage: next, proUsage: await getUsage(email, 'pro'), credits: await getCredits(email) };
  }
  if (availability.paidWith === 'credit') {
    const currentCredits = await getCredits(email);
    const nextCredits = Math.max(0, currentCredits - availability.pointsCost);
    await kv.set(`credits:${email}`, nextCredits);
    const freeUsage = await getUsage(email, 'free');
    return { ...availability, usage: freeUsage, freeUsage, proUsage: await getUsage(email, 'pro'), credits: nextCredits };
  }
  return availability;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });
  const rawEmail = String(token.email);
  const email = normalizeEmail(rawEmail);
  const user = await findUserByEmail(email).catch(() => undefined);
  const plan = user?.plan || (token.plan as string) || 'free';

  let body: any;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  try {
    const { image, action, scene, prompt, model: preferredModel, batch, batchCount } = body;
    const referenceImages = Array.isArray(body.referenceImages) ? body.referenceImages.filter((x: any) => typeof x === 'string') : [];
    const generationOptions: ImageGenerationOptions = { quality: normalizeQuality(body.quality), size: normalizeSize(body.size), outputFormat: body.output_format === 'webp' ? 'webp' : body.output_format === 'jpeg' ? 'jpeg' : 'png', outputCompression: typeof body.output_compression === 'number' ? body.output_compression : null, moderation: body.moderation === 'low' ? 'low' : 'auto' };
    const pointsCost = calcImagePoints(generationOptions.quality, generationOptions.size);

    if (action !== 'text2img' && !image) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const usageCheck = await checkAvailable(email, plan, pointsCost);
    if (!usageCheck.allowed) {
      return res.status(429).json({ error: usageCheck.error, limit: usageCheck.limit, usage: usageCheck.usage, freeUsage: usageCheck.freeUsage, proUsage: usageCheck.proUsage, credits: usageCheck.credits, plan: usageCheck.plan, pointsCost });
    }

    let url = '';
    let meta: any = {};
    const editImage = action === 'text2img' ? '' : await composeReferenceBoard(image, referenceImages);

    if (action === 'text2img') {
      const textPrompt = body.prompt || body.text || scene || 'product photo';
      const result = batch
        ? await dispatchBatch(`${textPrompt}\nGenerate ${Math.min(4, Math.max(1, Number(batchCount || 1)))} distinct strong options in one batch-style request.`, undefined, generationOptions)
        : await dispatchGeneration(textPrompt, preferredModel as any, generationOptions);
      url = result.url;
      meta = { provider: result.provider, model: result.model, cost: result.cost };
    } else if (action === 'custom') {
      url = await customEdit(editImage, prompt || body.customPrompt || 'enhance this image using all visible references consistently', generationOptions);
    } else if (action === 'whitebg') {
      url = await removeBackground(editImage, prompt || '', generationOptions);
    } else if (action === 'scene') {
      if (!scene) return res.status(400).json({ error: 'Scene required' });
      url = await generateLifestyleScene(editImage, scene, prompt || '', generationOptions);
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    if (!url) return res.status(500).json({ error: 'AI returned no image URL' });

    let saved;
    try {
      saved = await addGalleryImage(email, rawEmail, 'history', url, {
        source: 'generation',
        prompt: prompt || body.text || scene || '',
        action,
        model: meta.model,
        provider: meta.provider,
        quality: generationOptions.quality,
        size: generationOptions.size,
        outputFormat: generationOptions.outputFormat,
        referenceCount: referenceImages.length + (image ? 1 : 0),
      });
    } catch (e: any) {
      console.error('history write failed', e);
      return res.status(500).json({ error: '历史图片保存失败，请稍后重试；本次不会重复扣积分' });
    }

    const storedUrl = saved.url;
    const savedHistory = itemUrls(saved.items);

    const charged = await chargeAfterSuccess(email, usageCheck);

    return res.json({ url: storedUrl, history: savedHistory, historyItems: saved.items, historySaved: savedHistory.includes(storedUrl), usage: charged.usage, limit: charged.limit, freeUsage: charged.freeUsage, proUsage: charged.proUsage, credits: charged.credits, paidWith: charged.paidWith, plan: charged.plan, pointsCost, quality: generationOptions.quality, size: generationOptions.size, chargedAfterSuccess: true, storedImage: storedUrl !== url, ...meta });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Generation failed' });
  }
}
