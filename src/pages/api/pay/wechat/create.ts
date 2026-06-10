import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { createWechatPayment } from '../../../../lib/payments/wechat';
import { createOutTradeNo, getClientIp, getPaymentPack, PaymentOrder, saveOrder } from '../../../../lib/payments/core';
import { normalizeEmail } from '../../../../lib/users';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });
  try {
    const pack = getPaymentPack(String(req.body?.packId || ''));
    if (!pack) return res.status(400).json({ error: '无效的积分包' });
    const mode = req.body?.mode === 'h5' ? 'wechat_h5' : 'wechat_native';
    const createdAt = new Date();
    const order: PaymentOrder = {
      outTradeNo: createOutTradeNo('WX'), email: normalizeEmail(String(token.email)), packId: pack.id, name: pack.name, money: pack.money,
      credits: pack.credits, plan: pack.plan, provider: 'wechat', channel: mode, status: 'pending', createdAt: createdAt.toISOString(),
      expireAt: new Date(createdAt.getTime() + 30 * 60 * 1000).toISOString(), clientIp: getClientIp(req), userAgent: String(req.headers['user-agent'] || ''), notifyCount: 0,
    };
    await saveOrder(order);
    const payment = await createWechatPayment(order);
    return res.json({ ok: true, order, ...payment, mode: mode === 'wechat_native' ? 'qr' : 'redirect' });
  } catch (e: any) {
    console.error('wechat create error', e);
    return res.status(500).json({ error: e.message || '创建微信支付订单失败' });
  }
}
