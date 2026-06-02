import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

import { normalizeEmail } from '../../lib/users';
import { addGalleryImage, getGalleryItems, itemUrls, removeGalleryImage } from '../../lib/galleryStore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });

  const rawEmail = String(token.email);
  const email = normalizeEmail(rawEmail);

  if (req.method === 'GET') {
    const items = await getGalleryItems(email, 'favorites');
    return res.json({ favorites: itemUrls(items), items });
  }

  if (req.method === 'POST') {
    const { url, ...meta } = req.body || {};
    if (!url) return res.status(400).json({ error: '缺少url' });
    const existing = await getGalleryItems(email, 'favorites');
    const id = String(meta.id || '');
    const already = existing.some(x => x.url === String(url) || (id && x.id === id));
    if (already) {
      const items = await removeGalleryImage(email, rawEmail, 'favorites', String(url), id);
      return res.json({ ok: true, added: false, favorites: itemUrls(items), items });
    }
    const saved = await addGalleryImage(email, rawEmail, 'favorites', String(url), meta || {});
    return res.json({ ok: true, added: true, favorites: itemUrls(saved.items), items: saved.items, url: saved.url, id: saved.id });
  }

  if (req.method === 'DELETE') {
    const { url, id } = req.body || {};
    if (!url && !id) return res.status(400).json({ error: '缺少图片ID' });
    const items = await removeGalleryImage(email, rawEmail, 'favorites', String(url || ''), String(id || ''));
    return res.json({ ok: true, deleted: true, favorites: itemUrls(items), items });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
