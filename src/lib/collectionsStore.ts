import { kv } from '@vercel/kv';
import { normalizeEmail } from './users';

export type Collection = {
  id: string;
  name: string;
  urls: string[];
  createdAt: string;
  updatedAt: string;
};

const MAX_COLLECTIONS = 50;
const MAX_COLLECTION_ITEMS = 200;

function key(email: string) {
  return `collections:${normalizeEmail(email)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function cleanUrls(urls: unknown[]): string[] {
  return Array.from(new Set((urls || []).map(x => String(x || '')).filter(Boolean))).slice(0, MAX_COLLECTION_ITEMS);
}

function cleanName(name: string) {
  return String(name || '').trim().slice(0, 80) || 'Collection';
}

function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function getCollections(email: string): Promise<Collection[]> {
  const items = await kv.get<Collection[]>(key(email)).catch(() => null);
  return Array.isArray(items) ? items.slice(0, MAX_COLLECTIONS) : [];
}

export async function saveCollections(email: string, items: Collection[]) {
  const clean = items.slice(0, MAX_COLLECTIONS).map(c => ({
    id: String(c.id || newId()),
    name: cleanName(c.name),
    urls: cleanUrls(c.urls || []),
    createdAt: String(c.createdAt || nowIso()),
    updatedAt: String(c.updatedAt || nowIso()),
  }));
  await kv.set(key(email), clean);
  return clean;
}

export async function createCollection(email: string, name: string) {
  const items = await getCollections(email);
  const stamp = nowIso();
  const next = [{ id: newId(), name: cleanName(name), urls: [], createdAt: stamp, updatedAt: stamp }, ...items].slice(0, MAX_COLLECTIONS);
  return saveCollections(email, next);
}

export async function addUrlToCollection(email: string, collectionId: string, url: string) {
  const items = await getCollections(email);
  const stamp = nowIso();
  const next = items.map(c => c.id === collectionId ? { ...c, urls: cleanUrls([url, ...(c.urls || [])]), updatedAt: stamp } : c);
  return saveCollections(email, next);
}

export async function removeUrlFromCollection(email: string, collectionId: string, url: string) {
  const items = await getCollections(email);
  const stamp = nowIso();
  const next = items.map(c => c.id === collectionId ? { ...c, urls: (c.urls || []).filter(x => x !== url), updatedAt: stamp } : c);
  return saveCollections(email, next);
}
