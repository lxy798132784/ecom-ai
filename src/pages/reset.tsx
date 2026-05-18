import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function ResetPassword() {
  const router = useRouter();
  const { token } = router.query;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setError('');
    if (password.length < 6) { setError('密码至少 6 位'); return; }
    if (password !== confirm) { setError('两次密码不一致'); return; }
    setLoading(true);
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setDone(true);
  };

  return (
    <>
      <Head><title>重置密码 · EcomPic AI</title></Head>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-xl">
          {done ? (
            <div className="text-center">
              <p className="text-5xl mb-4">✅</p>
              <h2 className="text-xl font-bold mb-2">密码已重置</h2>
              <p className="text-slate-500 text-sm mb-6">请使用新密码登录</p>
              <a href="/" className="block w-full bg-brand-600 text-white text-center py-3 rounded-xl font-semibold hover:bg-brand-700 transition">返回首页</a>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-center mb-2">🔐 设置新密码</h2>
              <p className="text-sm text-slate-500 text-center mb-6">为你的 EcomPic 账号设置新密码</p>
              {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</div>}
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="新密码（至少 6 位）" type="password"
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-brand-400" />
              <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="确认新密码" type="password"
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-4 outline-none focus:border-brand-400"
                onKeyDown={e => e.key === 'Enter' && handleReset()} />
              <button onClick={handleReset} disabled={loading}
                className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition">
                {loading ? '处理中...' : '重置密码'}
              </button>
            </>
          )}
        </div>
      </main>
    </>
  );
}
