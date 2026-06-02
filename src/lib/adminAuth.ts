import crypto from 'crypto';
import { NextApiRequest, NextApiResponse } from 'next';

const COOKIE_NAME = 'ecom_admin_session';
const MAX_AGE_SECONDS = 60 * 60 * 8;

function getAdminSecret(): string {
  return process.env.ADMIN_SECRET || process.env.NEXTAUTH_SECRET || 'change-me-admin-secret';
}

function sign(value: string): string {
  return crypto.createHmac('sha256', getAdminSecret()).update(value).digest('hex');
}

function parseCookies(req: NextApiRequest): Record<string, string> {
  return Object.fromEntries(
    String(req.headers.cookie || '')
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const idx = part.indexOf('=');
        if (idx < 0) return [part, ''];
        return [decodeURIComponent(part.slice(0, idx)), decodeURIComponent(part.slice(idx + 1))];
      }),
  );
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function createAdminSession(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + MAX_AGE_SECONDS * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSession(req: NextApiRequest): { email: string } | null {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (!data.email || !data.exp || Date.now() > data.exp) return null;
    return { email: String(data.email) };
  } catch {
    return null;
  }
}

export function requireAdmin(req: NextApiRequest, res: NextApiResponse): { email: string } | null {
  const admin = verifyAdminSession(req);
  if (!admin) {
    res.status(401).json({ error: 'Admin login required' });
    return null;
  }
  return admin;
}

export function setAdminCookie(res: NextApiResponse, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`);
}

export function clearAdminCookie(res: NextApiResponse) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function validateAdminCredentials(email: string, password: string): boolean {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) return false;
  return safeEqual(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase()) && safeEqual(password, expectedPassword);
}
