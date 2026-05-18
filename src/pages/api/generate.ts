import { NextApiRequest, NextApiResponse } from 'next';
import { removeBackground, generateLifestyleScene } from '../../lib/ai';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { image, action, scene } = req.body;

    if (action === 'whitebg') {
      const url = await removeBackground(image);
      return res.json({ url });
    }

    if (action === 'scene') {
      if (!scene) return res.status(400).json({ error: 'Scene required' });
      const url = await generateLifestyleScene(image, scene);
      return res.json({ url });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Generation failed' });
  }
}
