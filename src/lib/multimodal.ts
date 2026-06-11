import { RuntimeProvider, getActiveProviders } from './providerConfig';

type MediaKind = 'video' | 'audio' | 'voice-clone';

interface ProviderConfig {
  url?: string;
  apiKey?: string;
  model?: string;
}

interface MediaRequestPayload {
  kind: MediaKind;
  prompt: string;
  inputUrl?: string;
  voiceSample?: string;
  text?: string;
  style?: string;
  duration?: number;
  aspectRatio?: string;
}

function configFor(kind: MediaKind): ProviderConfig {
  if (kind === 'video') {
    return {
      url: process.env.VIDEO_API_URL,
      apiKey: process.env.VIDEO_API_KEY,
      model: process.env.VIDEO_MODEL,
    };
  }
  if (kind === 'audio') {
    return {
      url: process.env.AUDIO_API_URL || process.env.TTS_API_URL,
      apiKey: process.env.AUDIO_API_KEY || process.env.TTS_API_KEY,
      model: process.env.AUDIO_MODEL || process.env.TTS_MODEL,
    };
  }
  return {
    url: process.env.VOICE_CLONE_API_URL,
    apiKey: process.env.VOICE_CLONE_API_KEY,
    model: process.env.VOICE_CLONE_MODEL,
  };
}

function pickOutputUrl(data: any): string {
  return String(
    data?.url ||
      data?.output_url ||
      data?.video_url ||
      data?.audio_url ||
      data?.file_url ||
      data?.result?.url ||
      data?.result?.output_url ||
      data?.data?.url ||
      data?.data?.[0]?.url ||
      ''
  );
}

function pickBase64(data: any): string {
  return String(
    data?.b64_json ||
      data?.audio_base64 ||
      data?.video_base64 ||
      data?.data?.[0]?.b64_json ||
      ''
  );
}

function mediaMime(kind: MediaKind) {
  return kind === 'video' ? 'video/mp4' : 'audio/mpeg';
}

function buildClient(provider: RuntimeProvider) {
  return {
    url: provider.baseURL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
  };
}

async function withProviderFallback<T>(
  kind: MediaKind,
  operation: (
    provider: RuntimeProvider,
    envCfg: ProviderConfig
  ) => Promise<T>
): Promise<{ value: T; provider: RuntimeProvider; attempts: number }> {
  const providers = await getActiveProviders(kind);
  if (!providers.length) {
    // Fall back to env-only if no providers configured
    const envCfg = configFor(kind);
    if (envCfg.url && envCfg.apiKey) {
      const envProvider: RuntimeProvider = {
        id: 'env-fallback',
        name: 'env-fallback',
        baseURL: envCfg.url,
        model: envCfg.model || '',
        apiKey: envCfg.apiKey,
        enabled: true,
        priority: 9999,
      };
      try {
        const value = await operation(envProvider, envCfg);
        return { value, provider: envProvider, attempts: 1 };
      } catch (e: any) {
        const msg = e?.message || e?.error?.message || String(e || 'unknown');
        throw new Error(`环境变量配置回退也失败：${msg}`);
      }
    }
    throw new Error(`未配置 ${kind} 模型`);
  }

  const envCfg = configFor(kind);
  const errors: string[] = [];
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    try {
      const value = await operation(provider, envCfg);
      return { value, provider, attempts: i + 1 };
    } catch (e: any) {
      const msg = e?.message || e?.error?.message || String(e || 'unknown error');
      errors.push(`${provider.name || provider.id}: ${msg}`);
      console.error('media provider failed', {
        kind,
        provider: provider.name || provider.id,
        baseURL: provider.baseURL,
        model: provider.model,
        message: msg,
      });
    }
  }
  throw new Error(`所有 ${kind} 模型均失败：${errors.slice(0, 3).join('；')}`);
}

export async function generateMedia(payload: MediaRequestPayload) {
  const envCfg = configFor(payload.kind);

  // Check env-only first
  if (!envCfg.url || !envCfg.apiKey) {
    // No env fallback; check if providers exist
    const providers = await getActiveProviders(payload.kind);
    if (!providers.length) {
      return {
        configured: false,
        error: `该功能暂未启用，请稍后再试`,
        requiredEnv: requiredEnv(payload.kind),
      };
    }
  }

  let result: any;
  let usedProvider: RuntimeProvider | undefined;

  try {
    const r = await withProviderFallback(payload.kind, async (provider) => {
      const client = buildClient(provider);
      const body = {
        model: provider.model || envCfg.model,
        prompt: payload.prompt,
        text: payload.text || payload.prompt,
        input_url: payload.inputUrl,
        image: payload.inputUrl,
        voice_sample: payload.voiceSample,
        reference_audio: payload.voiceSample,
        style: payload.style,
        duration: payload.duration,
        aspect_ratio: payload.aspectRatio,
      };

      // POST to /v1/chat/completions on the provider's base URL
      const baseURL = provider.baseURL.replace(/\/+$/, '');
      const fullURL = `${baseURL}/v1/chat/completions`;

      const resp = await fetch(fullURL, {
        method: 'POST',
        headers: client.headers,
        body: JSON.stringify(body),
      });

      const text = await resp.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }
      if (!resp.ok)
        throw new Error(
          data?.error?.message || data?.error || data?.message || `Provider HTTP ${resp.status}`
        );

      const url = pickOutputUrl(data);
      const b64 = pickBase64(data);
      if (url) return { url, model: provider.model || data?.model || '', raw: data };
      if (b64)
        return {
          url: `data:${mediaMime(payload.kind)};base64,${b64}`,
          model: provider.model || data?.model || '',
          raw: data,
        };
      throw new Error('Provider returned no media URL');
    });
    result = r.value;
    usedProvider = r.provider;
  } catch (e: any) {
    throw new Error(e.message || '生成失败，请稍后重试');
  }

  return {
    configured: true,
    url: result.url,
    model: result.model || usedProvider?.model || '',
    provider: usedProvider?.name || '',
    raw: result.raw,
  };
}

export function requiredEnv(kind: MediaKind) {
  if (kind === 'video') return ['VIDEO_API_URL', 'VIDEO_API_KEY', 'VIDEO_MODEL'];
  if (kind === 'audio') return ['AUDIO_API_URL', 'AUDIO_API_KEY', 'AUDIO_MODEL'];
  return ['VOICE_CLONE_API_URL', 'VOICE_CLONE_API_KEY', 'VOICE_CLONE_MODEL'];
}
