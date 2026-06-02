import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { generateMedia, requiredEnv } from '../../lib/multimodal';

export const config = { api: { bodyParser: { sizeLimit: '50mb' }, maxDuration: 60 } };

type MediaKind = 'video' | 'audio' | 'voice-clone';

function isKind(value: any): value is MediaKind {
  return value === 'video' || value === 'audio' || value === 'voice-clone';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const kind = body.kind;
  if (!isKind(kind)) return res.status(400).json({ error: 'Unsupported media kind' });
  const prompt = String(body.prompt || body.text || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const result = await generateMedia({
      kind,
      prompt,
      text: String(body.text || prompt),
      inputUrl: body.inputUrl ? String(body.inputUrl) : undefined,
      voiceSample: body.voiceSample ? String(body.voiceSample) : undefined,
      style: body.style ? String(body.style) : undefined,
      duration: Number(body.duration || 5),
      aspectRatio: String(body.aspectRatio || '16:9'),
    });
    if (!result.configured) {
      return res.status(501).json({ error: '该功能已预留，等待 Vercel 配置服务商 URL 和 Key', requiredEnv: requiredEnv(kind) });
    }
    return res.json({ ok: true, kind, ...result });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Media generation failed', requiredEnv: requiredEnv(kind) });
  }
}
