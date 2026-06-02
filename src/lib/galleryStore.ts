import { kv } from '@vercel/kv';
import { normalizeEmail } from './users';
import { canonicalImageId, persistGeneratedImage } from './imageStore';

export type ImageListKind = 'history' | 'favorites';

export type GalleryItem = {
  id: string;
  url: string;
  kind: ImageListKind;
  createdAt: string;
  updatedAt: string;
  source?: string;
  prompt?: string;
  action?: string;
  model?: string;
  provider?: string;
  quality?: string;
  size?: string;
  outputFormat?: string;
  referenceCount?: number;
};

const MAX_ITEMS = 100;

function nowIso() {
  return new Date().toISOString();
}

export function cleanList(items: unknown[]): string[] {
  return Array.from(new Set((items || []).map(x => String(x || '')).filter(Boolean)));
}

export function imageId(url: string) {
  return canonicalImageId(url);
}

export function ownerAliases(usersHash: Record<string, any>, email: string, rawEmail = '') {
  const normalized = normalizeEmail(email);
  return Array.from(new Set([
    normalized,
    rawEmail,
    ...Object.keys(usersHash || {}).filter(k => normalizeEmail(k) === normalized || normalizeEmail(usersHash[k]?.email || '') === normalized),
  ].filter(Boolean)));
}

function prefixes(kind: ImageListKind) {
  return kind === 'history' ? ['history'] : ['fav', 'favorites'];
}

export function canonicalListKey(kind: ImageListKind, email: string) {
  return `${kind === 'history' ? 'history' : 'fav'}:${normalizeEmail(email)}`;
}

function baseKeys(kind: ImageListKind, aliases: string[]) {
  return aliases.flatMap(e => kind === 'history' ? [`history:${e}`] : [`fav:${e}`, `favorites:${e}`]);
}

export async function listKeysByOwner(kind: ImageListKind, ownerEmail: string, aliases: string[]) {
  const normalizedOwner = normalizeEmail(ownerEmail);
  const discovered = await Promise.all(prefixes(kind).map(prefix =>
    (kv.keys(`${prefix}:*`).catch(() => []) as Promise<string[]>).then(keys =>
      keys.filter(key => normalizeEmail(String(key).slice(prefix.length + 1)) === normalizedOwner)
    )
  ));
  return Array.from(new Set([...baseKeys(kind, aliases), ...discovered.flat()]));
}

async function replaceList(key: string, items: string[]) {
  await kv.del(key);
  if (items.length) await kv.rpush(key, ...items.slice(0, MAX_ITEMS));
}

async function itemMetaKey(email: string, id: string) {
  return `gallery:item:${normalizeEmail(email)}:${id}`;
}

export async function getGalleryItems(email: string, kind: ImageListKind, aliases?: string[]): Promise<GalleryItem[]> {
  const normalized = normalizeEmail(email);
  const usersHash = (await kv.hgetall<Record<string, any>>('users').catch(() => ({}))) || {};
  const owners = aliases?.length ? aliases : ownerAliases(usersHash, normalized, email);
  const keys = await listKeysByOwner(kind, normalized, owners);
  const urls = cleanList((await Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat()).slice(0, MAX_ITEMS);
  const metas = await Promise.all(urls.map(async url => {
    const id = imageId(url);
    const meta = await kv.get<Partial<GalleryItem>>(await itemMetaKey(normalized, id)).catch(() => null);
    const createdAt = String(meta?.createdAt || meta?.updatedAt || '');
    return {
      id,
      url,
      kind,
      createdAt: createdAt || '',
      updatedAt: String(meta?.updatedAt || createdAt || ''),
      source: meta?.source,
      prompt: meta?.prompt,
      action: meta?.action,
      model: meta?.model,
      provider: meta?.provider,
      quality: meta?.quality,
      size: meta?.size,
      outputFormat: meta?.outputFormat,
      referenceCount: typeof meta?.referenceCount === 'number' ? meta.referenceCount : undefined,
    } as GalleryItem;
  }));
  return metas;
}

export async function addGalleryImage(email: string, rawEmail: string, kind: ImageListKind, url: string, meta: Partial<GalleryItem> = {}) {
  const normalized = normalizeEmail(email);
  const usersHash = (await kv.hgetall<Record<string, any>>('users').catch(() => ({}))) || {};
  const aliases = ownerAliases(usersHash, normalized, rawEmail || email);
  const target = await persistGeneratedImage(String(url));
  if (!target) throw new Error('Image storage failed');
  const id = imageId(target);
  const key = canonicalListKey(kind, normalized);
  const keys = await listKeysByOwner(kind, normalized, aliases);
  const existing = cleanList((await Promise.all(keys.map(k => kv.lrange(k, 0, 199).catch(() => [])))).flat());
  const next = [target, ...existing.filter(x => x !== target && imageId(x) !== id)].slice(0, MAX_ITEMS);
  await replaceList(key, next);
  const old = await kv.get<Partial<GalleryItem>>(await itemMetaKey(normalized, id)).catch(() => null);
  const stamp = nowIso();
  await kv.set(await itemMetaKey(normalized, id), {
    ...(old || {}),
    ...meta,
    id,
    url: target,
    kind,
    createdAt: old?.createdAt || stamp,
    updatedAt: stamp,
  });
  return { url: target, id, items: await getGalleryItems(normalized, kind, aliases) };
}

export async function removeGalleryImage(email: string, rawEmail: string, kind: ImageListKind, url = '', id = '') {
  const normalized = normalizeEmail(email);
  const usersHash = (await kv.hgetall<Record<string, any>>('users').catch(() => ({}))) || {};
  const aliases = ownerAliases(usersHash, normalized, rawEmail || email);
  const keys = await listKeysByOwner(kind, normalized, aliases);
  const targetId = String(id || imageId(url));
  await Promise.all(keys.map(async k => {
    const list = cleanList(await kv.lrange(k, 0, 199).catch(() => []));
    await replaceList(k, list.filter(x => (url ? x !== url : true) && imageId(x) !== targetId));
  }));
  return getGalleryItems(normalized, kind, aliases);
}

export function itemUrls(items: GalleryItem[]) {
  return items.map(x => x.url);
}
