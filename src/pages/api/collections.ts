import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { normalizeEmail } from '../../lib/users';
import { addUrlToCollection, createCollection, getCollections, removeUrlFromCollection, saveCollections } from '../../lib/collectionsStore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: 'Please sign in first' });
  const email = normalizeEmail(String(token.email));

  try {
    if (req.method === 'GET') {
      return res.json({ items: await getCollections(email) });
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (Array.isArray(body.items)) return res.json({ items: await saveCollections(email, body.items) });
      if (body.collectionId && body.url) return res.json({ items: await addUrlToCollection(email, String(body.collectionId), String(body.url)) });
      return res.json({ items: await createCollection(email, String(body.name || 'Collection')) });
    }
    if (req.method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (body.collectionId && body.url) return res.json({ items: await removeUrlFromCollection(email, String(body.collectionId), String(body.url)) });
      const items = (await getCollections(email)).filter(c => c.id !== String(body.collectionId || body.id || ''));
      return res.json({ items: await saveCollections(email, items) });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Collection operation failed' });
  }
}
