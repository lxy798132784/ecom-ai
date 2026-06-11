import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getActiveProviders } from '../../lib/providerConfig';
import { addMediaHistory } from '../../lib/mediaStore';
import { normalizeEmail } from '../../lib/users';

export const config = { api: { bodyParser: { sizeLimit: '1mb' }, maxDuration: 30 } };

type MediaKind = 'video' | 'audio' | 'voice-clone';

function isKind(value: any): value is MediaKind {
  return value === 'video' || value === 'audio' || value === 'voice-clone';
}

function pickVideoUrl(data: any): string {
  return String(
    data?.video_url ||
      data?.url ||
      data?.output_url ||
      data?.result?.video_url ||
      data?.result?.url ||
      data?.data?.video_url ||
      data?.data?.url ||
      ''
  );
}

async function parseResp(resp: Response): Promise<any> {
  const text = await resp.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET/POST only' });
  }
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });

  const source = req.method === 'GET' ? req.query : (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}));
  const kind = source.kind;
  const taskId = String(source.taskId || source.id || '').trim();
  const prompt = String(source.prompt || '').trim();
  const inputUrl = source.inputUrl ? String(source.inputUrl) : undefined;

  if (!isKind(kind)) return res.status(400).json({ error: 'Unsupported media kind' });
  if (!taskId) return res.status(400).json({ error: 'taskId is required' });
  if (kind !== 'video') return res.status(400).json({ error: 'Only video task polling is supported' });

  const providers = await getActiveProviders(kind);
  if (!providers.length) return res.status(501).json({ error: '该功能暂未启用，请稍后再试' });

  const errors: string[] = [];
  for (const provider of providers) {
    const baseURL = provider.baseURL.replace(/\/+$/, '');
    try {
      const resp = await fetch(`${baseURL}/v1/videos/${encodeURIComponent(taskId)}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
      });
      const data = await parseResp(resp);
      if (!resp.ok) {
        errors.push(`${provider.name || provider.id}: ${data?.error?.message || data?.error || data?.message || `HTTP ${resp.status}`}`);
        continue;
      }

      const status = String(data?.status || '').toLowerCase();
      if (status === 'completed' || status === 'succeeded' || status === 'success') {
        const url = pickVideoUrl(data);
        if (!url) return res.status(502).json({ error: '视频已完成但没有返回视频地址', raw: data });
        const mediaItems = await addMediaHistory(normalizeEmail(String(token.email)), {
          kind,
          url,
          prompt,
          inputUrl,
          model: data?.model || provider.model,
          provider: provider.name || provider.id,
        }).catch(() => []);
        return res.json({ ok: true, kind, status, completed: true, url, model: data?.model || provider.model, provider: provider.name || provider.id, raw: data, mediaItems });
      }
      if (status === 'failed' || status === 'error') {
        return res.status(502).json({ error: data?.error || '视频生成失败', raw: data });
      }
      return res.json({ ok: true, kind, status: status || 'queued', completed: false, taskId, raw: data });
    } catch (e: any) {
      errors.push(`${provider.name || provider.id}: ${e?.message || String(e)}`);
    }
  }

  return res.status(502).json({ error: `查询视频任务失败：${errors.slice(0, 3).join('；')}` });
}
