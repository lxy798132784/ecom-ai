import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { findUserByEmail, writeUser } from '../../lib/users';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { email, name, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '邮箱和密码不能为空' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });

    const exists = await findUserByEmail(email);
    if (exists) return res.status(409).json({ error: '该邮箱已注册' });

    const hashed = await bcrypt.hash(password, 10);
    await writeUser({
      id: `u_${Date.now()}`,
      email,
      name: name || email.split('@')[0],
      password: hashed,
      plan: 'free',
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({ ok: true, message: '注册成功' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
