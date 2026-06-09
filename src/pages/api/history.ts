import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

import { normalizeEmail, findUserByEmail } from '../../lib/users';
import { addGalleryImage, getGalleryItems, itemUrls, removeGalleryImage } from '../../lib/galleryStore';

const FREE_LIMIT = 10;
const PRO_LIMIT = 2000;

function currentMonth() { return new Date().toISOString().slice(0, 7); }
function usageKey(email: string, bucket: 'free' | 'pro', month = currentMonth()) { return `usage:${bucket}:${email}:${month}`; }
async function getNumber(key: string): Promise<number> {
  const { kv } = await import('@vercel/kv');
  try { return Number((await kv.get<number>(key)) || 0); } catch { return 0; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });

  const rawEmail = String(token.email);
  const email = normalizeEmail(rawEmail);

  if (req.method === 'GET') {
    const month = currentMonth();
    const [items, credits, freeUsage, proUsage, user] = await Promise.all([
      getGalleryItems(email, 'history'),
      getNumber(`credits:${email}`),
      getNumber(usageKey(email, 'free', month)),
      getNumber(usageKey(email, 'pro', month)),
      findUserByEmail(email).catch(() => undefined),
    ]);
    const plan = user?.plan || (token.plan as string) || 'free';
    const limit = plan === 'pro' ? PRO_LIMIT : FREE_LIMIT;
    const usage = plan === 'pro' ? proUsage : freeUsage;
    return res.json({ history: itemUrls(items), items, credits, usage, limit, plan, freeUsage, proUsage, totalPoints: Math.max(0, limit - usage) + credits });
  }

  if (req.method === 'POST') {
    const { url, ...meta } = req.body || {};
    if (!url) return res.status(400).json({ error: '缺少url' });
    const saved = await addGalleryImage(email, rawEmail, 'history', String(url), meta || {});
    return res.json({ ok: true, history: itemUrls(saved.items), items: saved.items, url: saved.url, id: saved.id });
  }

  if (req.method === 'DELETE') {
    const { url, id } = req.body || {};
    if (!url && !id) return res.status(400).json({ error: '缺少图片ID' });
    const items = await removeGalleryImage(email, rawEmail, 'history', String(url || ''), String(id || ''));
    return res.json({ ok: true, deleted: true, history: itemUrls(items), items });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
