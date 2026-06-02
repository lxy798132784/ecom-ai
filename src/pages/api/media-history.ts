import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { normalizeEmail } from '../../lib/users';
import { getMediaHistory, removeMediaHistory } from '../../lib/mediaStore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: 'Please sign in first' });
  const email = normalizeEmail(String(token.email));
  if (req.method === 'GET') return res.json({ items: await getMediaHistory(email) });
  if (req.method === 'DELETE') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    return res.json({ items: await removeMediaHistory(email, String(body.id || body.url || '')) });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
