import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

type OrderState = { status?: string; name?: string; money?: string; credits?: number; plan?: string; outTradeNo?: string };

export default function PayResult() {
  const router = useRouter();
  const outTradeNo = String(router.query.out_trade_no || '');
  const [order, setOrder] = useState<OrderState | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!outTradeNo) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pay/order?out_trade_no=${encodeURIComponent(outTradeNo)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '订单查询失败');
      setOrder(data.order);
    } catch (e: any) {
      setError(e.message || '订单查询失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [outTradeNo]);

  const paid = order?.status === 'paid';
  return <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
    <Head><title>支付结果 - Ecom AI</title></Head>
    <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
      <div className="text-center text-5xl">{paid ? '✅' : '⏳'}</div>
      <h1 className="mt-4 text-center text-2xl font-black">{paid ? '支付成功' : '支付处理中'}</h1>
      <p className="mt-3 text-center text-sm leading-6 text-slate-400">{paid ? '积分或 PRO 权益已到账，可以返回工作台继续生成。' : '如果你已经完成付款，异步通知可能需要几十秒。可以点击刷新查询。'}</p>
      {order && <div className="mt-5 space-y-2 rounded-2xl bg-black/20 p-4 text-sm text-slate-300">
        <div className="flex justify-between gap-4"><span>订单号</span><b className="break-all text-right">{order.outTradeNo || outTradeNo}</b></div>
        <div className="flex justify-between"><span>商品</span><b>{order.name}</b></div>
        <div className="flex justify-between"><span>金额</span><b>¥{order.money}</b></div>
        <div className="flex justify-between"><span>状态</span><b>{paid ? '已支付' : '处理中'}</b></div>
      </div>}
      {error && <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button onClick={load} disabled={loading} className="rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? '查询中...' : '刷新状态'}</button>
        <Link href="/" className="rounded-xl bg-white/10 py-3 text-center text-sm font-semibold text-slate-100">返回工作台</Link>
      </div>
    </div>
  </main>;
}
