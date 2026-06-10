import { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { requireAdmin } from '../../../lib/adminAuth';
import { FREE_MONTHLY_POINTS, PRO_MONTHLY_POINTS } from '../../../lib/pricing';
import { normalizeEmail } from '../../../lib/users';
import { canonicalImageId } from '../../../lib/imageStore';
import { getCollections, saveCollections } from '../../../lib/collectionsStore';
import { getMediaHistory, removeMediaHistory } from '../../../lib/mediaStore';

interface StoredUser {
  id?: string;
  email: string;
  name?: string;
  plan?: string;
  createdAt?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  hasPassword?: boolean;
  passwordHashPreview?: string;
}


function imageId(url: string) {
  return canonicalImageId(url);
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

async function listKeysByOwner(prefixes: string[], ownerEmail: string, baseKeys: string[]) {
  const normalizedOwner = normalizeEmail(ownerEmail);
  const discovered = await Promise.all(prefixes.map(prefix =>
    (kv.keys(`${prefix}:*`).catch(() => []) as Promise<string[]>).then(keys =>
      keys.filter(key => normalizeEmail(String(key).slice(prefix.length + 1)) === normalizedOwner)
    )
  ));
  return Array.from(new Set([...baseKeys, ...discovered.flat()]));
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

function filterDeletedImages(items: unknown[], _deleted: { urls: Set<string>; ids: Set<string> }) {
  // Visibility first: do not let stale tombstones hide valid user/admin images.
  // Admin/user DELETE removes entries from all discovered history/favorite keys.
  return cleanList(items).slice(0, 100);
}

async function imageKeys(email: string, kind: 'history' | 'favorites') {
  const base = kind === 'history' ? [`history:${email}`] : [`fav:${email}`, `favorites:${email}`];
  return listKeysByOwner(kind === 'history' ? ['history'] : ['fav', 'favorites'], email, base);
}

async function deleteImageEverywhere(email: string, kind: 'history' | 'favorites', url: string, id?: string) {
  const keys = await imageKeys(email, kind);
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
async function deleteAccountEverywhere(email: string, rawEmail = '') {
  const usersHash = (await kv.hgetall<Record<string, any>>('users')) || {};
  const aliases = userAliasKeys(usersHash, email, rawEmail);
  const months = new Set<string>([new Date().toISOString().slice(0, 7)]);
  const usageKeys = await kv.keys('usage:*').catch(() => [] as string[]);
  usageKeys.forEach(key => {
    if (aliases.some(alias => String(key).includes(`:${alias}:`))) months.add(String(key).slice(-7));
  });

  const ownedKeys = await listKeysByOwner(
    ['history', 'fav', 'favorites', 'collections', 'media:history', 'deleted:history', 'deleted:fav', 'deleted:favorites', 'deleted:history-id', 'deleted:fav-id', 'deleted:favorites-id'],
    email,
    aliases.flatMap(alias => [
      `history:${alias}`,
      `fav:${alias}`,
      `favorites:${alias}`,
      `collections:${alias}`,
      `media:history:${alias}`,
      `deleted:history:${alias}`,
      `deleted:fav:${alias}`,
      `deleted:favorites:${alias}`,
      `deleted:history-id:${alias}`,
      `deleted:fav-id:${alias}`,
      `deleted:favorites-id:${alias}`,
    ]),
  );

  const billingKeys = aliases.flatMap(alias => [
    `credits:${alias}`,
    ...Array.from(months).flatMap(m => [`usage:free:${alias}:${m}`, `usage:pro:${alias}:${m}`]),
  ]);

  await Promise.all([
    ...aliases.map(alias => kv.hdel('users', alias).catch(() => undefined)),
    ...Array.from(new Set([...ownedKeys, ...billingKeys])).map(key => kv.del(key).catch(() => undefined)),
  ]);
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
    emailVerified: user?.emailVerified !== false,
    emailVerifiedAt: user?.emailVerifiedAt || '',
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
      const [freeUsage, proUsage, credits, history, favorites, deletedHistory, deletedFav, collections, mediaHistory] = await Promise.all([
        kv.get<number>(getUsageKey(email, month, 'free')).catch(() => 0),
        kv.get<number>(getUsageKey(email, month, 'pro')).catch(() => 0),
        kv.get<number>(`credits:${email}`).catch(() => 0),
        listKeysByOwner(['history'], email, aliases.map(e => `history:${e}`)).then(keys => Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => []))).then(parts => parts.flat())),
        listKeysByOwner(['fav', 'favorites'], email, aliases.flatMap(e => [`fav:${e}`, `favorites:${e}`])).then(keys => Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => []))).then(parts => parts.flat())),
        deletedImageSets(email, 'history'),
        deletedImageSets(email, 'fav'),
        getCollections(email).catch(() => []),
        getMediaHistory(email).catch(() => []),
      ]);
      return {
        ...user,
        email,
        usage: user.plan === 'pro' ? (proUsage || 0) : (freeUsage || 0),
        freeUsage: freeUsage || 0,
        proUsage: proUsage || 0,
        credits: credits || 0,
        totalPoints: Math.max(0, ((user.plan === 'pro' ? PRO_MONTHLY_POINTS : FREE_MONTHLY_POINTS) - (user.plan === 'pro' ? (proUsage || 0) : (freeUsage || 0)))) + (credits || 0),
        history: filterDeletedImages(history || [], deletedHistory),
        favorites: filterDeletedImages(favorites || [], deletedFav),
        historyCountPreview: filterDeletedImages(history || [], deletedHistory).length,
        favoritesCountPreview: filterDeletedImages(favorites || [], deletedFav).length,
        collections,
        mediaHistory,
      };
    }));

    rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return res.json({ ok: true, admin: admin.email, month, users: rows });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const email = normalizeEmail(body.email || '');
    const password = String(body.password || '');
    const name = String(body.name || '').trim();
    const plan = body.plan === 'pro' ? 'pro' : 'free';
    const credits = Math.max(0, Number(body.credits) || 0);
    const emailVerified = body.emailVerified !== false;
    if (!email) return res.status(400).json({ error: '缺少用户邮箱' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });

    const usersHash = (await kv.hgetall<Record<string, any>>('users')) || {};
    const duplicateKey = Object.keys(usersHash).find(k => normalizeEmail(k) === email || normalizeEmail(usersHash[k]?.email || '') === email);
    if (duplicateKey) return res.status(409).json({ error: '账号已存在' });

    const now = new Date().toISOString();
    const user = {
      id: randomUUID(),
      email,
      name,
      password: await bcrypt.hash(password, 10),
      plan,
      createdAt: now,
      emailVerified,
      emailVerifiedAt: emailVerified ? now : '',
    };
    await kv.hset('users', { [email]: user });
    await kv.set(`credits:${email}`, credits);
    return res.status(201).json({ ok: true, user: { ...sanitizeUser(user, email), credits, usage: 0, freeUsage: 0, proUsage: 0, history: [], favorites: [], collections: [], mediaHistory: [] } });
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
    if (typeof body.emailVerified === 'boolean') {
      nextUser.emailVerified = body.emailVerified;
      nextUser.emailVerifiedAt = body.emailVerified ? (nextUser.emailVerifiedAt || new Date().toISOString()) : '';
    }
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
    const kind = body.kind === 'account' ? 'account' : body.kind === 'favorites' ? 'favorites' : body.kind === 'history' ? 'history' : body.kind === 'media' ? 'media' : body.kind === 'collection' ? 'collection' : '';
    const url = String(body.url || '');
    const id = String(body.id || '');
    if (!email || !kind) return res.status(400).json({ error: '缺少 email 或 kind' });
    if (kind === 'account') {
      if (!body.confirm) return res.status(400).json({ error: '删除账号需要二次确认' });
      await deleteAccountEverywhere(email, body.email || '');
      return res.json({ ok: true });
    }
    if (kind === 'media') {
      if (!id && !url) return res.status(400).json({ error: '缺少媒体 ID' });
      await removeMediaHistory(email, id || url);
      return res.json({ ok: true });
    }
    if (kind === 'collection') {
      if (!id) return res.status(400).json({ error: '缺少收藏夹 ID' });
      const current = await getCollections(email);
      if (url) await saveCollections(email, current.map(c => c.id === id ? { ...c, urls: (c.urls || []).filter(x => x !== url), updatedAt: new Date().toISOString() } : c));
      else await saveCollections(email, current.filter(c => c.id !== id));
      return res.json({ ok: true });
    }
    if (!url && !id) return res.status(400).json({ error: '缺少图片 ID' });
    await deleteImageEverywhere(email, kind, url, id || undefined);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
