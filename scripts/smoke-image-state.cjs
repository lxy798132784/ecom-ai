const path = require('path');
const Module = require('module');
const crypto = require('crypto');

process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret';
process.env.NODE_ENV = 'test';

const store = new Map();
function arr(v) { return Array.isArray(v) ? v.slice() : []; }
function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
function imageId(url) {
  const canonical = String(url || '').trim().split('#')[0].split('?')[0];
  return crypto.createHash('sha256').update(canonical || String(url || '')).digest('hex');
}

const kv = {
  async get(k) { return store.get(k) ?? null; },
  async set(k, v) { store.set(k, v); return 'OK'; },
  async del(k) { const ok = store.delete(k); return ok ? 1 : 0; },
  async hget(k, f) { return (store.get(k) || {})[f] ?? null; },
  async hgetall(k) { return store.get(k) || {}; },
  async hset(k, obj) { store.set(k, { ...(store.get(k) || {}), ...obj }); return Object.keys(obj).length; },
  async lrange(k, start, stop) { const a = arr(store.get(k)); return a.slice(start, stop < 0 ? undefined : stop + 1); },
  async lpush(k, ...vals) { const a = arr(store.get(k)); store.set(k, vals.concat(a)); return vals.length + a.length; },
  async rpush(k, ...vals) { const a = arr(store.get(k)); store.set(k, a.concat(vals)); return vals.length + a.length; },
  async lrem(k, _count, val) { const a = arr(store.get(k)); const b = a.filter(x => x !== val); store.set(k, b); return a.length - b.length; },
  async ltrim(k, start, stop) { const a = arr(store.get(k)); store.set(k, a.slice(start, stop + 1)); return 'OK'; },
  async sadd(k, ...vals) { const s = new Set(arr(store.get(k))); vals.forEach(v => s.add(v)); store.set(k, [...s]); return vals.length; },
  async srem(k, ...vals) { const s = new Set(arr(store.get(k))); vals.forEach(v => s.delete(v)); store.set(k, [...s]); return vals.length; },
  async smembers(k) { return arr(store.get(k)); },
  async keys(pattern) { const prefix = pattern.replace('*', ''); return [...store.keys()].filter(k => k.startsWith(prefix)); },
  async incrby(k, n) { const next = Number(store.get(k) || 0) + n; store.set(k, next); return next; },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@vercel/kv') return { kv };
  if (request === 'next-auth/jwt') return { getToken: async () => ({ email: global.__TEST_EMAIL__ || 'Test@Example.com', plan: 'free' }) };
  if (request.endsWith('../../lib/ai') || request.endsWith('../../../lib/ai')) return {
    dispatchGeneration: async () => ({ url: `data:image/png;base64,${Buffer.from('fake-image').toString('base64')}`, provider: 'openai', model: 'test', cost: 0 }),
    dispatchBatch: async () => ({ url: `data:image/png;base64,${Buffer.from('fake-image').toString('base64')}`, provider: 'openai', model: 'test', cost: 0 }),
    removeBackground: async () => `data:image/png;base64,${Buffer.from('fake-bg').toString('base64')}`,
    generateLifestyleScene: async () => `data:image/png;base64,${Buffer.from('fake-scene').toString('base64')}`,
    customEdit: async () => `data:image/png;base64,${Buffer.from('fake-custom').toString('base64')}`,
  };
  if (request.endsWith('../../../lib/adminAuth')) return { requireAdmin: () => ({ email: 'admin@example.com' }) };
  return originalLoad.call(this, request, parent, isMain);
};

const ts = require('typescript');
require.extensions['.ts'] = function(module, filename) {
  const fs = require('fs');
  const source = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.React } });
  module._compile(out.outputText, filename);
};
const generate = require('../src/pages/api/generate').default;
const history = require('../src/pages/api/history').default;
const favorites = require('../src/pages/api/favorites').default;
const adminUsers = require('../src/pages/api/admin/users').default;
const imageApi = require('../src/pages/api/image/[id]').default;

function mockReq(method, body = {}, query = {}) { return { method, body, query, headers: {}, socket: {} }; }
function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(v) { this.body = v; return this; },
    setHeader(k, v) { this.headers[k] = v; return this; },
    send(v) { this.body = v; return this; }
  };
  return res;
}
async function call(handler, method, body = {}, query = {}) { const res = mockRes(); await handler(mockReq(method, body, query), res); return res; }

(async () => {
  const email = normalizeEmail('Test@Example.com');
  store.set('users', { [email]: { id: 'u1', email, name: 'T', plan: 'free', createdAt: '2026-06-02T00:00:00Z' } });

  const gen = await call(generate, 'POST', { action: 'text2img', prompt: 'red shoes', quality: 'low', size: '1024x1024' });
  if (gen.statusCode !== 200 || !gen.body?.url?.startsWith('/api/image/')) throw new Error(`generate failed: ${gen.statusCode} ${JSON.stringify(gen.body)}`);
  const url = gen.body.url;

  const h1 = await call(history, 'GET');
  if (!h1.body.history.includes(url) || !gen.body.history?.includes(url) || gen.body.historySaved !== true) throw new Error(`history missing generated URL after refresh: ${JSON.stringify({ gen: gen.body, history: h1.body })}`);
  if (!h1.body.items?.[0]?.id || h1.body.items[0].url !== url) throw new Error(`history item metadata missing: ${JSON.stringify(h1.body)}`);

  global.__TEST_EMAIL__ = 'test@example.com';
  const hSameAccountLowerCase = await call(history, 'GET');
  if (!hSameAccountLowerCase.body.history.includes(url)) throw new Error(`same account different session/device missing history: ${JSON.stringify(hSameAccountLowerCase.body)}`);
  global.__TEST_EMAIL__ = 'Test@Example.com';

  const fav = await call(favorites, 'POST', { url, source: 'manual-favorite' });
  if (fav.statusCode !== 200 || !fav.body.favorites.includes(url)) throw new Error(`favorite add failed: ${JSON.stringify(fav.body)}`);

  const f1 = await call(favorites, 'GET');
  if (!f1.body.favorites.includes(url) || !f1.body.items?.[0]?.id) throw new Error(`favorites missing after refresh: ${JSON.stringify(f1.body)}`);
  global.__TEST_EMAIL__ = 'test@example.com';
  const fSameAccountLowerCase = await call(favorites, 'GET');
  if (!fSameAccountLowerCase.body.favorites.includes(url)) throw new Error(`same account different session/device missing favorites: ${JSON.stringify(fSameAccountLowerCase.body)}`);
  global.__TEST_EMAIL__ = 'Test@Example.com';

  const admin = await call(adminUsers, 'GET', {}, { month: new Date().toISOString().slice(0, 7) });
  const row = admin.body.users.find(u => u.email === email);
  if (!row || !row.history.includes(url) || !row.favorites.includes(url)) throw new Error(`admin missing images: ${JSON.stringify(admin.body)}`);

  const id = url.split('/').pop();
  const img = await call(imageApi, 'GET', {}, { id });
  if (img.statusCode !== 200 || !img.headers['Content-Type']?.startsWith('image/')) throw new Error(`stored image not readable: ${img.statusCode}`);
  const del = await call(history, 'DELETE', { id });
  if (del.statusCode !== 200 || del.body.history.includes(url)) throw new Error(`history delete failed: ${JSON.stringify(del.body)}`);

  console.log(JSON.stringify({ ok: true, url, historyCount: h1.body.history.length, favoritesCount: f1.body.favorites.length, adminHistory: row.history.length, adminFavorites: row.favorites.length }));
})().catch(err => { console.error(err); process.exit(1); });
