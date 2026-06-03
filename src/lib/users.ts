import { kv } from '@vercel/kv';

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  plan: string;
  createdAt: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const user = await kv.hget('users', normalizeEmail(email));
  return user as User | undefined;
}

export async function writeUser(user: User) {
  const email = normalizeEmail(user.email);
  await kv.hset('users', { [email]: { ...user, email } });
}
