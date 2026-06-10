import crypto from 'crypto';
import { kv } from '@vercel/kv';
import { normalizeEmail } from '../users';

export type PaymentProvider = 'alipay' | 'wechat' | 'ezfpy';
export type PaymentChannel = 'alipay' | 'wechat_native' | 'wechat_h5' | 'wxpay' | 'qqpay';
export type PaymentPack = { id: string; name: string; money: string; credits?: number; plan?: 'pro' };
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'closed';
export type PaymentOrder = {
  outTradeNo: string;
  email: string;
  packId: string;
  name: string;
  money: string;
  credits?: number;
  plan?: 'pro';
  provider: PaymentProvider;
  channel: PaymentChannel;
  status: PaymentStatus;
  createdAt: string;
  expireAt: string;
  paidAt?: string;
  tradeNo?: string;
  clientIp?: string;
  userAgent?: string;
  notifyCount?: number;
  lastNotifyAt?: string;
  rawNotify?: Record<string, any>;
};

export const PAYMENT_PACKS: PaymentPack[] = [
  { id: 'credits_50', name: '50积分包', money: '2.00', credits: 50 },
  { id: 'credits_200', name: '200积分包', money: '7.00', credits: 200 },
  { id: 'credits_500', name: '500积分包', money: '18.00', credits: 500 },
  { id: 'pro_monthly', name: 'PRO月付 · 2500积分/月', money: '75.00', plan: 'pro' },
];

export function getPaymentPack(id: string) { return PAYMENT_PACKS.find(p => p.id === id); }
export function siteUrl() { return String(process.env.NEXT_PUBLIC_SITE_URL || 'https://ecom-ai-five.vercel.app').trim().replace(/\/+$/, ''); }
export function createOutTradeNo(prefix = 'ECOM') {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${prefix}${stamp}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}
export function orderKey(outTradeNo: string) { return `pay:order:${outTradeNo}`; }
export function legacyEzfpyOrderKey(outTradeNo: string) { return `pay:ezfpy:order:${outTradeNo}`; }
export function userOrdersKey(email: string) { return `pay:user:${normalizeEmail(email)}`; }
export function cents(money: string) { return Math.round(Number(money) * 100); }
export function moneyEq(a: any, b: any) { return Number(a).toFixed(2) === Number(b).toFixed(2); }

export function getClientIp(req: any) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || '';
}

export async function saveOrder(order: PaymentOrder) {
  await kv.set(orderKey(order.outTradeNo), order);
  await kv.lpush(userOrdersKey(order.email), order.outTradeNo);
  await kv.ltrim(userOrdersKey(order.email), 0, 49);
  return order;
}

export async function getOrder(outTradeNo: string): Promise<PaymentOrder | null> {
  const current = await kv.get<PaymentOrder>(orderKey(outTradeNo));
  if (current) return current;
  return (await kv.get<PaymentOrder>(legacyEzfpyOrderKey(outTradeNo))) || null;
}

export async function updateOrder(outTradeNo: string, patch: Partial<PaymentOrder>) {
  const order = await getOrder(outTradeNo);
  if (!order) return null;
  const updated = { ...order, ...patch } as PaymentOrder;
  await kv.set(orderKey(outTradeNo), updated);
  return updated;
}

export async function markOrderPaid(outTradeNo: string, patch: Partial<PaymentOrder>) {
  const order = await getOrder(outTradeNo);
  if (!order) return null;
  if (order.status === 'paid') return order;
  const updated: PaymentOrder = { ...order, ...patch, status: 'paid', paidAt: patch.paidAt || new Date().toISOString() };
  await kv.set(orderKey(outTradeNo), updated);
  await applyPaidOrder(updated);
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
      user.emailVerified = user.emailVerified !== false;
      await kv.hset('users', { [email]: user });
    }
  }
}

export function providerStatus() {
  return {
    alipay: Boolean(process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY && process.env.ALIPAY_PUBLIC_KEY),
    wechat: Boolean(process.env.WECHAT_PAY_APPID && process.env.WECHAT_PAY_MCH_ID && process.env.WECHAT_PAY_API_V3_KEY && process.env.WECHAT_PAY_PRIVATE_KEY && process.env.WECHAT_PAY_CERT_SERIAL && process.env.WECHAT_PAY_PUBLIC_KEY),
    ezfpy: Boolean(process.env.EZFPY_PID && process.env.EZFPY_KEY),
  };
}
