import crypto from 'crypto';
import QRCode from 'qrcode';
import { PaymentOrder, cents, siteUrl, markOrderPaid, updateOrder } from './core';

function cleanPem(value: string) { return String(value || '').replace(/\\n/g, '\n').trim(); }
export function getWechatConfig() {
  const appid = String(process.env.WECHAT_PAY_APPID || '').trim();
  const mchid = String(process.env.WECHAT_PAY_MCH_ID || '').trim();
  const apiV3Key = String(process.env.WECHAT_PAY_API_V3_KEY || '').trim();
  const privateKey = cleanPem(process.env.WECHAT_PAY_PRIVATE_KEY || '');
  const serialNo = String(process.env.WECHAT_PAY_CERT_SERIAL || '').trim();
  const publicKey = cleanPem(process.env.WECHAT_PAY_PUBLIC_KEY || '');
  const publicKeyId = String(process.env.WECHAT_PAY_PUBLIC_KEY_ID || '').trim();
  if (!appid || !mchid || !apiV3Key || !privateKey || !serialNo || !publicKey) throw new Error('微信支付尚未配置：请设置 WECHAT_PAY_APPID / WECHAT_PAY_MCH_ID / WECHAT_PAY_API_V3_KEY / WECHAT_PAY_PRIVATE_KEY / WECHAT_PAY_CERT_SERIAL / WECHAT_PAY_PUBLIC_KEY');
  return { appid, mchid, apiV3Key, privateKey, serialNo, publicKey, publicKeyId };
}
function sign(message: string, privateKey: string) {
  return crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64');
}
function auth(method: string, pathWithQuery: string, body: string, cfg = getWechatConfig()) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = sign(`${method}\n${pathWithQuery}\n${timestamp}\n${nonce}\n${body}\n`, cfg.privateKey);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mchid}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${cfg.serialNo}"`;
}
async function request(method: string, path: string, bodyObj?: any) {
  const body = bodyObj ? JSON.stringify(bodyObj) : '';
  const res = await fetch(`https://api.mch.weixin.qq.com${path}`, { method, headers: { Authorization: auth(method, path, body), Accept: 'application/json', 'Content-Type': 'application/json' }, body: body || undefined });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`微信支付接口失败 ${res.status}: ${data.message || text}`);
  return data;
}
export async function createWechatPayment(order: PaymentOrder) {
  const cfg = getWechatConfig();
  const isH5 = order.channel === 'wechat_h5';
  const path = isH5 ? '/v3/pay/transactions/h5' : '/v3/pay/transactions/native';
  const data = await request('POST', path, {
    appid: cfg.appid,
    mchid: cfg.mchid,
    description: order.name,
    out_trade_no: order.outTradeNo,
    notify_url: `${siteUrl()}/api/pay/wechat/notify`,
    amount: { total: cents(order.money), currency: 'CNY' },
    scene_info: isH5 ? { payer_client_ip: order.clientIp || '127.0.0.1', h5_info: { type: 'Wap' } } : undefined,
  });
  if (data.code_url) return { payUrl: data.code_url, qrDataUrl: await QRCode.toDataURL(data.code_url) };
  if (data.h5_url) return { payUrl: data.h5_url };
  throw new Error('微信支付未返回支付链接');
}
export function decryptWechatResource(resource: any) {
  const cfg = getWechatConfig();
  const key = Buffer.from(cfg.apiV3Key, 'utf8');
  const nonce = Buffer.from(resource.nonce, 'utf8');
  const aad = Buffer.from(resource.associated_data || '', 'utf8');
  const ciphertext = Buffer.from(resource.ciphertext, 'base64');
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(aad); decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
export function verifyWechatSignature(headers: Record<string, any>, rawBody: string) {
  const cfg = getWechatConfig();
  const timestamp = String(headers['wechatpay-timestamp'] || headers['Wechatpay-Timestamp'] || '');
  const nonce = String(headers['wechatpay-nonce'] || headers['Wechatpay-Nonce'] || '');
  const signature = String(headers['wechatpay-signature'] || headers['Wechatpay-Signature'] || '');
  const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
  return crypto.createVerify('RSA-SHA256').update(message).verify(cfg.publicKey, signature, 'base64');
}
export async function handleWechatNotify(headers: Record<string, any>, rawBody: string) {
  if (!verifyWechatSignature(headers, rawBody)) throw new Error('微信支付回调验签失败');
  const body = JSON.parse(rawBody || '{}');
  const plain = JSON.parse(decryptWechatResource(body.resource));
  const outTradeNo = String(plain.out_trade_no || '');
  const order = await updateOrder(outTradeNo, { lastNotifyAt: new Date().toISOString(), rawNotify: { body, plain } });
  if (!order) throw new Error('订单不存在');
  const nextNotifyCount = (order.notifyCount || 0) + 1;
  if (Number(plain.amount?.total) !== cents(order.money)) throw new Error('微信支付回调金额不一致');
  await updateOrder(outTradeNo, { notifyCount: nextNotifyCount, lastNotifyAt: new Date().toISOString(), rawNotify: { body, plain } });
  if (plain.trade_state === 'SUCCESS') await markOrderPaid(outTradeNo, { tradeNo: String(plain.transaction_id || ''), notifyCount: nextNotifyCount, rawNotify: { body, plain }, lastNotifyAt: new Date().toISOString() });
  return true;
}
