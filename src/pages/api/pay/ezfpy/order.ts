import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getOrder } from '../../../../lib/ezfpy';
import { normalizeEmail } from '../../../../lib/users';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });
  const outTradeNo = String(req.query.out_trade_no || '');
  if (!outTradeNo) return res.status(400).json({ error: '缺少订单号' });
  const order = await getOrder(outTradeNo);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (order.email !== normalizeEmail(String(token.email))) return res.status(403).json({ error: '无权查看该订单' });
  return res.json({ order });
}
