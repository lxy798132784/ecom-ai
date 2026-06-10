import { NextApiRequest, NextApiResponse } from 'next';
import { getToken } from 'next-auth/jwt';
import { buildSubmitUrl, createOutTradeNo, getPaymentPack, normalizePayType, saveOrder, PaymentOrder, PAYMENT_PACKS, PAY_TYPES } from '../../../../lib/ezfpy';
import { normalizeEmail } from '../../../../lib/users';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return res.json({ packs: PAYMENT_PACKS, payTypes: PAY_TYPES });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = await getToken({ req });
  if (!token?.email) return res.status(401).json({ error: '请先登录' });

  try {
    const { packId, type } = req.body || {};
    const pack = getPaymentPack(String(packId || ''));
    if (!pack) return res.status(400).json({ error: '无效的积分包' });
    const email = normalizeEmail(String(token.email));
    const payType = normalizePayType(type);
    const order: PaymentOrder = {
      outTradeNo: createOutTradeNo(),
      email,
      packId: pack.id,
      name: pack.name,
      money: pack.money,
      credits: pack.credits,
      plan: pack.plan,
      payType,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await saveOrder(order);
    const payUrl = buildSubmitUrl(order);
    return res.json({ ok: true, order, payUrl });
  } catch (e: any) {
    console.error('ezfpy create error', e);
    return res.status(500).json({ error: e.message || '创建支付订单失败' });
  }
}
