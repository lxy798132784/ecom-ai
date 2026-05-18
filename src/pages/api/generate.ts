import { NextApiRequest, NextApiResponse } from 'next';
import { removeBackground, generateLifestyleScene } from '../../lib/ai';

export const config = { api: { bodyParser: { sizeLimit: '50mb' }, maxDuration: 60 } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body: any;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body - image too large? Try a smaller image.' });
  }

  try {
    const { image, action, scene, prompt } = body;
    if (!image) return res.status(400).json({ error: 'No image provided' });

    let url = '';
    if (action === 'whitebg') {
      url = await removeBackground(image, prompt || '');
    } else if (action === 'scene') {
      if (!scene) return res.status(400).json({ error: 'Scene required' });
      url = await generateLifestyleScene(image, scene, prompt || '');
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    if (!url) return res.status(500).json({ error: 'AI returned no image URL' });
    console.log('Generated URL length:', url.length);
    return res.json({ url });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Generation failed' });
  }
}
