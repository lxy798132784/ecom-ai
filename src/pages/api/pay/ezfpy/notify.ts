import { NextApiRequest, NextApiResponse } from 'next';
import { applyPaidOrder, getEzfpyConfig, getOrder, markOrderPaid, verifySign } from '../../../../lib/ezfpy';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).send('method not allowed');
  try {
    const params: Record<string, any> = { ...(req.method === 'GET' ? req.query : req.body) };
    const cfg = getEzfpyConfig();
    if (!verifySign(params, cfg.key)) return res.status(401).send('fail');
    if (String(params.trade_status || '') !== 'TRADE_SUCCESS') return res.status(400).send('fail');

    const outTradeNo = String(params.out_trade_no || '');
    const order = await getOrder(outTradeNo);
    if (!order) return res.status(404).send('fail');
    if (String(params.pid || '') !== cfg.pid) return res.status(400).send('fail');
    if (Number(params.money || 0).toFixed(2) !== Number(order.money).toFixed(2)) return res.status(400).send('fail');

    if (order.status !== 'paid') {
      const paidOrder = await markOrderPaid(outTradeNo, {
        tradeNo: String(params.trade_no || ''),
        rawNotify: params,
        paidAt: new Date().toISOString(),
      });
      if (!paidOrder) return res.status(404).send('fail');
      await applyPaidOrder(paidOrder);
    }
    return res.status(200).send('success');
  } catch (e) {
    console.error('ezfpy notify error', e);
    return res.status(500).send('fail');
  }
}
