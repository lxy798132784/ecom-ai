import { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { requireAdmin } from '../../../lib/adminAuth';
import { normalizeEmail } from '../../../lib/users';

interface StoredUser {
  id?: string;
  email: string;
  name?: string;
  plan?: string;
  createdAt?: string;
  hasPassword?: boolean;
  passwordHashPreview?: string;
}


function imageId(url: string) {
  const canonical = String(url || '').trim().split('#')[0].split('?')[0];
  return crypto.createHash('sha256').update(canonical || String(url || '')).digest('hex');
}

function cleanList(items: unknown[]): string[] {
  return Array.from(new Set((items || []).map(x => String(x || '')).filter(Boolean)));
}

function userAliasKeys(usersHash: Record<string, any>, email: string, rawEmail = '') {
  return Array.from(new Set([
    email,
    rawEmail,
    ...Object.keys(usersHash || {}).filter(k => normalizeEmail(k) === email || normalizeEmail(usersHash[k]?.email || '') === email),
  ].filter(Boolean)));
}

async function deletedImageSets(email: string, kind: 'history' | 'fav') {
  const urlKeys = kind === 'history' ? [`deleted:history:${email}`] : [`deleted:fav:${email}`, `deleted:favorites:${email}`];
  const idKeys = kind === 'history' ? [`deleted:history-id:${email}`] : [`deleted:fav-id:${email}`, `deleted:favorites-id:${email}`];
  const [urls, ids] = await Promise.all([
    Promise.all(urlKeys.map(k => kv.smembers(k).catch(() => []))).then(parts => cleanList(parts.flat())),
    Promise.all(idKeys.map(k => kv.smembers(k).catch(() => []))).then(parts => cleanList(parts.flat())),
  ]);
  return { urls: new Set(urls), ids: new Set(ids) };
}

function filterDeletedImages(items: unknown[], deleted: { urls: Set<string>; ids: Set<string> }) {
  return cleanList(items).filter(url => !deleted.urls.has(url) && !deleted.ids.has(imageId(url))).slice(0, 100);
}

function imageKeys(email: string, kind: 'history' | 'favorites') {
  return kind === 'history'
    ? [`history:${email}`]
    : [`fav:${email}`, `favorites:${email}`];
}

async function deleteImageEverywhere(email: string, kind: 'history' | 'favorites', url: string, id?: string) {
  const keys = imageKeys(email, kind);
  const targetId = id || imageId(url);
  await Promise.all(keys.map(async key => {
    const items = cleanList(await kv.lrange(key, 0, -1).catch(() => []));
    const kept = items.filter(item => item !== url && imageId(item) !== targetId);
    await kv.del(key);
    if (kept.length) await kv.rpush(key, ...kept.slice(0, 100));
  }));
  const tombstoneUrlKeys = kind === 'history' ? [`deleted:history:${email}`] : [`deleted:fav:${email}`, `deleted:favorites:${email}`];
  const tombstoneIdKeys = kind === 'history' ? [`deleted:history-id:${email}`] : [`deleted:fav-id:${email}`, `deleted:favorites-id:${email}`];
  if (url) await Promise.all(tombstoneUrlKeys.map(key => kv.sadd(key, url)));
  if (targetId) await Promise.all(tombstoneIdKeys.map(key => kv.sadd(key, targetId)));
}

function getUsageKey(email: string, month = new Date().toISOString().slice(0, 7), bucket: 'free' | 'pro' = 'free') {
  return `usage:${bucket}:${email}:${month}`;
}

function sanitizeUser(user: any, fallbackEmail: string): StoredUser {
  const passwordHash = String(user?.password || '');
  return {
    id: user?.id || '',
    email: normalizeEmail(user?.email || fallbackEmail),
    name: user?.name || '',
    plan: user?.plan || 'free',
    createdAt: user?.createdAt || '',
    hasPassword: Boolean(passwordHash),
    passwordHashPreview: passwordHash ? `${passwordHash.slice(0, 7)}…${passwordHash.slice(-6)}` : '',
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const month = String(req.query.month || new Date().toISOString().slice(0, 7));

  if (req.method === 'GET') {
    const usersHash = (await kv.hgetall<Record<string, any>>('users')) || {};
    const rows = await Promise.all(Object.entries(usersHash).map(async ([emailKey, raw]) => {
      const user = sanitizeUser(raw, emailKey);
      const email = normalizeEmail(user.email);
      const aliases = userAliasKeys(usersHash, email, user.email);
      const [freeUsage, proUsage, credits, history, favorites, deletedHistory, deletedFav] = await Promise.all([
        kv.get<number>(getUsageKey(email, month, 'free')).catch(() => 0),
        kv.get<number>(getUsageKey(email, month, 'pro')).catch(() => 0),
        kv.get<number>(`credits:${email}`).catch(() => 0),
        Promise.all(aliases.map(e => kv.lrange(`history:${e}`, 0, 199).catch(() => []))).then(parts => parts.flat()),
        Promise.all(aliases.flatMap(e => [`fav:${e}`, `favorites:${e}`]).map(k => kv.lrange(k, 0, 199).catch(() => []))).then(parts => parts.flat()),
        deletedImageSets(email, 'history'),
        deletedImageSets(email, 'fav'),
      ]);
      return {
        ...user,
        email,
        usage: user.plan === 'pro' ? (proUsage || 0) : (freeUsage || 0),
        freeUsage: freeUsage || 0,
        proUsage: proUsage || 0,
        credits: credits || 0,
        history: filterDeletedImages(history || [], deletedHistory),
        favorites: filterDeletedImages(favorites || [], deletedFav),
        historyCountPreview: filterDeletedImages(history || [], deletedHistory).length,
        favoritesCountPreview: filterDeletedImages(favorites || [], deletedFav).length,
      };
    }));

    rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return res.json({ ok: true, admin: admin.email, month, users: rows });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const email = normalizeEmail(body.email || '');
    if (!email) return res.status(400).json({ error: '缺少用户邮箱' });

    const usersHash = (await kv.hgetall<Record<string, any>>('users')) || {};
    const existing = usersHash[email] || usersHash[Object.keys(usersHash).find(k => normalizeEmail(k) === email) || ''];
    if (!existing) return res.status(404).json({ error: '用户不存在' });

    const nextUser = { ...existing, email };
    if (body.plan === 'free' || body.plan === 'pro') nextUser.plan = body.plan;
    if (typeof body.name === 'string') nextUser.name = body.name;
    if (typeof body.newPassword === 'string' && body.newPassword.length > 0) {
      if (body.newPassword.length < 6) return res.status(400).json({ error: '新密码至少 6 位' });
      nextUser.password = await bcrypt.hash(body.newPassword, 10);
    }
    await kv.hset('users', { [email]: nextUser });

    if (body.credits !== undefined) {
      const credits = Math.max(0, Number(body.credits) || 0);
      await kv.set(`credits:${email}`, credits);
    }
    if (body.usage !== undefined) {
      const usage = Math.max(0, Number(body.usage) || 0);
      const bucket = nextUser.plan === 'pro' ? 'pro' : 'free';
      await kv.set(getUsageKey(email, month, bucket), usage);
    }

    return res.json({ ok: true });
  }


  if (req.method === 'DELETE') {
    const body = req.body || {};
    const email = normalizeEmail(body.email || '');
    const kind = body.kind === 'favorites' ? 'favorites' : body.kind === 'history' ? 'history' : '';
    const url = String(body.url || '');
    const id = String(body.id || '');
    if (!email || !kind || (!url && !id)) return res.status(400).json({ error: '缺少 email、kind 或图片 ID' });
    await deleteImageEverywhere(email, kind, url, id || undefined);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
