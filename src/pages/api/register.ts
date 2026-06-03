import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';
import { findUserByEmail, writeUser, normalizeEmail, deleteUserByEmail } from '../../lib/users';
import { sendVerificationEmail } from '../../lib/email';
import { getClientIp, verifyTurnstile } from '../../lib/security';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { email, name, password, captchaToken } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) return res.status(400).json({ error: '邮箱和密码不能为空' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });

    const ip = getClientIp(req);
    const captchaOk = await verifyTurnstile(captchaToken, ip);
    if (!captchaOk) return res.status(400).json({ error: '人机验证失败，请重试' });

    const day = new Date().toISOString().slice(0, 10);
    const ipKey = `register:${ip}:${day}`;
    const ipCount = (await kv.get<number>(ipKey)) || 0;
    if (ipCount >= 3) return res.status(429).json({ error: '注册过于频繁，请明天再试' });

    const exists = await findUserByEmail(normalizedEmail);
    if (exists) {
      if (exists.emailVerified === false) {
        try {
          await sendVerificationEmail(normalizedEmail, exists.name);
        } catch (mailError: any) {
          return res.status(502).json({ error: mailError?.message || '验证邮件发送失败，请稍后重试' });
        }
        return res.status(200).json({ ok: true, message: '该邮箱已注册但尚未验证，我们已重新发送验证邮件', requiresEmailVerification: true });
      }
      return res.status(409).json({ error: '该邮箱已注册' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: `u_${Date.now()}`,
      email: normalizedEmail,
      name: name || normalizedEmail.split('@')[0],
      password: hashed,
      plan: 'free',
      createdAt: new Date().toISOString(),
      emailVerified: false,
    };
    await writeUser(user);
    try {
      await sendVerificationEmail(normalizedEmail, user.name);
    } catch (mailError: any) {
      await deleteUserByEmail(normalizedEmail).catch(() => undefined);
      return res.status(502).json({ error: mailError?.message || '验证邮件发送失败，请稍后重试' });
    }

    await kv.incr(ipKey);
    await kv.expire(ipKey, 60 * 60 * 24);
    return res.status(201).json({ ok: true, message: '注册成功，请先完成邮箱验证', requiresEmailVerification: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
