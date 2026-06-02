import { NextApiRequest, NextApiResponse } from 'next';
import { requiredEnv } from '../../lib/multimodal';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const video = Boolean(process.env.VIDEO_API_URL && process.env.VIDEO_API_KEY);
  const audio = Boolean((process.env.AUDIO_API_URL || process.env.TTS_API_URL) && (process.env.AUDIO_API_KEY || process.env.TTS_API_KEY));
  const voiceClone = Boolean(process.env.VOICE_CLONE_API_URL && process.env.VOICE_CLONE_API_KEY);
  return res.json({
    video: { configured: video, requiredEnv: requiredEnv('video') },
    audio: { configured: audio, requiredEnv: requiredEnv('audio') },
    voiceClone: { configured: voiceClone, requiredEnv: requiredEnv('voice-clone') },
  });
}
