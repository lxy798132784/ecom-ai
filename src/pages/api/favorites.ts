import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { kv } from '@vercel/kv';
import { normalizeEmail } from '../../lib/users';

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
  const keys = Array.from(new Set([`fav:${email}`, `fav:${rawEmail}`, `favorites:${email}`, `favorites:${rawEmail}`]));
  const deletedKeys = Array.from(new Set([`deleted:fav:${email}`, `deleted:fav:${rawEmail}`, `deleted:favorites:${email}`, `deleted:favorites:${rawEmail}`]));
  const key = `fav:${email}`;

  if (req.method === 'GET') {
    const deleted = await getDeleted(deletedKeys);
    const favs = cleanList((await Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat()).filter(url => !deleted.has(url)).slice(0, 100);
    return res.json({ favorites: favs });
  }

  if (req.method === 'POST') {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: '缺少url' });
    const target = String(url);
    const deleted = await getDeleted(deletedKeys);
    const existing = cleanList((await Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat()).filter(url => !deleted.has(url));
    if (existing.includes(target)) {
      await Promise.all([
        ...keys.map(async k => {
          const list = cleanList(await kv.lrange(k, 0, 199).catch(() => []));
          await replaceList(k, list.filter(x => x !== target));
        }),
        ...deletedKeys.map(k => kv.sadd(k, target).catch(() => 0)),
      ]);
      const deletedNow = await getDeleted(deletedKeys);
      const favorites = cleanList((await Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat()).filter(url => !deletedNow.has(url)).slice(0, 100);
      return res.json({ ok: true, added: false, favorites });
    }
    await Promise.all(deletedKeys.map(k => kv.srem(k, target).catch(() => 0)));
    const next = [target, ...existing.filter(x => x !== target)].slice(0, 100);
    await replaceList(key, next);
    return res.json({ ok: true, added: true, favorites: next });
  }

  if (req.method === 'DELETE') {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: '缺少url' });
    const target = String(url);
    await Promise.all([
      ...keys.map(async k => {
        const list = cleanList(await kv.lrange(k, 0, 199).catch(() => []));
        await replaceList(k, list.filter(x => x !== target));
      }),
      ...deletedKeys.map(k => kv.sadd(k, target).catch(() => 0)),
    ]);
    const deleted = await getDeleted(deletedKeys);
    const favorites = cleanList((await Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat()).filter(x => !deleted.has(x)).slice(0, 100);
    return res.json({ ok: true, deleted: true, favorites });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
