import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { kv } from '@vercel/kv';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });

  if (req.method === 'GET') {
    const history = (await kv.lrange(`history:${token.email}`, 0, 19)) || [];
    const credits = (await kv.get<number>(`credits:${token.email}`)) || 0;
    return res.json({ history, credits });
  }

  if (req.method === 'POST') {
    const { url } = req.body;
    if (url) {
      await kv.lpush(`history:${token.email}`, url);
      await kv.ltrim(`history:${token.email}`, 0, 19);
    }
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
