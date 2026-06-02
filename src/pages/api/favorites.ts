import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { kv } from '@vercel/kv';
export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

import { normalizeEmail } from '../../lib/users';
import { canonicalImageId, persistGeneratedImage } from '../../lib/imageStore';

function cleanList(items: unknown[]): string[] {
  return Array.from(new Set((items || []).map(x => String(x || '')).filter(Boolean)));
}

function imageId(url: string) {
  return canonicalImageId(url);
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

async function listKeysByOwner(prefixes: string[], ownerEmail: string, baseKeys: string[]) {
  const normalizedOwner = normalizeEmail(ownerEmail);
  const discovered = await Promise.all(prefixes.map(prefix =>
    (kv.keys(`${prefix}:*`).catch(() => []) as Promise<string[]>).then(keys =>
      keys.filter(key => normalizeEmail(String(key).slice(prefix.length + 1)) === normalizedOwner)
    )
  ));
  return Array.from(new Set([...baseKeys, ...discovered.flat()]));
}

function filterDeleted(items: string[], _deleted: { urls: Set<string>; ids: Set<string> }) {
  // Visibility first: earlier URL/ID tombstones accidentally hid valid legacy images.
  // DELETE now removes entries from every discovered key, so list views should show stored images.
  return cleanList(items).slice(0, 100);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });

  const rawEmail = String(token.email);
  const email = normalizeEmail(rawEmail);
  const usersHash = (await kv.hgetall<Record<string, any>>('users').catch(() => ({}))) || {};
  const aliasKeys = Object.keys(usersHash).filter(k => normalizeEmail(k) === email || normalizeEmail(usersHash[k]?.email || '') === email);
  const emailKeys = Array.from(new Set([email, rawEmail, ...aliasKeys]));
  const baseFavoriteKeys = emailKeys.flatMap(e => [`fav:${e}`, `favorites:${e}`]);
  const keys = await listKeysByOwner(['fav', 'favorites'], email, baseFavoriteKeys);
  const key = `fav:${email}`;

  if (req.method === 'GET') {
    const deleted = await getDeleted([email]);
    const favorites = filterDeleted((await Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat(), deleted);
    return res.json({ favorites });
  }

  if (req.method === 'POST') {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: '缺少url' });
    const target = await persistGeneratedImage(String(url));
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
