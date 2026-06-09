import crypto from 'crypto';
import { kv } from '@vercel/kv';

export type StoredImageProvider = {
  id: string;
  name: string;
  baseURL: string;
  model: string;
  apiKeyEnc?: string;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

export type RuntimeImageProvider = {
  id: string;
  name: string;
  baseURL: string;
  model: string;
  apiKey: string;
  enabled: boolean;
  priority: number;
};

const PROVIDERS_KEY = 'admin:image-providers';

function secretKey() {
  const secret = process.env.ADMIN_SECRET || process.env.NEXTAUTH_SECRET || process.env.OPENAI_API_KEY || 'change-me-image-provider-secret';
  return crypto.createHash('sha256').update(secret).digest();
}

function encrypt(value: string) {
  if (!value) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decrypt(value?: string) {
  if (!value) return '';
  if (!value.startsWith('v1:')) return value;
  const [, iv64, tag64, enc64] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv64, 'base64'));
  decipher.setAuthTag(Buffer.from(tag64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(enc64, 'base64')), decipher.final()]).toString('utf8');
}

function maskKey(apiKey: string) {
  if (!apiKey) return '';
  if (apiKey.length <= 12) return `${apiKey.slice(0, 3)}…${apiKey.slice(-3)}`;
  return `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`;
}

function normalizeBaseURL(input: string) {
  return String(input || '').trim().replace(/\/+$/, '');
}

function envProvider(): RuntimeImageProvider | null {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) return null;
  return {
    id: 'env-openai-compatible',
    name: 'Environment default',
    baseURL: normalizeBaseURL(process.env.OPENAI_BASE_URL || 'https://ai-pixel.online/v1'),
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
    apiKey,
    enabled: true,
    priority: 9999,
  };
}

export async function listStoredImageProviders(): Promise<StoredImageProvider[]> {
  const rows = await kv.get<StoredImageProvider[]>(PROVIDERS_KEY).catch(() => null);
  return Array.isArray(rows) ? rows : [];
}

export async function saveStoredImageProviders(rows: StoredImageProvider[]) {
  await kv.set(PROVIDERS_KEY, rows);
}

export async function listPublicImageProviders() {
  const rows = await listStoredImageProviders();
  return rows
    .slice()
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))
    .map(row => {
      const apiKey = decrypt(row.apiKeyEnc);
      return {
        id: row.id,
        name: row.name,
        baseURL: row.baseURL,
        model: row.model,
        enabled: row.enabled !== false,
        priority: Number(row.priority || 0),
        hasKey: Boolean(apiKey),
        keyPreview: maskKey(apiKey),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
}

export async function getActiveImageProviders(): Promise<RuntimeImageProvider[]> {
  const rows = await listStoredImageProviders();
  const configured = rows
    .filter(row => row.enabled !== false)
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))
    .map(row => ({
      id: row.id,
      name: row.name || row.id,
      baseURL: normalizeBaseURL(row.baseURL),
      model: row.model,
      apiKey: decrypt(row.apiKeyEnc),
      enabled: row.enabled !== false,
      priority: Number(row.priority || 0),
    }))
    .filter(row => row.baseURL && row.model && row.apiKey);
  const fallback = envProvider();
  return fallback ? [...configured, fallback] : configured;
}

export function buildStoredImageProvider(input: any, existing?: StoredImageProvider): StoredImageProvider {
  const now = new Date().toISOString();
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
  const next: StoredImageProvider = {
    id: existing?.id || crypto.randomUUID(),
    name: String(input.name || existing?.name || 'Image provider').trim(),
    baseURL: normalizeBaseURL(String(input.baseURL || existing?.baseURL || '')),
    model: String(input.model || existing?.model || 'gpt-image-2').trim(),
    apiKeyEnc: apiKey ? encrypt(apiKey) : (existing?.apiKeyEnc || ''),
    enabled: typeof input.enabled === 'boolean' ? input.enabled : existing?.enabled !== false,
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : Number(existing?.priority || 100),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  if (!next.name || !next.baseURL || !next.model) throw new Error('缺少名称、Base URL 或模型名');
  return next;
}
