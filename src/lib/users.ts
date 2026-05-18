import { kv } from '@vercel/kv';

interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  plan: string;
  createdAt: string;
}

export async function readUsers(): Promise<User[]> {
  try {
    const users = await kv.hgetall('users');
    if (!users) return [];
    return Object.values(users) as User[];
  } catch {
    return [];
  }
}

export async function writeUser(user: User) {
  await kv.hset('users', { [user.email]: user });
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  try {
    return (await kv.hget('users', email)) as User | undefined;
  } catch {
    return undefined;
  }
}
