import { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import { findUserByEmail, normalizeEmail } from '../../../lib/users';
import { sendVerificationEmail } from '../../../lib/email';
import { getClientIp, verifyTurnstile } from '../../../lib/security';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { email, captchaToken } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return res.status(400).json({ error: '请输入邮箱' });

    const ip = getClientIp(req);
    const captchaOk = await verifyTurnstile(captchaToken, ip);
    if (!captchaOk) return res.status(400).json({ error: '人机验证失败，请重试' });

    const rateKey = `resend-verification:${normalizedEmail}`;
    const rate = (await kv.get<number>(rateKey)) || 0;
    if (rate >= 1) return res.status(429).json({ error: '发送过于频繁，请稍后再试' });

    const user = await findUserByEmail(normalizedEmail);
    if (user && user.emailVerified === false) {
      await sendVerificationEmail(normalizedEmail, user.name);
      await kv.set(rateKey, 1, { ex: 600 });
    }

    return res.json({ ok: true, message: '如果邮箱存在且尚未验证，我们已发送验证邮件' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
