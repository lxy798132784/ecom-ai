import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { buildAlipayUrl } from '../../../../lib/payments/alipay';
import { createOutTradeNo, getClientIp, getPaymentPack, PaymentOrder, saveOrder } from '../../../../lib/payments/core';
import { normalizeEmail } from '../../../../lib/users';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });
  try {
    const pack = getPaymentPack(String(req.body?.packId || ''));
    if (!pack) return res.status(400).json({ error: '无效的积分包' });
    const createdAt = new Date();
    const order: PaymentOrder = {
      outTradeNo: createOutTradeNo('ALI'), email: normalizeEmail(String(token.email)), packId: pack.id, name: pack.name, money: pack.money,
      credits: pack.credits, plan: pack.plan, provider: 'alipay', channel: 'alipay', status: 'pending', createdAt: createdAt.toISOString(),
      expireAt: new Date(createdAt.getTime() + 30 * 60 * 1000).toISOString(), clientIp: getClientIp(req), userAgent: String(req.headers['user-agent'] || ''), notifyCount: 0,
    };
    await saveOrder(order);
    return res.json({ ok: true, order, payUrl: buildAlipayUrl(order), mode: 'redirect' });
  } catch (e: any) {
    console.error('alipay create error', e);
    return res.status(500).json({ error: e.message || '创建支付宝订单失败' });
  }
}
