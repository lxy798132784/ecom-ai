// User storage: Vercel KV (production) or in-memory (fallback)
let memoryStore: Record<string, any> = {};

async function getKV() {
  try {
    const { kv } = await import('@vercel/kv');
    return kv;
  } catch { return null; }
}

interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  plan: string;
  createdAt: string;
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
