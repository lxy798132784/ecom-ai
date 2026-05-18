import fs from 'fs';
import path from 'path';

const USER_FILE = path.join(process.cwd(), 'data', 'users.json');

interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  plan: string;
  createdAt: string;
}

export function readUsers(): User[] {
  try {
    if (!fs.existsSync(USER_FILE)) return [];
    const raw = fs.readFileSync(USER_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function writeUsers(users: User[]) {
  const dir = path.dirname(USER_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2));
}

export function findUserByEmail(email: string): User | undefined {
  return readUsers().find(u => u.email === email);
}
