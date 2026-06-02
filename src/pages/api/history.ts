import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { kv } from '@vercel/kv';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });

  const key = `history:${token.email}`;

  if (req.method === 'GET') {
    const raw = (await kv.lrange(key, 0, 49)) || [];
    const history = Array.from(new Set(raw.filter(Boolean))).slice(0, 20);
    const credits = (await kv.get<number>(`credits:${token.email}`)) || 0;
    return res.json({ history, credits });
  }

  if (req.method === 'POST') {
    const { url } = req.body;
    if (url) {
      await kv.lrem(key, 0, url);
      await kv.lpush(key, url);
      await kv.ltrim(key, 0, 19);
    }
    return res.json({ ok: true, history: await kv.lrange(key, 0, 19) });
  }

  if (req.method === 'DELETE') {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: '缺少url' });
    await kv.lrem(key, 0, url);
    return res.json({ ok: true, history: await kv.lrange(key, 0, 19) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
