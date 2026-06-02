import { NextApiRequest, NextApiResponse } from 'next';
import { clearAdminCookie, createAdminSession, setAdminCookie, validateAdminCredentials, verifyAdminSession } from '../../../lib/adminAuth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const admin = verifyAdminSession(req);
    return res.json({ loggedIn: Boolean(admin), email: admin?.email || '' });
  }

  if (req.method === 'POST') {
    const { email, password } = req.body || {};
    if (!validateAdminCredentials(String(email || ''), String(password || ''))) {
      return res.status(401).json({ error: '后台账号或密码错误' });
    }
    const token = createAdminSession(String(email || '').trim().toLowerCase());
    setAdminCookie(res, token);
    return res.json({ ok: true, email: String(email || '').trim().toLowerCase() });
  }

  if (req.method === 'DELETE') {
    clearAdminCookie(res);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
