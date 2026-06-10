import { AlipaySdk } from 'alipay-sdk';
import { PaymentOrder, siteUrl, moneyEq, markOrderPaid, updateOrder, getOrder } from './core';

function cleanKey(value: string) { return String(value || '').replace(/\\n/g, '\n').trim(); }
export function getAlipayConfig() {
  const appId = String(process.env.ALIPAY_APP_ID || '').trim();
  const privateKey = cleanKey(process.env.ALIPAY_PRIVATE_KEY || '');
  const alipayPublicKey = cleanKey(process.env.ALIPAY_PUBLIC_KEY || '');
  const gateway = String(process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do').trim();
  if (!appId || !privateKey || !alipayPublicKey) throw new Error('支付宝尚未配置：请设置 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY');
  return { appId, privateKey, alipayPublicKey, gateway };
}
export function getAlipaySdk() {
  const cfg = getAlipayConfig();
  return new AlipaySdk({ appId: cfg.appId, privateKey: cfg.privateKey, alipayPublicKey: cfg.alipayPublicKey, gateway: cfg.gateway, keyType: (process.env.ALIPAY_KEY_TYPE as any) || 'PKCS8' });
}
export function buildAlipayUrl(order: PaymentOrder) {
  const sdk = getAlipaySdk();
  return sdk.pageExec('alipay.trade.page.pay', 'GET', {
    notifyUrl: `${siteUrl()}/api/pay/alipay/notify`,
    returnUrl: `${siteUrl()}/pay/result?out_trade_no=${encodeURIComponent(order.outTradeNo)}`,
    bizContent: {
      outTradeNo: order.outTradeNo,
      productCode: 'FAST_INSTANT_TRADE_PAY',
      totalAmount: order.money,
      subject: order.name,
      body: `EcomPic AI ${order.name}`,
      timeoutExpress: '30m',
    },
  } as any);
}
export function verifyAlipayNotify(params: Record<string, any>) {
  return getAlipaySdk().checkNotifySign(params);
}
export async function handleAlipayNotify(params: Record<string, any>) {
  const ok = verifyAlipayNotify(params);
  if (!ok) throw new Error('支付宝回调验签失败');
  const outTradeNo = String(params.out_trade_no || '');
  const tradeStatus = String(params.trade_status || '');
  const order = await getOrder(outTradeNo);
  if (!order) throw new Error('订单不存在');
  const nextNotifyCount = (order.notifyCount || 0) + 1;
  await updateOrder(outTradeNo, { notifyCount: nextNotifyCount, lastNotifyAt: new Date().toISOString(), rawNotify: params });
  if (!moneyEq(params.total_amount, order.money)) throw new Error('支付宝回调金额不一致');
  if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
    await markOrderPaid(outTradeNo, { tradeNo: String(params.trade_no || ''), rawNotify: params, notifyCount: nextNotifyCount, lastNotifyAt: new Date().toISOString() });
  }
  return true;
}
