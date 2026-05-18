import { NextApiRequest, NextApiResponse } from 'next';
import { Resend } from 'resend';
import { kv } from '@vercel/kv';
import { findUserByEmail } from '../../../lib/users';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: '请输入邮箱' });

    const user = await findUserByEmail(email);
    // Always return success to prevent email enumeration
    if (!user) return res.json({ ok: true });

    // Generate reset token (valid 30 min)
    const token = crypto.randomBytes(32).toString('hex');
    await kv.set(`reset:${token}`, email, { ex: 1800 });

    const resetUrl = `${process.env.NEXTAUTH_URL}/reset?token=${token}`;

    // Send email via Resend if configured
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'EcomPic <noreply@ecompic.ai>',
        to: email,
        subject: '重置你的 EcomPic 密码',
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2>🔐 重置密码</h2>
          <p>点击下方按钮重置你的 EcomPic 密码（30 分钟内有效）：</p>
          <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 32px;border-radius:12px;text-decoration:none;font-weight:bold;margin:16px 0">重置密码</a>
          <p style="color:#888;font-size:12px">如果没申请过，请忽略此邮件。</p>
        </div>`,
      });
    }

    console.log(`Reset token for ${email}: ${resetUrl}`);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
