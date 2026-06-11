import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../lib/adminAuth';
import {
  buildStoredProvider,
  listProviders,
  saveProviders,
  listPublicProviders,
} from '../../../lib/providerConfig';

type Kind = 'image' | 'video' | 'audio' | 'voice-clone';

const KIND_QUERY_KEY: Record<string, Kind> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  voice_clone: 'voice-clone',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const kind = KIND_QUERY_KEY[String(req.query.kind || '')] || 'video';

  if (req.method === 'GET') {
    const providers = await listPublicProviders(kind);
    return res.json({ ok: true, kind, providers });
  }

  if (req.method === 'POST') {
    try {
      const rows = await listProviders(kind);
      const provider = buildStoredProvider(req.body || {});
      await saveProviders(kind, [...rows, provider]);
      return res
        .status(201)
        .json({ ok: true, kind, providers: await listPublicProviders(kind) });
    } catch (e: any) {
      return res.status(400).json({ error: e.message || '保存失败' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const body = req.body || {};
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ error: '缺少 provider id' });
      const rows = await listProviders(kind);
      const idx = rows.findIndex((row) => row.id === id);
      if (idx < 0) return res.status(404).json({ error: '配置不存在' });
      rows[idx] = buildStoredProvider(body, rows[idx]);
      await saveProviders(kind, rows);
      return res.json({
        ok: true,
        kind,
        providers: await listPublicProviders(kind),
      });
    } catch (e: any) {
      return res.status(400).json({ error: e.message || '保存失败' });
    }
  }

  if (req.method === 'DELETE') {
    const id = String((req.body || {}).id || '');
    if (!id) return res.status(400).json({ error: '缺少 provider id' });
    const rows = await listProviders(kind);
    await saveProviders(kind, rows.filter((row) => row.id !== id));
    return res.json({ ok: true, kind, providers: await listPublicProviders(kind) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
