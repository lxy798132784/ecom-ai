import crypto from 'crypto';
import { PaymentOrder, PAYMENT_PACKS, PaymentPack, createOutTradeNo, getOrder, saveOrder, markOrderPaid, getPaymentPack, siteUrl } from './payments/core';

export type EzfpyPayType = 'alipay' | 'wxpay' | 'qqpay';
export type { PaymentOrder, PaymentPack };
export { PAYMENT_PACKS, createOutTradeNo, getOrder, saveOrder, markOrderPaid, getPaymentPack };

export const PAY_TYPES: EzfpyPayType[] = ['alipay', 'wxpay', 'qqpay'];

export function normalizePayType(type: any): EzfpyPayType {
  return PAY_TYPES.includes(type) ? type : 'alipay';
}

function env(name: string, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

export function ezfpyBaseUrl() {
  return env('EZFPY_BASE_URL', 'https://www.ezfpy.cn').replace(/\/+$/, '');
}

export function getEzfpyConfig() {
  const pid = env('EZFPY_PID');
  const key = env('EZFPY_KEY');
  if (!pid || !key) throw new Error('支付尚未配置：请在 Vercel 设置 EZFPY_PID 和 EZFPY_KEY');
  return { pid, key, baseUrl: ezfpyBaseUrl(), site: siteUrl() };
}

export function getVerifyParams(params: Record<string, any>) {
  return Object.keys(params)
    .filter(key => key !== 'sign' && key !== 'sign_type' && params[key] !== undefined && params[key] !== null && String(params[key]) !== '')
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
}

export function signParams(params: Record<string, any>, key: string) {
  return crypto.createHash('md5').update(getVerifyParams(params) + key).digest('hex');
}

export function verifySign(params: Record<string, any>, key: string) {
  const sign = String(params.sign || '').toLowerCase();
  if (!sign) return false;
  return signParams(params, key).toLowerCase() === sign;
}

export async function applyPaidOrder(_order: PaymentOrder) {
  // Backward compatibility shim. Fulfillment moved into payments/core.markOrderPaid for idempotency.
}

export function buildSubmitUrl(order: PaymentOrder) {
  const cfg = getEzfpyConfig();
  const params: Record<string, string> = {
    pid: cfg.pid,
    type: String(order.channel === 'wxpay' ? 'wxpay' : order.channel === 'qqpay' ? 'qqpay' : 'alipay'),
    out_trade_no: order.outTradeNo,
    notify_url: `${cfg.site}/api/pay/ezfpy/notify`,
    return_url: `${cfg.site}/pay/result?out_trade_no=${encodeURIComponent(order.outTradeNo)}`,
    name: order.name,
    money: order.money,
    sitename: 'Ecom AI',
  };
  const sign = signParams(params, cfg.key);
  const urlParams = new URLSearchParams({ ...params, sign, sign_type: 'MD5' });
  return `${cfg.baseUrl}/submit.php?${urlParams.toString()}`;
}
