import { NextApiRequest, NextApiResponse } from 'next';
import { handleWechatNotify } from '../../../../lib/payments/wechat';

export const config = { api: { bodyParser: false } };
async function readRaw(req: NextApiRequest) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ code: 'FAIL', message: 'Method not allowed' });
  try {
    const raw = await readRaw(req);
    await handleWechatNotify(req.headers as any, raw);
    return res.status(204).end();
  } catch (e: any) {
    console.error('wechat notify error', e);
    return res.status(400).json({ code: 'FAIL', message: e.message || '失败' });
  }
}
