import { Resend } from 'resend';
import crypto from 'crypto';
import { kv } from '@vercel/kv';

const baseUrl = () => process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Image Studio AI';

export function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function sendMail(options: { to: string; subject: string; html: string }) {
  if (!process.env.RESEND_API_KEY) return { skipped: true };
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.EMAIL_FROM || `${appName} <noreply@example.com>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
  return { skipped: false };
}

export async function createEmailVerification(email: string) {
  const token = createToken();
  await kv.set(`verify-email:${token}`, email, { ex: 60 * 60 * 24 });
  return { token, url: `${baseUrl()}/verify-email?token=${token}` };
}

export async function sendVerificationEmail(email: string, name?: string) {
  const { token, url } = await createEmailVerification(email);
  await sendMail({
    to: email,
    subject: `Verify your ${appName} email`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#111827">
      <h2 style="margin:0 0 12px">Verify your email</h2>
      <p>Hello ${name || email},</p>
      <p>Please click the button below to verify your ${appName} account. This link is valid for 24 hours.</p>
      <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:12px;text-decoration:none;font-weight:700;margin:16px 0">Verify email</a>
      <p style="font-size:13px;color:#6b7280;line-height:1.6">If the button does not work, copy this link into your browser:<br>${url}</p>
      <p style="font-size:12px;color:#9ca3af">If you did not create this account, you can ignore this email.</p>
    </div>`,
  });
  return { token, url };
}

export async function createPasswordReset(email: string) {
  const token = createToken();
  await kv.set(`reset:${token}`, email, { ex: 1800 });
  return { token, url: `${baseUrl()}/reset?token=${token}` };
}
