/**
 * GET /api/admin/provider-models?kind=video&providerId=xxx
 *
 * Calls the provider's /v1/models endpoint (OpenAI-compatible) and returns
 * the list of available models. Used by the admin UI for "获取模型列表".
 *
 * Also supports a raw URL: GET /api/admin/provider-models?url=xxx&apiKey=xxx
 */
import { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '../../../lib/adminAuth';
import { listProviders, decrypt, normalizeBaseURL } from '../../../lib/providerConfig';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { kind, providerId, url: rawUrl, apiKey: rawKey } = req.query;
  const kindStr = String(kind || '');
  const providerIdStr = String(providerId || '');

  let providerBaseURL: string;
  let providerApiKey: string;

  if (rawUrl && rawKey) {
    // Raw mode
    providerBaseURL = String(rawUrl).trim().replace(/\/+$/, '');
    providerApiKey = String(rawKey);
  } else if (providerIdStr && kindStr) {
    // From KV store
    const rows = await listProviders(kindStr as 'image' | 'video' | 'audio' | 'voice-clone');
    const row = rows.find(r => r.id === providerIdStr);
    if (!row) return res.status(404).json({ error: 'Provider not found' });
    providerBaseURL = normalizeBaseURL(row.baseURL);
    providerApiKey = decrypt(row.apiKeyEnc);
    if (!providerApiKey) return res.status(400).json({ error: 'Provider has no API key' });
  } else {
    return res.status(400).json({ error: '缺少参数: 需要 providerId+kind 或 url+apiKey' });
  }

  try {
    const response = await fetch(`${providerBaseURL}/v1/models`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providerApiKey}`,
      },
    });

    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return res.status(502).json({ error: `Provider 返回了无效的 JSON: ${text.slice(0, 200)}` });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || data?.error || data?.message || `HTTP ${response.status}`,
        raw: data,
      });
    }

    // Standard OpenAI-compatible format: { data: [{ id, object, owned_by, ... }] }
    const models = (data?.data || []).map((m: any) => ({
      id: String(m.id || ''),
      object: m.object || 'model',
      ownedBy: m.owned_by || m.ownedBy || '',
      created: m.created ? new Date(m.created * 1000).toISOString() : '',
    }));

    return res.json({
      ok: true,
      providerName: data?.data?.[0]?.id || providerBaseURL,
      models,
      count: models.length,
    });
  } catch (e: any) {
    const msg = e?.message || String(e || 'unknown');
    if (msg.includes('Invalid URL') || msg.includes('Unsupported protocol')) {
      return res.status(400).json({ error: `URL 格式无效: ${msg}` });
    }
    return res.status(502).json({ error: `无法连接 Provider: ${msg}` });
  }
}
