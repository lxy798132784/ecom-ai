import { NextApiRequest, NextApiResponse } from 'next';
import { loadStoredImage } from '../../../lib/imageStore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const id = String(req.query.id || '');
  const stored = await loadStoredImage(id);
  if (!stored) return res.status(404).json({ error: 'Image not found' });
  const base64 = stored.dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(base64, 'base64');
  res.setHeader('Content-Type', stored.contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.status(200).send(buf);
}
