import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { kv } from '@vercel/kv';
import crypto from 'crypto';
export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

import { normalizeEmail } from '../../lib/users';

function cleanList(items: unknown[]): string[] {
  return Array.from(new Set((items || []).map(x => String(x || '')).filter(Boolean)));
}

function imageId(url: string) {
  const canonical = String(url || '').trim().split('#')[0].split('?')[0];
  return crypto.createHash('sha256').update(canonical || String(url || '')).digest('hex');
}

async function replaceList(key: string, items: string[]) {
  await kv.del(key);
  if (items.length) await kv.rpush(key, ...items);
}

async function getDeleted(emailKeys: string[]): Promise<{ urls: Set<string>; ids: Set<string> }> {
  const urlKeys = emailKeys.flatMap(e => [`deleted:fav:${e}`, `deleted:favorites:${e}`]);
  const idKeys = emailKeys.flatMap(e => [`deleted:fav-id:${e}`, `deleted:favorites-id:${e}`]);
  const [urls, ids] = await Promise.all([
    Promise.all(urlKeys.map(k => kv.smembers(k).catch(() => []))).then(parts => cleanList(parts.flat())),
    Promise.all(idKeys.map(k => kv.smembers(k).catch(() => []))).then(parts => cleanList(parts.flat())),
  ]);
  return { urls: new Set(urls), ids: new Set(ids) };
}

function filterDeleted(items: string[], deleted: { urls: Set<string>; ids: Set<string> }) {
  return cleanList(items).filter(url => !deleted.urls.has(url) && !deleted.ids.has(imageId(url))).slice(0, 100);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });

  const rawEmail = String(token.email);
  const email = normalizeEmail(rawEmail);
  const usersHash = (await kv.hgetall<Record<string, any>>('users').catch(() => ({}))) || {};
  const aliasKeys = Object.keys(usersHash).filter(k => normalizeEmail(k) === email || normalizeEmail(usersHash[k]?.email || '') === email);
  const emailKeys = Array.from(new Set([email, rawEmail, ...aliasKeys]));
  const keys = emailKeys.flatMap(e => [`fav:${e}`, `favorites:${e}`]);
  const key = `fav:${email}`;

  if (req.method === 'GET') {
    const deleted = await getDeleted([email]);
    const favorites = filterDeleted((await Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat(), deleted);
    return res.json({ favorites });
  }

  if (req.method === 'POST') {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: '缺少url' });
    const target = String(url);
    const targetId = imageId(target);
    const deleted = await getDeleted([email]);
    const existing = filterDeleted((await Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat(), deleted);
    if (existing.some(x => x === target || imageId(x) === targetId)) {
      await Promise.all([
        ...keys.map(async k => {
          const list = cleanList(await kv.lrange(k, 0, 199).catch(() => []));
          await replaceList(k, list.filter(x => x !== target && imageId(x) !== targetId));
        }),
        ...emailKeys.flatMap(e => [
          kv.sadd(`deleted:fav:${e}`, target).catch(() => 0),
          kv.sadd(`deleted:fav-id:${e}`, targetId).catch(() => 0),
          kv.sadd(`deleted:favorites:${e}`, target).catch(() => 0),
          kv.sadd(`deleted:favorites-id:${e}`, targetId).catch(() => 0),
        ]),
      ]);
      const deletedNow = await getDeleted([email]);
      const favorites = filterDeleted((await Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat(), deletedNow);
      return res.json({ ok: true, added: false, favorites });
    }
    await Promise.all(emailKeys.flatMap(e => [
      kv.srem(`deleted:fav:${e}`, target).catch(() => 0),
      kv.srem(`deleted:fav-id:${e}`, targetId).catch(() => 0),
      kv.srem(`deleted:favorites:${e}`, target).catch(() => 0),
      kv.srem(`deleted:favorites-id:${e}`, targetId).catch(() => 0),
    ]));
    const next = [target, ...existing.filter(x => x !== target && imageId(x) !== targetId)].slice(0, 100);
    await replaceList(key, next);
    return res.json({ ok: true, added: true, favorites: next });
  }

  if (req.method === 'DELETE') {
    const { url, id } = req.body || {};
    if (!url && !id) return res.status(400).json({ error: '缺少图片ID' });
    const target = url ? String(url) : '';
    const targetId = String(id || imageId(target));
    await Promise.all([
      ...keys.map(async k => {
        const list = cleanList(await kv.lrange(k, 0, 199).catch(() => []));
        await replaceList(k, list.filter(x => (target ? x !== target : true) && imageId(x) !== targetId));
      }),
      ...emailKeys.flatMap(e => [
        ...(target ? [kv.sadd(`deleted:fav:${e}`, target).catch(() => 0), kv.sadd(`deleted:favorites:${e}`, target).catch(() => 0)] : []),
        kv.sadd(`deleted:fav-id:${e}`, targetId).catch(() => 0),
        kv.sadd(`deleted:favorites-id:${e}`, targetId).catch(() => 0),
      ]),
    ]);
    const deleted = await getDeleted([email]);
    const favorites = filterDeleted((await Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat(), deleted);
    return res.json({ ok: true, deleted: true, favorites });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
