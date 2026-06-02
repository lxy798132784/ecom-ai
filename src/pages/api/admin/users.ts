import { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import bcrypt from 'bcryptjs';
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

function getUsageKey(email: string, month = new Date().toISOString().slice(0, 7)) {
  return `usage:${email}:${month}`;
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
      const [usage, credits, history, favorites] = await Promise.all([
        kv.get<number>(getUsageKey(email, month)).catch(() => 0),
        kv.get<number>(`credits:${email}`).catch(() => 0),
        kv.lrange(`history:${email}`, 0, 4).catch(() => []),
        kv.lrange(`favorites:${email}`, 0, 4).catch(() => []),
      ]);
      return {
        ...user,
        email,
        usage: usage || 0,
        credits: credits || 0,
        historyCountPreview: Array.isArray(history) ? history.length : 0,
        favoritesCountPreview: Array.isArray(favorites) ? favorites.length : 0,
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
      await kv.set(getUsageKey(email, month), usage);
    }

    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
