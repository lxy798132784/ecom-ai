import { kv } from '@vercel/kv';

interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  plan: string;
  createdAt: string;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const user = await kv.hget('users', email);
  return user as User | undefined;
}

export async function writeUser(user: User) {
  await kv.hset('users', { [user.email]: user });
}
