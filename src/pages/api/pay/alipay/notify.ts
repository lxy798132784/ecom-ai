import { NextApiRequest, NextApiResponse } from 'next';
import { handleAlipayNotify } from '../../../../lib/payments/alipay';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).send('fail');
  try {
    const params = req.method === 'POST' ? req.body : req.query;
    await handleAlipayNotify(params as any);
    return res.status(200).send('success');
  } catch (e) {
    console.error('alipay notify error', e);
    return res.status(400).send('fail');
  }
}
