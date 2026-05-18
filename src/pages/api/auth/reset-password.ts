import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';
import { findUserByEmail, writeUser } from '../../../lib/users';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: '参数缺失' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });

    const email = await kv.get<string>(`reset:${token}`);
    if (!email) return res.status(400).json({ error: '链接已过期或无效，请重新申请' });

    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    await writeUser(user);

    // Delete the used token
    await kv.del(`reset:${token}`);

    return res.json({ ok: true, message: '密码已重置，请重新登录' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
