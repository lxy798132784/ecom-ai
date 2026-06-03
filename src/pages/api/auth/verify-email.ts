import { NextApiRequest, NextApiResponse } from 'next';
import { kv } from '@vercel/kv';
import { findUserByEmail, writeUser, normalizeEmail } from '../../../lib/users';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: '验证链接缺少 token' });

    const email = await kv.get<string>(`verify-email:${token}`);
    if (!email) return res.status(400).json({ error: '验证链接已过期或无效，请重新发送' });

    const user = await findUserByEmail(normalizeEmail(email));
    if (!user) return res.status(404).json({ error: '用户不存在' });

    user.emailVerified = true;
    user.emailVerifiedAt = new Date().toISOString();
    await writeUser(user);
    await kv.del(`verify-email:${token}`);

    return res.json({ ok: true, message: '邮箱验证成功' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
