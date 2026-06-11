import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../lib/adminAuth';
import { checkConfigStatus } from '../../../lib/providerConfig';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const kinds = ['image', 'video', 'audio', 'voice-clone'] as const;
  const status: Record<string, any> = {};
  for (const kind of kinds) {
    status[kind] = checkConfigStatus(kind);
  }
  return res.json({ ok: true, kinds: status });
}
