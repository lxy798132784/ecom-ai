import { NextApiRequest, NextApiResponse } from 'next';
import { findUserByEmail, normalizeEmail } from '../../../lib/users';
import { createPasswordReset, sendMail } from '../../../lib/email';
import { getClientIp, verifyTurnstile } from '../../../lib/security';
import { kv } from '@vercel/kv';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { email, captchaToken } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return res.status(400).json({ error: '请输入邮箱' });

    const ip = getClientIp(req);
    const captchaOk = await verifyTurnstile(captchaToken, ip);
    if (!captchaOk) return res.status(400).json({ error: '人机验证失败，请重试' });

    const rateKey = `forgot-password:${normalizedEmail}`;
    const rate = (await kv.get<number>(rateKey)) || 0;
    if (rate >= 1) return res.status(429).json({ error: '发送过于频繁，请稍后再试' });

    const user = await findUserByEmail(normalizedEmail);
    // Always return success to prevent email enumeration.
    if (!user) return res.json({ ok: true });

    const { url } = await createPasswordReset(normalizedEmail);
    await sendMail({
      to: normalizedEmail,
      subject: 'Reset your Image Studio AI password',
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#111827">
        <h2 style="margin:0 0 12px">Reset password</h2>
        <p>Click the button below to reset your Image Studio AI password. This link is valid for 30 minutes.</p>
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;margin:16px 0">Reset password</a>
        <p style="font-size:13px;color:#6b7280;line-height:1.6">If the button does not work, copy this link into your browser:<br>${url}</p>
        <p style="font-size:12px;color:#9ca3af">If you did not request this, ignore this email.</p>
      </div>`,
    });
    await kv.set(rateKey, 1, { ex: 600 });

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
