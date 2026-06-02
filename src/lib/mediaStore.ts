import { kv } from '@vercel/kv';
import { normalizeEmail } from './users';

export type MediaKind = 'video' | 'audio' | 'voice-clone';
export type MediaItem = {
  id: string;
  kind: MediaKind;
  url: string;
  prompt: string;
  inputUrl?: string;
  model?: string;
  provider?: string;
  createdAt: string;
};

const MAX_ITEMS = 100;
function key(email: string) { return `media:history:${normalizeEmail(email)}`; }
function nowIso() { return new Date().toISOString(); }
function newId() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function clean(items: unknown[]): MediaItem[] { return (Array.isArray(items) ? items : []).filter(Boolean).slice(0, MAX_ITEMS) as MediaItem[]; }

export async function getMediaHistory(email: string) {
  return clean(await kv.get<MediaItem[]>(key(email)).catch(() => []) || []);
}

export async function addMediaHistory(email: string, item: Omit<MediaItem, 'id' | 'createdAt'> & Partial<Pick<MediaItem, 'id' | 'createdAt'>>) {
  const current = await getMediaHistory(email);
  const nextItem: MediaItem = { id: item.id || newId(), createdAt: item.createdAt || nowIso(), kind: item.kind, url: item.url, prompt: item.prompt, inputUrl: item.inputUrl, model: item.model, provider: item.provider };
  const next = [nextItem, ...current.filter(x => x.url !== nextItem.url && x.id !== nextItem.id)].slice(0, MAX_ITEMS);
  await kv.set(key(email), next);
  return next;
}

export async function removeMediaHistory(email: string, id: string) {
  const next = (await getMediaHistory(email)).filter(x => x.id !== id && x.url !== id);
  await kv.set(key(email), next);
  return next;
}
