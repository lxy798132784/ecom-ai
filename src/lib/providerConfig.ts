/**
 * Unified provider config store for all media types (image / video / audio / voice-clone).
 *
 * Replaces the per-type KV keys and env-only fallback. Each media kind has its own
 * KV namespace but the data schema is identical to the existing image-providers store
 * so that the existing backend API and encryption logic can be reused.
 *
 * Design:
 * - Each kind (image | video | audio | voice-clone) has a separate KV key:
 *   `admin:{kind}-providers`
 * - The storage format (id/name/baseURL/model/apiKeyEnc/enabled/priority/timestamps)
 *   is identical across kinds so the UI can be shared.
 * - Env fallback per kind: if a kind has NO configured providers, fall back to the
 *   corresponding `{KIND}_API_URL` / `{KIND}_API_KEY` / `{KIND}_MODEL` env vars.
 *   Image keeps the existing OPENAI_* fallback.
 */
import crypto from 'crypto';
import { kv } from '@vercel/kv';

// ── types ────────────────────────────────────────────────────────────────────

export type StoredProvider = {
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

export type RuntimeProvider = {
  id: string;
  name: string;
  baseURL: string;
  model: string;
  apiKey: string;
  enabled: boolean;
  priority: number;
};

export type ProviderType = 'image' | 'video' | 'audio' | 'voice-clone';

export type ProviderStatus =
  | { configured: true; providers: RuntimeProvider[] }
  | { configured: false; missingEnv: string[] };

// ── KV helpers (mirrors imageProviders.ts) ────────────────────────────────────

const secret = crypto
  .createHash('sha256')
  .update(
    process.env.ADMIN_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      process.env.OPENAI_API_KEY ||
      'change-me-provider-secret'
  )
  .digest();

function encrypt(value: string) {
  if (!value) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(value?: string) {
  if (!value) return '';
  if (!value.startsWith('v1:')) return value;
  const [, iv64, tag64, enc64] = value.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    secret,
    Buffer.from(iv64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(enc64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function maskKey(apiKey: string) {
  if (!apiKey) return '';
  if (apiKey.length <= 12) return `${apiKey.slice(0, 3)}…${apiKey.slice(-3)}`;
  return `${apiKey.slice(0, 6)}…${apiKey.slice(-4)}`;
}

export function normalizeBaseURL(input: string) {
  const url = String(input || '').trim().replace(/\/+$/, '');
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(`URL 必须以 http:// 或 https:// 开头，当前值：${input}`);
  }
  return url;
}

// ── per-kind KV ──────────────────────────────────────────────────────────────

function kvKey(kind: ProviderType) {
  return `admin:${kind}-providers`;
}

// ── public API ───────────────────────────────────────────────────────────────

export async function listProviders(kind: ProviderType) {
  const rows = await kv.get<StoredProvider[]>(kvKey(kind)).catch(() => null);
  return Array.isArray(rows) ? rows : [];
}

export async function saveProviders(kind: ProviderType, rows: StoredProvider[]) {
  await kv.set(kvKey(kind), rows);
}

export async function listPublicProviders(kind: ProviderType) {
  const rows = await listProviders(kind);
  return rows
    .slice()
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))
    .map((row) => {
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

/**
 * Returns active (enabled + fully configured) runtime providers sorted by priority.
 * If no configured providers exist for this kind, returns env-based fallback.
 * Env fallback is only used when there are ZERO stored providers (not just empty).
 */
export async function getActiveProviders(
  kind: ProviderType
): Promise<RuntimeProvider[]> {
  const rows = await listProviders(kind);
  const configured: RuntimeProvider[] = [];
  for (const row of rows) {
    if (row.enabled === false) continue;
    let baseURL: string;
    try {
      baseURL = normalizeBaseURL(row.baseURL);
    } catch {
      console.warn(`Provider ${row.id}/${row.name} has invalid baseURL, skipping: ${row.baseURL}`);
      continue;
    }
    const apiKey = decrypt(row.apiKeyEnc);
    if (!baseURL || !row.model || !apiKey) continue;
    configured.push({
      id: row.id,
      name: row.name || row.id,
      baseURL,
      model: row.model,
      apiKey,
      enabled: true,
      priority: Number(row.priority || 0),
    });
  }
  configured.sort((a, b) => a.priority - b.priority);

  // Env fallback — only when no stored providers at all (mirrors image behavior)
  const envProvider = envProviderFor(kind);
  if (rows.length === 0 && envProvider) {
    return [envProvider];
  }

  return configured;
}

/**
 * Checks provider config status for a kind.
 * Returns configured=true if there are enabled+filled providers (stored or env).
 * Returns configured=false with missingEnv list.
 */
export function checkConfigStatus(kind: ProviderType): ProviderStatus {
  // We can't async check inside this function, so return a sync-ish result
  // The caller should use this for display; real check happens in getActiveProviders
  const envVars = requiredEnvVars(kind);
  const envFilled = envVars.every(
    (v) => (process.env as Record<string, string>)[v]
  );
  if (envFilled) {
    return { configured: true, providers: [] };
  }
  return { configured: false, missingEnv: envVars };
}

export function requiredEnvVars(kind: ProviderType): string[] {
  if (kind === 'image')
    return ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_IMAGE_MODEL'];
  if (kind === 'video')
    return ['VIDEO_API_URL', 'VIDEO_API_KEY', 'VIDEO_MODEL'];
  if (kind === 'audio')
    return ['AUDIO_API_URL', 'AUDIO_API_KEY', 'AUDIO_MODEL'];
  return ['VOICE_CLONE_API_URL', 'VOICE_CLONE_API_KEY', 'VOICE_CLONE_MODEL'];
}

// ── env-based fallback ───────────────────────────────────────────────────────

function envProviderFor(kind: ProviderType): RuntimeProvider | null {
  if (kind === 'image') {
    const key = process.env.OPENAI_API_KEY || '';
    if (!key) return null;
    return {
      id: 'env-openai-compatible',
      name: 'Environment default',
      baseURL: normalizeBaseURL(
        process.env.OPENAI_BASE_URL || 'https://ai-pixel.online/v1'
      ),
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2',
      apiKey: key,
      enabled: true,
      priority: 9999,
    };
  }
  if (kind === 'video') {
    const url = process.env.VIDEO_API_URL;
    const key = process.env.VIDEO_API_KEY;
    if (!url || !key) return null;
    return {
      id: 'env-video',
      name: 'Environment default (video)',
      baseURL: normalizeBaseURL(url),
      model: process.env.VIDEO_MODEL || '',
      apiKey: key,
      enabled: true,
      priority: 9999,
    };
  }
  if (kind === 'audio') {
    const url =
      process.env.AUDIO_API_URL || process.env.TTS_API_URL || '';
    const key =
      process.env.AUDIO_API_KEY || process.env.TTS_API_KEY || '';
    if (!url || !key) return null;
    return {
      id: 'env-audio',
      name: 'Environment default (audio)',
      baseURL: normalizeBaseURL(url),
      model: process.env.AUDIO_MODEL || process.env.TTS_MODEL || '',
      apiKey: key,
      enabled: true,
      priority: 9999,
    };
  }
  // voice-clone
  const url = process.env.VOICE_CLONE_API_URL || '';
  const key = process.env.VOICE_CLONE_API_KEY || '';
  if (!url || !key) return null;
  return {
    id: 'env-voice-clone',
    name: 'Environment default (voice-clone)',
    baseURL: normalizeBaseURL(url),
    model: process.env.VOICE_CLONE_MODEL || '',
    apiKey: key,
    enabled: true,
    priority: 9999,
  };
}

// ── provider builder (same signature as imageProviders) ──────────────────────

export function buildStoredProvider(
  input: any,
  existing?: StoredProvider
): StoredProvider {
  const now = new Date().toISOString();
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
  const next: StoredProvider = {
    id: existing?.id || crypto.randomUUID(),
    name: String(input.name || existing?.name || 'Provider').trim(),
    baseURL: normalizeBaseURL(
      String(input.baseURL || existing?.baseURL || '')
    ),
    model: String(input.model || existing?.model || '').trim(),
    apiKeyEnc: apiKey ? encrypt(apiKey) : existing?.apiKeyEnc || '',
    enabled:
      typeof input.enabled === 'boolean'
        ? input.enabled
        : existing?.enabled !== false,
    priority: Number.isFinite(Number(input.priority))
      ? Number(input.priority)
      : Number(existing?.priority || 100),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  if (!next.name || !next.baseURL || !next.model) {
    throw new Error('缺少名称、Base URL 或模型名');
  }
  return next;
}
