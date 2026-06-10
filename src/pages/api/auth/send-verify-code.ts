import { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import { findUserByEmail, normalizeEmail } from '../../../lib/users';
import { sendVerificationCodeEmail } from '../../../lib/email';
import { getClientIp, verifyTurnstile } from '../../../lib/security';
import { createEmailCodeService } from '../../../lib/emailCode';

function errorMessage(code: string) {
  if (code === 'VERIFY_CODE_TOO_FREQUENT') return '发送过于频繁，请 60 秒后再试';
  return '验证码发送失败，请稍后重试';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { email, captchaToken } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return res.status(400).json({ error: '请输入邮箱' });

    const ip = getClientIp(req);
    const captchaOk = await verifyTurnstile(captchaToken, ip);
    if (!captchaOk) return res.status(400).json({ error: '人机验证失败，请重试' });

    const exists = await findUserByEmail(normalizedEmail);
    if (exists && exists.emailVerified !== false) return res.status(409).json({ error: '该邮箱已注册' });

    const day = new Date().toISOString().slice(0, 10);
    const ipKey = `send-email-code:${ip}:${day}`;
    const ipCount = (await kv.get<number>(ipKey)) || 0;
    if (ipCount >= 20) return res.status(429).json({ error: '验证码请求过于频繁，请明天再试' });

    const service = createEmailCodeService({ kv });
    const result = await service.create(normalizedEmail);
    try {
      await sendVerificationCodeEmail(normalizedEmail, result.code, Math.ceil(result.expiresIn / 60));
    } catch (mailError: any) {
      await kv.del(`email-code:${normalizedEmail}`).catch(() => undefined);
      return res.status(502).json({ error: mailError?.message || '验证码邮件发送失败，请稍后重试' });
    }

    await kv.incr(ipKey);
    await kv.expire(ipKey, 60 * 60 * 24);
    return res.json({ ok: true, message: '验证码已发送，请查看邮箱', countdown: result.countdown });
  } catch (e: any) {
    const code = e?.code || '';
    if (code === 'VERIFY_CODE_TOO_FREQUENT') return res.status(429).json({ error: errorMessage(code) });
    return res.status(500).json({ error: e.message || '验证码发送失败，请稍后重试' });
  }
}
