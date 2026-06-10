import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';
import { findUserByEmail, writeUser, normalizeEmail } from '../../lib/users';
import { getClientIp } from '../../lib/security';
import { createEmailCodeService } from '../../lib/emailCode';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { email, name, password, captchaToken, verifyCode } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) return res.status(400).json({ error: '邮箱和密码不能为空' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });
    if (!String(verifyCode || '').trim()) return res.status(400).json({ error: '请输入邮箱验证码' });

    const ip = getClientIp(req);

    const day = new Date().toISOString().slice(0, 10);
    const ipKey = `register:${ip}:${day}`;
    const ipCount = (await kv.get<number>(ipKey)) || 0;
    if (ipCount >= 3) return res.status(429).json({ error: '注册过于频繁，请明天再试' });

    const emailCodeService = createEmailCodeService({ kv });
    try {
      await emailCodeService.verify(normalizedEmail, verifyCode);
    } catch (verifyError: any) {
      const code = verifyError?.code;
      if (code === 'VERIFY_CODE_MAX_ATTEMPTS') return res.status(429).json({ error: '验证码错误次数过多，请重新获取' });
      return res.status(400).json({ error: '验证码错误或已过期，请重新获取' });
    }

    const exists = await findUserByEmail(normalizedEmail);
    if (exists && exists.emailVerified !== false) return res.status(409).json({ error: '该邮箱已注册' });

    const hashed = await bcrypt.hash(password, 10);
    const user = exists ? {
      ...exists,
      name: name || exists.name || normalizedEmail.split('@')[0],
      password: hashed,
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
    } : {
      id: `u_${Date.now()}`,
      email: normalizedEmail,
      name: name || normalizedEmail.split('@')[0],
      password: hashed,
      plan: 'free',
      createdAt: new Date().toISOString(),
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
    };
    await writeUser(user);

    await kv.incr(ipKey);
    await kv.expire(ipKey, 60 * 60 * 24);
    return res.status(201).json({ ok: true, message: '注册成功，请登录', requiresEmailVerification: false });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
