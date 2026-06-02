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
    return { url: process.env.VIDEO_API_URL, apiKey: process.env.VIDEO_API_KEY, model: process.env.VIDEO_MODEL };
  }
  if (kind === 'audio') {
    return { url: process.env.AUDIO_API_URL || process.env.TTS_API_URL, apiKey: process.env.AUDIO_API_KEY || process.env.TTS_API_KEY, model: process.env.AUDIO_MODEL || process.env.TTS_MODEL };
  }
  return { url: process.env.VOICE_CLONE_API_URL, apiKey: process.env.VOICE_CLONE_API_KEY, model: process.env.VOICE_CLONE_MODEL };
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
  return String(data?.b64_json || data?.audio_base64 || data?.video_base64 || data?.data?.[0]?.b64_json || '');
}

function mediaMime(kind: MediaKind) {
  return kind === 'video' ? 'video/mp4' : 'audio/mpeg';
}

export async function generateMedia(payload: MediaRequestPayload) {
  const cfg = configFor(payload.kind);
  if (!cfg.url || !cfg.apiKey) {
    return {
      configured: false,
      error: `${payload.kind} provider is not configured`,
      requiredEnv: requiredEnv(payload.kind),
    };
  }

  const body = {
    model: cfg.model,
    prompt: payload.prompt,
    text: payload.text || payload.prompt,
    input_url: payload.inputUrl,
    image: payload.inputUrl,
    voice_sample: payload.voiceSample,
    reference_audio: payload.voiceSample,
    style: payload.style,
    duration: payload.duration,
    aspect_ratio: payload.aspectRatio,
    response_format: 'url',
  };

  const resp = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!resp.ok) throw new Error(data?.error?.message || data?.error || data?.message || `Provider HTTP ${resp.status}`);

  const url = pickOutputUrl(data);
  const b64 = pickBase64(data);
  if (url) return { configured: true, url, model: cfg.model || data?.model || '', raw: data };
  if (b64) return { configured: true, url: `data:${mediaMime(payload.kind)};base64,${b64}`, model: cfg.model || data?.model || '', raw: data };
  throw new Error('Provider returned no media URL');
}

export function requiredEnv(kind: MediaKind) {
  if (kind === 'video') return ['VIDEO_API_URL', 'VIDEO_API_KEY', 'VIDEO_MODEL'];
  if (kind === 'audio') return ['AUDIO_API_URL', 'AUDIO_API_KEY', 'AUDIO_MODEL'];
  return ['VOICE_CLONE_API_URL', 'VOICE_CLONE_API_KEY', 'VOICE_CLONE_MODEL'];
}
