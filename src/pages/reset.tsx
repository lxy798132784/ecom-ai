import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { t, Lang } from '../lib/i18n';

function getLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  return (localStorage.getItem('lang') as Lang) || 'zh';
}
function saveLang(l: Lang) { localStorage.setItem('lang', l); }

export default function ResetPassword() {
  const router = useRouter();
  const { token } = router.query;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lang, setLangState] = useState<Lang>('zh');
  useEffect(() => setLangState(getLang()), []);
  const tr = t[lang];
  const toggleLang = () => { const next = lang === 'zh' ? 'en' : 'zh'; setLangState(next); saveLang(next); };

  const handleReset = async () => {
    setError('');
    if (password.length < 6) { setError(tr.passwordShort); return; }
    if (password !== confirm) { setError(tr.passwordMismatch); return; }
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
      <Head><title>{tr.resetPasswordTitle} · EcomPic AI</title></Head>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-xl">
          <div className="mb-4 flex justify-end"><button type="button" onClick={toggleLang} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">{lang === 'zh' ? 'EN' : '中'}</button></div>
          {done ? (
            <div className="text-center">
              <p className="text-5xl mb-4">✅</p>
              <h2 className="text-xl font-bold mb-2">{tr.passwordResetDone}</h2>
              <p className="text-slate-500 text-sm mb-6">{tr.useNewPasswordLogin}</p>
              <a href="/" className="block w-full bg-brand-600 text-white text-center py-3 rounded-xl font-semibold hover:bg-brand-700 transition">{tr.backHome}</a>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-center mb-2">🔐 {tr.setNewPassword}</h2>
              <p className="text-sm text-slate-500 text-center mb-6">{tr.setNewPasswordDesc}</p>
              {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{error}</div>}
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder={tr.newPasswordHint} type="password"
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-brand-400" />
              <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder={tr.confirmNewPassword} type="password"
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-4 outline-none focus:border-brand-400"
                onKeyDown={e => e.key === 'Enter' && handleReset()} />
              <button onClick={handleReset} disabled={loading}
                className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition">
                {loading ? tr.processing : tr.resetPasswordButton}
              </button>
            </>
          )}
        </div>
      </main>
    </>
  );
}
