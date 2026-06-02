import { kv } from '@vercel/kv';
import crypto from 'crypto';

const CHUNK_SIZE = 180_000;
const MAX_IMAGE_BYTES = 18 * 1024 * 1024;

export function imageIdFromUrl(url: string) {
  const canonical = String(url || '').trim().split('#')[0].split('?')[0];
  return crypto.createHash('sha256').update(canonical || String(url || '')).digest('hex');
}

function publicImageUrl(id: string) {
  return `/api/image/${id}`;
}

export function isStoredImageUrl(url: string) {
  return /^\/api\/image\/[a-f0-9]{64}(?:\?.*)?(?:#.*)?$/i.test(String(url || ''));
}

export function storedImageId(url: string) {
  const match = String(url || '').match(/^\/api\/image\/([a-f0-9]{64})/i);
  return match?.[1] || '';
}

export function canonicalImageId(url: string) {
  return storedImageId(url) || imageIdFromUrl(url);
}

export async function persistGeneratedImage(url: string): Promise<string> {
  const value = String(url || '');
  if (!value) return '';
  if (!value.startsWith('data:image/')) return value;

  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes > MAX_IMAGE_BYTES) {
    throw new Error('生成图片过大，无法安全保存，请降低分辨率后重试');
  }

  const id = imageIdFromUrl(value);
  const manifestKey = `image:${id}:manifest`;
  const existing = await kv.get(manifestKey).catch(() => null);
  if (!existing) {
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) chunks.push(value.slice(i, i + CHUNK_SIZE));
    await Promise.all(chunks.map((chunk, idx) => kv.set(`image:${id}:chunk:${idx}`, chunk)));
    await kv.set(manifestKey, {
      id,
      kind: 'data-url',
      contentType: value.match(/^data:([^;]+);base64,/)?.[1] || 'image/png',
      chunks: chunks.length,
      bytes,
      createdAt: new Date().toISOString(),
    });
  }
  return publicImageUrl(id);
}

export async function loadStoredImage(id: string): Promise<{ dataUrl: string; contentType: string } | null> {
  const safeId = String(id || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(safeId)) return null;
  const manifest = await kv.get<any>(`image:${safeId}:manifest`).catch(() => null);
  const chunks = Number(manifest?.chunks || 0);
  if (!manifest || !chunks || chunks > 200) return null;
  const parts = await Promise.all(Array.from({ length: chunks }, (_, idx) => kv.get<string>(`image:${safeId}:chunk:${idx}`).catch(() => '')));
  const dataUrl = parts.join('');
  if (!dataUrl.startsWith('data:image/')) return null;
  return { dataUrl, contentType: manifest.contentType || dataUrl.match(/^data:([^;]+);base64,/)?.[1] || 'image/png' };
}
