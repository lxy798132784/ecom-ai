import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { kv } from '@vercel/kv';
import crypto from 'crypto';
import { normalizeEmail, findUserByEmail } from '../../lib/users';

const FREE_LIMIT = 5;
const PRO_LIMIT = 1000;

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

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

async function getDeleted(keys: string[]): Promise<{ urls: Set<string>; ids: Set<string> }> {
  const urlKeys = keys.map(k => `deleted:history:${k}`);
  const idKeys = keys.map(k => `deleted:history-id:${k}`);
  const [urls, ids] = await Promise.all([
    Promise.all(urlKeys.map(k => kv.smembers(k).catch(() => []))).then(parts => cleanList(parts.flat())),
    Promise.all(idKeys.map(k => kv.smembers(k).catch(() => []))).then(parts => cleanList(parts.flat())),
  ]);
  return { urls: new Set(urls), ids: new Set(ids) };
}

function filterDeleted(items: string[], deleted: { urls: Set<string>; ids: Set<string> }) {
  return cleanList(items).filter(url => !deleted.urls.has(url) && !deleted.ids.has(imageId(url))).slice(0, 100);
}

function usageKey(email: string, bucket: 'free' | 'pro', month = currentMonth()) {
  return `usage:${bucket}:${email}:${month}`;
}

async function getNumber(key: string): Promise<number> {
  try { return Number((await kv.get<number>(key)) || 0); } catch { return 0; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });

  const rawEmail = String(token.email);
  const email = normalizeEmail(rawEmail);
  const emailKeys = Array.from(new Set([email, rawEmail]));
  const historyKeys = emailKeys.map(e => `history:${e}`);
  const key = `history:${email}`;

  if (req.method === 'GET') {
    const month = currentMonth();
    const [raw, credits, freeUsage, proUsage, user, deleted] = await Promise.all([
      Promise.all(historyKeys.map(k => kv.lrange(k, 0, 199).catch(() => []))).then(parts => parts.flat()),
      getNumber(`credits:${email}`),
      getNumber(usageKey(email, 'free', month)),
      getNumber(usageKey(email, 'pro', month)),
      findUserByEmail(email).catch(() => undefined),
      getDeleted(emailKeys),
    ]);
    const plan = user?.plan || (token.plan as string) || 'free';
    const limit = plan === 'pro' ? PRO_LIMIT : FREE_LIMIT;
    const usage = plan === 'pro' ? proUsage : freeUsage;
    const history = filterDeleted(raw || [], deleted);
    return res.json({ history, credits, usage, limit, plan, freeUsage, proUsage });
  }

  if (req.method === 'POST') {
    const { url } = req.body;
    if (url) {
      const target = String(url);
      const targetId = imageId(target);
      await Promise.all(emailKeys.flatMap(e => [
        kv.srem(`deleted:history:${e}`, target).catch(() => 0),
        kv.srem(`deleted:history-id:${e}`, targetId).catch(() => 0),
      ]));
      const existing = cleanList(await kv.lrange(key, 0, 199).catch(() => []));
      const next = [target, ...existing.filter(x => x !== target && imageId(x) !== targetId)].slice(0, 100);
      await replaceList(key, next);
    }
    const deleted = await getDeleted(emailKeys);
    const history = filterDeleted((await Promise.all(historyKeys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat(), deleted);
    return res.json({ ok: true, history });
  }

  if (req.method === 'DELETE') {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: '缺少url' });
    const target = String(url);
    const targetId = imageId(target);
    await Promise.all([
      ...historyKeys.map(async k => {
        const existing = cleanList(await kv.lrange(k, 0, 199).catch(() => []));
        await replaceList(k, existing.filter(x => x !== target && imageId(x) !== targetId));
      }),
      ...emailKeys.flatMap(e => [
        kv.sadd(`deleted:history:${e}`, target).catch(() => 0),
        kv.sadd(`deleted:history-id:${e}`, targetId).catch(() => 0),
      ]),
    ]);
    const deleted = await getDeleted(emailKeys);
    const history = filterDeleted((await Promise.all(historyKeys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat(), deleted);
    return res.json({ ok: true, deleted: true, history });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
