import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { t, Lang } from '../lib/i18n';

function getLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  return (localStorage.getItem('lang') as Lang) || 'zh';
}
function saveLang(l: Lang) { localStorage.setItem('lang', l); }

export default function VerifyEmail() {
  const router = useRouter();
  const { token } = router.query;
  const [lang, setLangState] = useState<Lang>('zh');
  const [status, setStatus] = useState<'loading'|'success'|'error'>('loading');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const tr = t[lang] as any;

  useEffect(() => setLangState(getLang()), []);
  const toggleLang = () => { const next = lang === 'zh' ? 'en' : 'zh'; setLangState(next); saveLang(next); };

  useEffect(() => {
    if (!router.isReady || verified) return;
    if (!token || Array.isArray(token)) { setStatus('error'); setError(tr.verifyEmailMissingToken); return; }
    setStatus('loading');
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr.verifyEmailFailed);
      setVerified(true);
      setStatus('success');
    }).catch((e: any) => { setStatus('error'); setError(e.message || tr.verifyEmailFailed); });
  }, [router.isReady, token, verified, tr.verifyEmailFailed, tr.verifyEmailMissingToken]);

  return <>
    <Head><title>{tr.verifyEmailTitle} · Image Studio AI</title></Head>
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-4 py-12 text-slate-100 flex items-center justify-center">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl">
        <div className="mb-4 flex justify-end"><button type="button" onClick={toggleLang} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/10">{lang === 'zh' ? 'EN' : '中'}</button></div>
        {status === 'loading' && <div className="text-center"><div className="mb-4 text-5xl">📧</div><h1 className="text-xl font-bold">{tr.verifyEmailChecking}</h1><p className="mt-3 text-sm leading-6 text-slate-400">{tr.verifyEmailCheckingDesc}</p></div>}
        {status === 'success' && <div className="text-center"><div className="mb-4 text-5xl">✅</div><h1 className="text-xl font-bold">{tr.verifyEmailSuccess}</h1><p className="mt-3 text-sm leading-6 text-slate-400">{tr.verifyEmailSuccessDesc}</p><a href="/" className="mt-6 block w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700">{tr.backToLogin}</a></div>}
        {status === 'error' && <div className="text-center"><div className="mb-4 text-5xl">⚠️</div><h1 className="text-xl font-bold">{tr.verifyEmailExpired}</h1><p className="mt-3 rounded-2xl bg-red-500/10 p-3 text-sm leading-6 text-red-100">{error}</p><a href="/" className="mt-6 block w-full rounded-xl bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700">{tr.backHome}</a></div>}
      </section>
    </main>
  </>;
}
