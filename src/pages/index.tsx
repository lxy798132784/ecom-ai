import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSession, signIn, signOut } from 'next-auth/react';
import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import { t, Lang } from '../lib/i18n';

type Mode = 'upload' | 'text';

function getLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  return (localStorage.getItem('lang') as Lang) || 'zh';
}
function setLang(l: Lang) { localStorage.setItem('lang', l); }

function resizeImg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > 1024 || h > 1024) { const r = Math.min(1024 / w, 1024 / h); w = Math.round(w * r); h = Math.round(h * r); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject; img.src = URL.createObjectURL(file);
  });
}

const SCENES = [
  { id: 'kitchen', e: '🍳', l: { zh: '厨房', en: 'Kitchen' } },
  { id: 'living-room', e: '🛋️', l: { zh: '客厅', en: 'Living Room' } },
  { id: 'bedroom', e: '🛏️', l: { zh: '卧室', en: 'Bedroom' } },
  { id: 'office', e: '💼', l: { zh: '办公桌', en: 'Office' } },
  { id: 'outdoor', e: '🌳', l: { zh: '户外', en: 'Outdoor' } },
  { id: 'bathroom', e: '🛁', l: { zh: '浴室', en: 'Bathroom' } },
  { id: 'marble', e: '🪨', l: { zh: '大理石', en: 'Marble' } },
  { id: 'wooden-table', e: '🪵', l: { zh: '木桌', en: 'Wood Table' } },
];
const PRESETS = [
  { id: 'whitebg', l: { zh: '纯白背景', en: 'White BG' }, p: 'white background, clean, product photography' },
  { id: 'lifestyle', l: { zh: '生活场景', en: 'Lifestyle' }, p: 'lifestyle setting, natural light, warm' },
  { id: 'minimal', l: { zh: '极简风格', en: 'Minimal' }, p: 'minimalist, clean, soft shadows' },
  { id: 'studio', l: { zh: '影棚质感', en: 'Studio' }, p: 'studio lighting, high-end, dramatic' },
  { id: 'flatlay', l: { zh: '平铺展示', en: 'Flat Lay' }, p: 'flat lay, top-down, bright' },
  { id: 'closeup', l: { zh: '细节特写', en: 'Close Up' }, p: 'close-up macro, detailed texture' },
  { id: 'chinese', l: { zh: '国潮风格', en: 'Chinese' }, p: 'Chinese traditional, elegant, red gold' },
  { id: 'warm', l: { zh: '温馨暖调', en: 'Warm' }, p: 'warm tones, cozy, soft sunlight' },
];

