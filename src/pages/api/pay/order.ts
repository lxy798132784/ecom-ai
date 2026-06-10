import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { getOrder } from '../../../lib/payments/core';
import { normalizeEmail } from '../../../lib/users';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });
  const order = await getOrder(String(req.query.out_trade_no || ''));
  if (!order || normalizeEmail(order.email) !== normalizeEmail(String(token.email))) return res.status(404).json({ error: '订单不存在' });
  return res.json({ order });
}
