// User storage: Vercel KV (production) or in-memory (fallback)
let memoryStore: Record<string, any> = {};

interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  plan: string;
  createdAt: string;
}

let _kv: any = null;
let _kvInit = false;

async function getKV() {
  if (_kvInit) return _kv;
  _kvInit = true;
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const mod = await import('@vercel/kv');
      _kv = mod.kv;
    } catch {}
  }
  return _kv;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const kv = await getKV();
  if (kv) {
    try { return (await kv.hget('users', email)) as User | undefined; } catch {}
  }
  return memoryStore[email] as User | undefined;
}

export async function writeUser(user: User) {
  const kv = await getKV();
  if (kv) {
    try { await kv.hset('users', { [user.email]: user }); return; } catch {}
  }
  memoryStore[user.email] = user;
}
