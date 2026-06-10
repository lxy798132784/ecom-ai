import crypto from 'crypto';
import { kv } from '@vercel/kv';
import { normalizeEmail } from './users';

export type EzfpyPayType = 'alipay' | 'wxpay' | 'qqpay';
export type PaymentPack = {
  id: string;
  name: string;
  money: string;
  credits?: number;
  plan?: 'pro';
};

export type PaymentOrder = {
  outTradeNo: string;
  email: string;
  packId: string;
  name: string;
  money: string;
  credits?: number;
  plan?: 'pro';
  payType: EzfpyPayType;
  status: 'pending' | 'paid' | 'failed';
  createdAt: string;
  paidAt?: string;
  tradeNo?: string;
  rawNotify?: Record<string, any>;
};

export const PAYMENT_PACKS: PaymentPack[] = [
  { id: 'credits_50', name: '50积分包', money: '2.00', credits: 50 },
  { id: 'credits_200', name: '200积分包', money: '7.00', credits: 200 },
  { id: 'credits_500', name: '500积分包', money: '18.00', credits: 500 },
  { id: 'pro_monthly', name: 'PRO月付 · 2500积分/月', money: '75.00', plan: 'pro' },
];

export const PAY_TYPES: EzfpyPayType[] = ['alipay', 'wxpay', 'qqpay'];

export function getPaymentPack(id: string) {
  return PAYMENT_PACKS.find(p => p.id === id);
}

export function normalizePayType(type: any): EzfpyPayType {
  return PAY_TYPES.includes(type) ? type : 'alipay';
}

function env(name: string, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

export function siteUrl() {
  return env('NEXT_PUBLIC_SITE_URL', 'https://ecom-ai-five.vercel.app').replace(/\/+$/, '');
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

export function orderKey(outTradeNo: string) {
  return `pay:ezfpy:order:${outTradeNo}`;
}

export function userOrdersKey(email: string) {
  return `pay:ezfpy:user:${normalizeEmail(email)}`;
}

export function createOutTradeNo() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `ECOM${stamp}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function saveOrder(order: PaymentOrder) {
  await kv.set(orderKey(order.outTradeNo), order);
  await kv.lpush(userOrdersKey(order.email), order.outTradeNo);
  await kv.ltrim(userOrdersKey(order.email), 0, 49);
  return order;
}

export async function getOrder(outTradeNo: string): Promise<PaymentOrder | null> {
  return (await kv.get<PaymentOrder>(orderKey(outTradeNo))) || null;
}

export async function markOrderPaid(outTradeNo: string, patch: Partial<PaymentOrder>) {
  const order = await getOrder(outTradeNo);
  if (!order) return null;
  const updated: PaymentOrder = { ...order, ...patch, status: 'paid', paidAt: patch.paidAt || new Date().toISOString() };
  await kv.set(orderKey(outTradeNo), updated);
  return updated;
}

export async function applyPaidOrder(order: PaymentOrder) {
  const email = normalizeEmail(order.email);
  if (order.credits) {
    const current = (await kv.get<number>(`credits:${email}`)) || 0;
    await kv.set(`credits:${email}`, current + order.credits);
  }
  if (order.plan === 'pro') {
    const user = await kv.hget('users', email) as any;
    if (user) {
      user.plan = 'pro';
      await kv.hset('users', { [email]: user });
    }
  }
}

export function buildSubmitUrl(order: PaymentOrder) {
  const cfg = getEzfpyConfig();
  const params: Record<string, string> = {
    pid: cfg.pid,
    type: order.payType,
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
