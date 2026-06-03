import { Resend } from 'resend';
import crypto from 'crypto';
import { kv } from '@vercel/kv';
import nodemailer from 'nodemailer';

const baseUrl = () => process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Image Studio AI';

export function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function mailFrom() {
  return process.env.EMAIL_FROM || process.env.SMTP_FROM || `${appName} <noreply@example.com>`;
}

async function sendSmtpMail(options: { to: string; subject: string; html: string }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return false;

  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: mailFrom(),
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
  return true;
}

async function sendResendMail(options: { to: string; subject: string; html: string }) {
  if (!process.env.RESEND_API_KEY) return false;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: mailFrom(),
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
  return true;
}

export async function sendMail(options: { to: string; subject: string; html: string }) {
  if (await sendSmtpMail(options)) return { provider: 'smtp', skipped: false };
  if (await sendResendMail(options)) return { provider: 'resend', skipped: false };
  return { provider: 'none', skipped: true };
}

export async function createEmailVerification(email: string) {
  const token = createToken();
  await kv.set(`verify-email:${token}`, email, { ex: 60 * 60 * 24 });
  return { token, url: `${baseUrl()}/verify-email?token=${token}` };
}

export async function sendVerificationEmail(email: string, name?: string) {
  const { token, url } = await createEmailVerification(email);
  const result = await sendMail({
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
  if (result.skipped) {
    await kv.del(`verify-email:${token}`).catch(() => undefined);
    throw new Error('Email delivery is not configured. Please set SMTP_HOST/SMTP_USER/SMTP_PASS or RESEND_API_KEY.');
  }
  return { token, url, provider: result.provider };
}

export async function createPasswordReset(email: string) {
  const token = createToken();
  await kv.set(`reset:${token}`, email, { ex: 1800 });
  return { token, url: `${baseUrl()}/reset?token=${token}` };
}
