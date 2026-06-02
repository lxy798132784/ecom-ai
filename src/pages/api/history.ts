import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { kv } from '@vercel/kv';
import { normalizeEmail, findUserByEmail } from '../../lib/users';

async function replaceList(key: string, items: string[]) {
  await kv.del(key);
  if (items.length) await kv.rpush(key, ...items);
}

function cleanList(items: unknown[]): string[] {
  return Array.from(new Set((items || []).map(x => String(x || '')).filter(Boolean)));
}

async function getDeleted(keys: string[]): Promise<Set<string>> {
  const deleted = cleanList((await Promise.all(keys.map(k => kv.smembers(k).catch(() => [])))).flat());
  return new Set(deleted);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });

  const rawEmail = String(token.email);
  const email = normalizeEmail(rawEmail);
  const keys = Array.from(new Set([`history:${email}`, `history:${rawEmail}`]));
  const deletedKeys = Array.from(new Set([`deleted:history:${email}`, `deleted:history:${rawEmail}`]));
  const key = `history:${email}`;

  if (req.method === 'GET') {
    const month = new Date().toISOString().slice(0, 7);
    const [raw, credits, usage, user] = await Promise.all([
      Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => []))).then(parts => parts.flat()),
      kv.get<number>(`credits:${email}`).catch(() => 0),
      kv.get<number>(`usage:${email}:${month}`).catch(() => 0),
      findUserByEmail(email).catch(() => undefined),
    ]);
    const plan = user?.plan || (token.plan as string) || 'free';
    const limit = plan === 'pro' ? 1000 : 5;
    const deleted = await getDeleted(deletedKeys);
    const history = cleanList(raw || []).filter(url => !deleted.has(url)).slice(0, 100);
    return res.json({ history, credits: credits || 0, usage: usage || 0, limit, plan });
  }

  if (req.method === 'POST') {
    const { url } = req.body;
    if (url) {
      const target = String(url);
      await Promise.all(deletedKeys.map(k => kv.srem(k, target).catch(() => 0)));
      const existing = cleanList(await kv.lrange(key, 0, 199).catch(() => []));
      const next = [target, ...existing.filter(x => x !== target)].slice(0, 100);
      await replaceList(key, next);
    }
    return res.json({ ok: true, history: await kv.lrange(key, 0, 99) });
  }

  if (req.method === 'DELETE') {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: '缺少url' });
    const target = String(url);
    await Promise.all([
      ...keys.map(async k => {
        const existing = cleanList(await kv.lrange(k, 0, 199).catch(() => []));
        const next = existing.filter(x => x !== target);
        await replaceList(k, next);
      }),
      ...deletedKeys.map(k => kv.sadd(k, target).catch(() => 0)),
    ]);
    const deleted = await getDeleted(deletedKeys);
    const merged = cleanList((await Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat()).filter(url => !deleted.has(url)).slice(0, 100);
    return res.json({ ok: true, deleted: true, history: merged });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
