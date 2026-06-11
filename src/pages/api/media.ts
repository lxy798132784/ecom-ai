import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { generateMedia } from '../../lib/multimodal';
import { addMediaHistory } from '../../lib/mediaStore';
import { normalizeEmail } from '../../lib/users';

export const config = { api: { bodyParser: { sizeLimit: '50mb' }, maxDuration: 120 } };

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
      return res.status(501).json({ error: '该功能暂未启用，请稍后再试' });
    }
    let mediaItems: any[] = [];
    const mediaResult = result as any;
    if (mediaResult.url) {
      mediaItems = await addMediaHistory(normalizeEmail(String(token.email)), {
        kind,
        url: mediaResult.url,
        prompt,
        inputUrl: body.inputUrl ? String(body.inputUrl) : undefined,
        model: mediaResult.model,
        provider: mediaResult.provider,
      }).catch(() => []);
    }
    return res.json({ ok: true, kind, ...result, mediaItems });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || '生成失败，请稍后重试' });
  }
}