function Modal({ show, title, onClose, children }: { show: boolean; title: string; onClose: () => void; children: any }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-center mb-6">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showAdv, setShowAdv] = useState(false);
  const [selScene, setSelScene] = useState('');
  const [mode, setMode] = useState<Mode>('upload');
  const [textPrompt, setTextPrompt] = useState('');
  const [customEditPrompt, setCustomEditPrompt] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [usageCount, setUsageCount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(5);
  const [lang, setLangState] = useState<Lang>('zh');

  const tr = t[lang];
  const userPlan = (session?.user as any)?.plan || 'free';
  const usageLeft = userPlan === 'pro' ? Infinity : Math.max(0, usageLimit - usageCount);
  const loggedIn = status === 'authenticated';

  const toggleLang = () => {
    const next = lang === 'zh' ? 'en' : 'zh';
    setLangState(next); setLang(next);
  };

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]; if (!f) return;
    setError('Compressing...');
    resizeImg(f).then(d => { setImage(d); setResult(null); setResults([]); setError(''); }).catch(() => setError('Failed'));
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.png','.jpg','.jpeg','.webp'] }, maxFiles: 1,
  });

  const generate = async (action: string, scene?: string, promptOverride?: string) => {
    if (action !== 'text2img' && !image) return;
    if (action === 'text2img' && !textPrompt.trim()) { setError(tr.pleaseFill); return; }
    if (!loggedIn) { setShowLogin(true); return; }
    if (usageLeft <= 0 && userPlan !== 'pro') { setShowPay(true); return; }
    setLoading(true); setError(''); setResult('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, action, scene, prompt: promptOverride || '', customPrompt: promptOverride || '' }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.url) throw new Error('API returned empty URL');
      setResult(data.url); setResults(p => [...p, data.url]);
      if (data.usage !== undefined) { setUsageCount(data.usage); setUsageLimit(data.limit); }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const doLogin = async () => {
    setAuthError('');
    const res = await signIn('credentials', { email: authEmail, password: authPassword, redirect: false });
    if (res?.error) { setAuthError(tr.authError); return; }
    setShowLogin(false); setAuthEmail(''); setAuthPassword('');
  };

  const doRegister = async () => {
    setAuthError('');
    if (!authEmail.trim() || !authPassword.trim()) { setAuthError(tr.pleaseFill); return; }
    if (authPassword.length < 6) { setAuthError(tr.passwordShort); return; }
    const res = await fetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password: authPassword, name: authName }),
    });
    const data = await res.json();
    if (!res.ok) { setAuthError(data.error); return; }
    const loginRes = await signIn('credentials', { email: authEmail, password: authPassword, redirect: false });
    if (loginRes?.error) { setAuthError(tr.authError); return; }
    setShowRegister(false); setAuthEmail(''); setAuthPassword(''); setAuthName('');
  };

  const doText = () => generate('text2img', '', textPrompt);
  const doWhiteBg = () => generate('whitebg', '', customPrompt);
  const doCustom = () => generate('custom', '', customEditPrompt);
  const doScene = (sid: string) => { setSelScene(sid); generate('scene', sid, customPrompt); };

  return (
    <>
      <Head><title>{tr.brand}</title></Head>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Top Bar */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
            <span className="font-bold text-slate-800">🛍️ {tr.brand}</span>
            <div className="flex items-center gap-3 text-sm">
              {/* Lang toggle */}
              <button onClick={toggleLang} className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition">
                {lang === 'zh' ? 'EN' : '中'}
              </button>
              {status === 'loading' ? (
                <span className="text-slate-400 text-xs">{tr.loading}</span>
              ) : loggedIn ? (
                <>
                  {userPlan === 'pro' ? (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">✨ {tr.proBadge}</span>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${usageLeft <= 1 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                      {tr.freeLeft} {usageLeft === Infinity ? '∞' : usageLeft} {tr.times}
                    </span>
                  )}
                  {userPlan !== 'pro' && (
                    <button onClick={() => setShowPay(true)} className="bg-brand-600 text-white px-4 py-1.5 rounded-full text-xs font-medium hover:bg-brand-700">{tr.upgrade}</button>
                  )}
                  <span className="text-slate-500 text-xs">{session?.user?.email}</span>
                  <button onClick={() => signOut()} className="text-slate-400 hover:text-red-500 text-xs transition">{tr.logout}</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setShowLogin(true); setAuthError(''); }} className="text-brand-600 font-medium text-xs hover:underline">{tr.login}</button>
                  <button onClick={() => { setShowRegister(true); setAuthError(''); }} className="bg-brand-600 text-white px-4 py-1.5 rounded-full text-xs font-medium hover:bg-brand-700">{tr.register}</button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Login prompt for non-logged-in users */}
        {status !== 'loading' && !loggedIn && (
          <div className="max-w-lg mx-auto mt-4 px-4">
            <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5 text-center">
              <p className="text-sm text-brand-700 mb-2">🔐 登录后即可使用 AI 生图</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => { setShowLogin(true); setAuthError(''); }} className="bg-brand-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-brand-700">{tr.login}</button>
                <button onClick={() => { setShowRegister(true); setAuthError(''); }} className="bg-white text-brand-600 border border-brand-300 px-5 py-2 rounded-xl text-sm font-medium hover:bg-brand-50">{tr.register}</button>
              </div>
            </div>
          </div>
        )}

        {/* Mode Tabs */}
        <div className="flex justify-center mt-8 mb-4">
          <div className="bg-slate-100 rounded-xl p-1 inline-flex">
            <button onClick={() => setMode('upload')} className={`px-5 py-2 rounded-lg text-sm font-medium transition ${mode === 'upload' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>📸 {tr.upload}</button>
            <button onClick={() => setMode('text')} className={`px-5 py-2 rounded-lg text-sm font-medium transition ${mode === 'text' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>✍️ {tr.textGen}</button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 pb-20">
          <div className="grid md:grid-cols-5 gap-6">
            {/* Left */}
            <div className="md:col-span-2 space-y-4">
              {mode === 'upload' && (
                <>
                  <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition bg-white ${isDragActive ? 'border-brand-500 bg-blue-50' : 'border-slate-300 hover:border-brand-400'}`}>
                    <input {...getInputProps()} />
                    {image ? <img src={image} className="max-h-48 mx-auto rounded-lg" alt="" /> : (
                      <div><p className="text-4xl mb-3">📸</p><p className="font-medium text-slate-700">{tr.dropHere}</p><p className="text-xs text-slate-400 mt-1">{tr.autoCompress}</p></div>
                    )}
                  </div>
                  {image && (
                    <>
                      <button onClick={doWhiteBg} disabled={loading} className="w-full bg-brand-600 text-white px-6 py-3 rounded-xl font-semibold text-lg hover:bg-brand-700 disabled:opacity-50 transition">
                        {loading ? '🎨 ' + tr.generating : '🪄 ' + tr.whiteBg}
                      </button>
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-500 mb-2">✏️ {tr.customEdit}</h3>
                        <p className="text-xs text-slate-400 mb-2">{tr.customEditDesc}</p>
                        <div className="flex gap-2">
                          <input value={customEditPrompt} onChange={e => setCustomEditPrompt(e.target.value)} placeholder={tr.customEditPlaceholder}
                            className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-brand-400" />
                          <button onClick={doCustom} disabled={loading || !customEditPrompt.trim()}
                            className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-900 disabled:opacity-50 transition whitespace-nowrap">🎨 {tr.generate}</button>
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-500 mb-3">🏠 {tr.scenes}</h3>
                        <div className="grid grid-cols-4 gap-2">
                          {SCENES.map(s => (
                            <button key={s.id} onClick={() => doScene(s.id)} disabled={loading}
                              className={`flex flex-col items-center p-2 rounded-xl border transition text-sm ${selScene === s.id ? 'border-brand-500 bg-blue-50' : 'border-slate-200 hover:border-brand-400'} disabled:opacity-50`}>
                              <span className="text-xl">{s.e}</span><span className="text-xs mt-1 text-slate-600">{s.l[lang]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                        <button onClick={() => setShowAdv(!showAdv)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 w-full">
                          <span>{showAdv ? '🔽' : '▶️'}</span><span className="font-medium">{tr.advanced}</span>
                        </button>
                        {showAdv && (
                          <div className="mt-3 space-y-3">
                            <div className="flex flex-wrap gap-1.5">
                              {PRESETS.map(p => (
                                <button key={p.id} onClick={() => setCustomPrompt(p.p)} className={`text-xs px-3 py-1.5 rounded-full border ${customPrompt === p.p ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-brand-400'}`}>{p.l[lang]}</button>
                              ))}
                            </div>
                            <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder={tr.customPrompt} rows={3} className="w-full text-sm border border-slate-200 rounded-xl p-3 outline-none focus:border-brand-400 resize-none" />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
              {mode === 'text' && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <h3 className="font-semibold text-slate-700 mb-2">✍️ {tr.ecoTitle}</h3>
                  <textarea value={textPrompt} onChange={e => setTextPrompt(e.target.value)} placeholder={tr.ecoPlaceholder} rows={4}
                    className="w-full text-sm border border-slate-200 rounded-xl p-3 outline-none focus:border-brand-400 resize-none mb-3" />
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {PRESETS.map(p => (
                      <button key={p.id} onClick={() => setTextPrompt(p.p + ' product photography, white background, studio lighting')}
                        className="text-xs px-3 py-1.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200 hover:border-brand-400">{p.l[lang]}</button>
                    ))}
                  </div>
                  <button onClick={doText} disabled={loading} className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition">
                    {loading ? '🎨 ' + tr.generating : '🪄 ' + tr.generatingBtn}
                  </button>
                </div>
              )}
            </div>

            {/* Right */}
            <div className="md:col-span-3">
              {loading && (
                <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 text-center">
                  <div className="animate-bounce text-5xl mb-4">🎨</div><p className="text-slate-600 font-medium text-lg">{tr.generating}</p>
                  <p className="text-sm text-slate-400 mt-2">{tr.waitSeconds}</p>
                </div>
              )}
              {error && (<div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm mb-4">❌ {error}</div>)}
              {result && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-700">✅ {tr.done}</h3>
                    <div className="flex gap-2">
                      <button onClick={() => setResult(null)} className="text-xs text-slate-400 hover:text-slate-600">{tr.clear}</button>
                      <a href={result} download="result.png" target="_blank" className="text-xs bg-slate-900 text-white px-4 py-1.5 rounded-full hover:bg-slate-800">⬇️ {tr.download}</a>
                    </div>
                  </div>
                  <img src={result} className="w-full rounded-xl shadow-md" alt="" />
                </div>
              )}
              {results.length > 1 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 mb-3">📋 {tr.history} ({results.length})</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {results.slice(0, -1).reverse().map((url, i) => (
                      <div key={i} className="bg-white rounded-xl p-2 shadow-sm border border-slate-200 cursor-pointer hover:border-brand-400" onClick={() => setResult(url)}>
                        <img src={url} className="w-full rounded-lg" alt="" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!image && !result && !loading && (
                <div className="bg-white rounded-2xl p-16 shadow-sm border border-slate-200 text-center">
                  <p className="text-6xl mb-4">🖼️</p>
                  <p className="text-slate-500">{mode === 'text' ? tr.textStart : tr.uploadStart}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Login Modal */}
        <Modal show={showLogin} title={'🔐 ' + tr.loginTitle} onClose={() => setShowLogin(false)}>
          {authError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{authError}</div>}
          <input value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder={tr.email} type="email"
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-brand-400" />
          <input value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder={tr.password} type="password"
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-4 outline-none focus:border-brand-400"
            onKeyDown={e => e.key === 'Enter' && doLogin()} />
          <button onClick={doLogin} className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition">{tr.login}</button>
          <p className="text-center text-sm text-slate-400 mt-3">
            {tr.noAccount} <button onClick={() => { setShowLogin(false); setShowRegister(true); }} className="text-brand-600 hover:underline">{tr.register}</button>
          </p>
        </Modal>

        {/* Register Modal */}
        <Modal show={showRegister} title={'🦐 ' + tr.registerTitle} onClose={() => setShowRegister(false)}>
          {authError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{authError}</div>}
          <input value={authName} onChange={e => setAuthName(e.target.value)} placeholder={tr.name}
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-brand-400" />
          <input value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder={tr.email} type="email"
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-brand-400" />
          <input value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder={tr.passwordHint} type="password"
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-4 outline-none focus:border-brand-400" />
          <button onClick={doRegister} className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition">{tr.register}</button>
          <p className="text-xs text-slate-400 text-center mt-3">{tr.agreeTerms}</p>
          <p className="text-center text-sm text-slate-400 mt-2">
            {tr.hasAccount} <button onClick={() => { setShowRegister(false); setShowLogin(true); }} className="text-brand-600 hover:underline">{tr.login}</button>
          </p>
        </Modal>

        {/* Paywall */}
        <Modal show={showPay} title={'🚀 ' + tr.upgradeTitle} onClose={() => setShowPay(false)}>
          <p className="text-slate-500 text-center text-sm mb-4">{tr.upgradeDesc}</p>

          {/* Credit Packs */}
          <div className="space-y-3 mb-4">
            <a href={process.env.NEXT_PUBLIC_LINK_5 || '#'} target="_blank" rel="noopener"
              className="flex items-center justify-between bg-white border-2 border-slate-200 hover:border-brand-400 rounded-xl p-3 transition">
              <div>
                <span className="font-semibold text-slate-800">📦 5 次</span>
                <span className="text-xs text-slate-400 ml-2">一次性</span>
              </div>
              <span className="font-bold text-brand-600">$2</span>
            </a>
            <a href={process.env.NEXT_PUBLIC_LINK_20 || '#'} target="_blank" rel="noopener"
              className="flex items-center justify-between bg-white border-2 border-slate-200 hover:border-brand-400 rounded-xl p-3 transition">
              <div>
                <span className="font-semibold text-slate-800">📦 20 次</span>
                <span className="text-xs text-slate-400 ml-2">一次性 · 热卖 🔥</span>
              </div>
              <span className="font-bold text-brand-600">$5</span>
            </a>
            <a href={process.env.NEXT_PUBLIC_LINK_50 || '#'} target="_blank" rel="noopener"
              className="flex items-center justify-between bg-white border-2 border-slate-200 hover:border-brand-400 rounded-xl p-3 transition">
              <div>
                <span className="font-semibold text-slate-800">📦 50 次</span>
                <span className="text-xs text-slate-400 ml-2">一次性 · 最划算</span>
              </div>
              <span className="font-bold text-brand-600">$10</span>
            </a>
          </div>

          {/* Monthly PRO */}
          <div className="bg-gradient-to-br from-brand-50 to-blue-50 rounded-xl p-4 mb-4 border-2 border-brand-200">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold">✨ {tr.proBadge} · 月度</span>
              <span className="text-xs bg-brand-600 text-white px-2 py-0.5 rounded-full">推荐</span>
            </div>
            <div className="flex justify-between items-center mb-2"><span className="font-bold text-2xl">$19</span><span className="text-slate-400 text-sm">{tr.month}</span></div>
            <ul className="text-sm text-slate-600 space-y-1"><li>✅ {tr.unlimited}（500次/月）</li><li>✅ {tr.allFeatures}</li><li>✅ {tr.prioritySupport}</li></ul>
            <a href={process.env.NEXT_PUBLIC_STRIPE_LINK || '#'} target="_blank" rel="noopener"
              className="block w-full bg-brand-600 text-white text-center py-2.5 rounded-xl font-semibold hover:bg-brand-700 transition mt-3 text-sm">
              💳 {tr.upgradeBtn}
            </a>
          </div>
          <p className="text-xs text-slate-400 text-center">{tr.stripeSecure}</p>
          <button onClick={() => setShowPay(false)} className="w-full mt-2 text-slate-400 text-sm hover:text-slate-600">{tr.later}</button>
        </Modal>
      </main>
    </>
  );
}
