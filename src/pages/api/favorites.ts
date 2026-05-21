import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { kv } from '@vercel/kv';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });

  const key = `fav:${token.email}`;

  if (req.method === 'GET') {
    const favs = (await kv.lrange(key, 0, 99)) || [];
    return res.json({ favorites: favs });
  }

  if (req.method === 'POST') {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: '缺少url' });
    const existing = await kv.lrange(key, 0, 99);
    if (existing.includes(url)) {
      await kv.lrem(key, 0, url);
      return res.json({ ok: true, added: false, favorites: await kv.lrange(key, 0, 99) });
    }
    await kv.lpush(key, url);
    return res.json({ ok: true, added: true, favorites: await kv.lrange(key, 0, 99) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
