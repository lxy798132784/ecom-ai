import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../lib/adminAuth';
import { buildStoredImageProvider, listPublicImageProviders, listStoredImageProviders, saveStoredImageProviders } from '../../../lib/imageProviders';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const providers = await listPublicImageProviders();
    return res.json({ ok: true, providers });
  }

  if (req.method === 'POST') {
    try {
      const rows = await listStoredImageProviders();
      const provider = buildStoredImageProvider(req.body || {});
      await saveStoredImageProviders([...rows, provider]);
      return res.status(201).json({ ok: true, providers: await listPublicImageProviders() });
    } catch (e: any) {
      return res.status(400).json({ error: e.message || '保存失败' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const body = req.body || {};
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ error: '缺少 provider id' });
      const rows = await listStoredImageProviders();
      const idx = rows.findIndex(row => row.id === id);
      if (idx < 0) return res.status(404).json({ error: '配置不存在' });
      rows[idx] = buildStoredImageProvider(body, rows[idx]);
      await saveStoredImageProviders(rows);
      return res.json({ ok: true, providers: await listPublicImageProviders() });
    } catch (e: any) {
      return res.status(400).json({ error: e.message || '保存失败' });
    }
  }

  if (req.method === 'DELETE') {
    const id = String((req.body || {}).id || '');
    if (!id) return res.status(400).json({ error: '缺少 provider id' });
    const rows = await listStoredImageProviders();
    await saveStoredImageProviders(rows.filter(row => row.id !== id));
    return res.json({ ok: true, providers: await listPublicImageProviders() });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
