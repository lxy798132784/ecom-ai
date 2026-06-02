import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { kv } from '@vercel/kv';
import { normalizeEmail, findUserByEmail } from '../../lib/users';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });

  const email = normalizeEmail(String(token.email));
  const key = `history:${email}`;

  if (req.method === 'GET') {
    const month = new Date().toISOString().slice(0, 7);
    const [raw, credits, usage, user] = await Promise.all([
      kv.lrange(key, 0, 199).catch(() => []),
      kv.get<number>(`credits:${email}`).catch(() => 0),
      kv.get<number>(`usage:${email}:${month}`).catch(() => 0),
      findUserByEmail(email).catch(() => undefined),
    ]);
    const plan = user?.plan || (token.plan as string) || 'free';
    const limit = plan === 'pro' ? 500 : 5;
    const history = Array.from(new Set((raw || []).filter(Boolean))).slice(0, 100);
    return res.json({ history, credits: credits || 0, usage: usage || 0, limit, plan });
  }

  if (req.method === 'POST') {
    const { url } = req.body;
    if (url) {
      await kv.lrem(key, 0, url);
      await kv.lpush(key, url);
      await kv.ltrim(key, 0, 99);
    }
    return res.json({ ok: true, history: await kv.lrange(key, 0, 99) });
  }

  if (req.method === 'DELETE') {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: '缺少url' });
    await kv.lrem(key, 0, url);
    return res.json({ ok: true, history: await kv.lrange(key, 0, 99) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
