import { useState, useCallback, useEffect } from 'react';
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
function uniqueImages(items: string[]): string[] {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function prependUnique(items: string[], url: string): string[] {
  return [url, ...items.filter(x => x !== url)].slice(0, 20);
}

async function imageDeletePayload(url: string) {
  const canonical = String(url || '').trim().split('#')[0].split('?')[0];
  const bytes = new TextEncoder().encode(canonical || String(url || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const id = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { id, url: url.startsWith('data:') || url.length > 2000 ? undefined : url };
}


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

const QUALITY_OPTIONS = [
  { id: 'low', label: '低', mult: 1 },
  { id: 'medium', label: '中', mult: 2 },
  { id: 'high', label: '高', mult: 4 },
] as const;
const SIZE_OPTIONS = [
  { id: '1024x1024', label: '1024×1024', mult: 1 },
  { id: '1920x1080', label: '1920×1080', mult: 2 },
  { id: '2560x1440', label: '2560×1440', mult: 3 },
  { id: '3840x2160', label: '3840×2160', mult: 5 },
] as const;
function calcPoints(quality: string, size: string) {
  return (QUALITY_OPTIONS.find(x => x.id === quality)?.mult || 2) * (SIZE_OPTIONS.find(x => x.id === size)?.mult || 1);
}

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
  const [images, setImages] = useState<string[]>([]);
  const [batchIndex, setBatchIndex] = useState(-1);
  const [result, setResult] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'history'|'favorites'>('history');
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
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(5);
  const [credits, setCredits] = useState(0);
  const [accountPlan, setAccountPlan] = useState<'free'|'pro'>('free');
  const [lang, setLangState] = useState<Lang>('zh');
  const [exportSize, setExportSize] = useState('');
  const [resizedUrl, setResizedUrl] = useState('');
  const [fitMode, setFitMode] = useState<'fill'|'fit'>('fill');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [genQuality, setGenQuality] = useState<'low'|'medium'|'high'>('medium');
  const [genSize, setGenSize] = useState<'1024x1024'|'1920x1080'|'2560x1440'|'3840x2160'>('1024x1024');
  const tr = t[lang];
  const downloadUrl = resizedUrl || result;
  const userPlan = accountPlan || (session?.user as any)?.plan || 'free';
  const usageLeft = Math.max(0, usageLimit - usageCount);
  const pointsCost = calcPoints(genQuality, genSize);
  const loggedIn = status === 'authenticated';

  // Load history, favorites & credits on login
  useEffect(() => {
    if (!loggedIn) return;
    fetch('/api/history').then(r => r.json()).then(d => {
      if (d.history) setResults(uniqueImages(d.history));
      if (d.credits !== undefined) setCredits(d.credits);
      if (d.plan === 'pro' || d.plan === 'free') setAccountPlan(d.plan);
      if (d.limit !== undefined) setUsageLimit(d.limit);
      if (d.plan === 'pro' && d.proUsage !== undefined) setUsageCount(d.proUsage);
      else if (d.plan === 'free' && d.freeUsage !== undefined) setUsageCount(d.freeUsage);
      else if (d.usage !== undefined) setUsageCount(d.usage);
    }).catch(() => {});
    fetch('/api/favorites').then(r => r.json()).then(d => {
      if (d.favorites) setFavorites(d.favorites);
    }).catch(() => {});
  }, [loggedIn]);

  const resizeToSize = (sizeKey: string) => {
    if (!result || !sizeKey) { setResizedUrl(''); setExportSize(''); return; }
    const sizes: Record<string, [number, number]> = { amazon: [2000, 2000], ebay: [1600, 1600], shopify: [2048, 2048], temu: [800, 800] };
    const [tw, th] = sizes[sizeKey] || [1024, 1024];
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = tw; canvas.height = th;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = bgColor; ctx.fillRect(0, 0, tw, th);
      if (fitMode === 'fill') {
        // Fill mode: cover entire canvas, crop excess
        const scale = Math.max(tw / img.width, th / img.height);
        const sw = img.width * scale, sh = img.height * scale;
        ctx.drawImage(img, (tw - sw) / 2, (th - sh) / 2, sw, sh);
      } else {
        // Fit mode: fit entire image, add padding
        const scale = Math.min(tw / img.width, th / img.height);
        const sw = img.width * scale, sh = img.height * scale;
        ctx.drawImage(img, (tw - sw) / 2, (th - sh) / 2, sw, sh);
      }
      setResizedUrl(canvas.toDataURL('image/jpeg', 0.92)); setExportSize(sizeKey);
    };
    img.src = result.startsWith('data:') ? result : result + '?_t=' + Date.now();
  };

  const toggleLang = () => {
    const next = lang === 'zh' ? 'en' : 'zh';
    setLangState(next); setLang(next);
  };

  const onDrop = useCallback((accepted: File[]) => {
    if (!accepted.length) return;
    setError('Compressing...');
    const promises = accepted.map(f => resizeImg(f));
    Promise.all(promises).then(dataUrls => {
      setImages(dataUrls);
      if (dataUrls.length === 1) setImage(dataUrls[0]);
      setResult(null); setResults([]); setError('');
    }).catch(() => setError('Failed'));
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.png','.jpg','.jpeg','.webp'] }, maxFiles: 10,
  });

  const generate = async (action: string, scene?: string, promptOverride?: string) => {
    if (action !== 'text2img' && !image) return;
    if (action === 'text2img' && !textPrompt.trim()) { setError(tr.pleaseFill); return; }
    if (!loggedIn) { setShowLogin(true); return; }
    if (usageLeft < pointsCost && credits < pointsCost) { userPlan === 'pro' ? setError('PRO 本月积分不足') : setShowPay(true); return; }
    setLoading(true); setError(''); setResult('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, action, scene, prompt: promptOverride || '', customPrompt: promptOverride || '', quality: genQuality, size: genSize }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.url) throw new Error('API returned empty URL');
      setResult(data.url); setResults(p => prependUnique(p, data.url));
      if (data.plan === 'pro' || data.plan === 'free') setAccountPlan(data.plan);
      if (data.limit !== undefined) setUsageLimit(data.limit);
      if (data.plan === 'pro' && data.proUsage !== undefined) setUsageCount(data.proUsage);
      else if (data.plan === 'free' && data.freeUsage !== undefined) setUsageCount(data.freeUsage);
      else if (data.usage !== undefined) setUsageCount(data.usage);
      if (data.credits !== undefined) setCredits(data.credits);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const doLogin = async () => {
    setAuthError('');
    const res = await signIn('credentials', { email: authEmail, password: authPassword, redirect: false });
    if (res?.error) { setAuthError(tr.authError); return; }
    setShowLogin(false); setAuthEmail(''); setAuthPassword('');
  };

  const doForgot = async () => {
    setAuthError('');
    if (!forgotEmail.trim()) { setAuthError(tr.pleaseFill); return; }
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail }),
    });
    if (!res.ok) { const d = await res.json(); setAuthError(d.error); return; }
    setForgotSent(true);
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

  const processBatch = async (action: string, scene?: string) => {
    if (!images.length) return;
    for (let i = 0; i < images.length; i++) {
      setImage(images[i]);
      setBatchIndex(i);
      await generatePromise(action, scene, customPrompt);
    }
    setBatchIndex(-1);
  };

  const generatePromise = (action: string, scene?: string, promptOverride?: string): Promise<void> => {
    return new Promise((resolve) => {
      const origError = setError;
      // Hook into the generate flow
      if (action !== 'text2img' && !image) { resolve(); return; }
      if (!loggedIn) { setShowLogin(true); resolve(); return; }
      setLoading(true); setError(''); setResult('');
      fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: images?.[batchIndex] || image, action, scene, prompt: promptOverride || '', quality: genQuality, size: genSize }),
      }).then(r => r.json()).then(data => {
        if (!data.url) throw new Error('empty');
        setResult(data.url); setResults(p => prependUnique(p, data.url));
        if (data.plan === 'pro' || data.plan === 'free') setAccountPlan(data.plan);
        if (data.limit !== undefined) setUsageLimit(data.limit);
        if (data.plan === 'pro' && data.proUsage !== undefined) setUsageCount(data.proUsage);
        else if (data.plan === 'free' && data.freeUsage !== undefined) setUsageCount(data.freeUsage);
        else if (data.usage !== undefined) setUsageCount(data.usage);
        if (data.credits !== undefined) setCredits(data.credits);
        setLoading(false);
        setTimeout(resolve, 2000);
      }).catch(() => { setLoading(false); setTimeout(resolve, 2000); });
    });
  };

  const doText = () => generate('text2img', '', textPrompt);
  const doWhiteBg = () => generate('whitebg', '', customPrompt);
  const doCustom = () => generate('custom', '', customEditPrompt);
  const doScene = (sid: string) => { setSelScene(sid); generate('scene', sid, customPrompt); };

  const useHistoryImage = (url: string) => {
    setMode('upload');
    setImage(url);
    setResult(url);
    setResizedUrl('');
    setExportSize('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remixHistoryImage = (url: string) => {
    setMode('upload');
    setImage(url);
    setResult(url);
    setCustomEditPrompt(customEditPrompt || '保持商品主体一致，优化为更高级的电商产品图');
    setError('已载入历史图，可直接白底、场景化或自由编辑');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteHistoryImage = async (url: string) => {
    const prev = results;
    setResults(p => p.filter(x => x !== url));
    setSelectedResults(p => { const next = new Set(p); next.delete(url); return next; });
    if (result === url) setResult(null);
    try {
      const payload = await imageDeletePayload(url);
      const res = await fetch('/api/history', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || '删除失败');
      if (data.history) setResults(uniqueImages(data.history));
    } catch (e: any) {
      setResults(prev);
      setError(e?.message || '删除历史图片失败，请重试');
    }
  };

  const deleteFavoriteImage = async (url: string) => {
    const prev = favorites;
    setFavorites(p => p.filter(x => x !== url));
    try {
      const payload = await imageDeletePayload(url);
      const res = await fetch('/api/favorites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || '删除失败');
      if (data.favorites) setFavorites(uniqueImages(data.favorites));
    } catch (e: any) {
      setFavorites(prev);
      setError(e?.message || '删除收藏图片失败，请重试');
    }
  };

  return (
    <>
      <Head>
        <title>{tr.brand} - AI Product Photography for Ecommerce</title>
        <meta name="description" content="Generate ecommerce product photos, white backgrounds, lifestyle scenes, and marketplace-ready images with AI." />
        <link rel="canonical" href={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-pixel.online'}/`} />
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Top Bar */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
            <span className="font-bold text-slate-800">🛍️ {tr.brand}</span>
            {loggedIn && credits > 0 && (<span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">💰 {credits} 积分</span>)}
            <div className="flex items-center gap-3 text-sm">
              <a href="/blog" className="text-xs text-slate-500 hover:text-brand-600 transition">📚 Blog</a>
              {/* Lang toggle */}
              <button onClick={toggleLang} className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 transition">
                {lang === 'zh' ? 'EN' : '中'}
              </button>
              {status === 'loading' ? (
                <span className="text-slate-400 text-xs">{tr.loading}</span>
              ) : loggedIn ? (
                <>
                  {userPlan === 'pro' ? (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">✨ {tr.proBadge} · {tr.freeLeft} {usageLeft} {tr.times}</span>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${usageLeft <= 1 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                      {tr.freeLeft} {usageLeft} {tr.times}{credits > 0 ? ` · 积分包 ${credits} 积分` : ''}
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
              <p className="text-sm text-brand-700 mb-2">🔐 {tr.loginRequired}</p>
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

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-600">⚙️ 生成规格</h3>
                  <span className="text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-full">预计消耗 {pointsCost} 积分</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">质量</p>
                    <div className="grid grid-cols-3 gap-2">{QUALITY_OPTIONS.map(q => <button key={q.id} onClick={() => setGenQuality(q.id)} className={`rounded-xl border px-2 py-2 text-xs ${genQuality===q.id?'bg-brand-600 text-white border-brand-600':'bg-slate-50 text-slate-600 border-slate-200'}`}>{q.label} ×{q.mult}</button>)}</div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">分辨率</p>
                    <div className="grid grid-cols-2 gap-2">{SIZE_OPTIONS.map(sz => <button key={sz.id} onClick={() => setGenSize(sz.id)} className={`rounded-xl border px-2 py-2 text-xs ${genSize===sz.id?'bg-brand-600 text-white border-brand-600':'bg-slate-50 text-slate-600 border-slate-200'}`}>{sz.label} ×{sz.mult}</button>)}</div>
                  </div>
                  <p className="text-[11px] text-slate-400">不同质量和分辨率按倍率消耗积分；16:9 高清会按所选分辨率输出。</p>
                </div>
              </div>
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
                      {images.length > 1 && (
                        <button onClick={() => processBatch('whitebg')} disabled={loading}
                          className="w-full bg-slate-800 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-slate-900 disabled:opacity-50 transition">
                          {batchIndex >= 0 ? `🔄 ${batchIndex + 1}/${images.length}` : `📦 ${images.length} 张批量白底图`}
                        </button>
                      )}
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
                      <a href={downloadUrl || '#'} download={`ecompic-${exportSize || 'original'}.jpg`} target="_blank" className="text-xs bg-slate-900 text-white px-4 py-1.5 rounded-full hover:bg-slate-800">⬇️ {tr.download}{exportSize ? ` (${exportSize})` : ''}</a>
                    <span className="text-xs text-slate-300">|</span>
                    <button onClick={() => setFitMode(m => m === 'fill' ? 'fit' : 'fill')}
                      className={`text-xs px-2 py-1 rounded-lg border transition ${fitMode === 'fill' ? 'bg-slate-100 border-slate-300' : 'border-slate-200'}`}
                      title={fitMode === 'fill' ? '铺满（裁边）' : '留白（完整）'}>
                      {fitMode === 'fill' ? '📐 铺满' : '🖼️ 完整'}
                    </button>
                    <select value={exportSize} className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none" onChange={e => resizeToSize(e.target.value)}>
                      <option value="">原尺寸</option>
                      <option value="amazon">Amazon 2000×2000</option>
                      <option value="ebay">eBay 1600×1600</option>
                      <option value="shopify">Shopify 2048×2048</option>
                      <option value="temu">Temu 800×800</option>
                    </select>
                    {exportSize && <button onClick={() => { setResizedUrl(''); setExportSize(''); }} className="text-xs text-slate-400 hover:text-slate-600 ml-1">×</button>}
                    </div>
                  </div>
                  <img src={downloadUrl || result} className="w-full rounded-xl shadow-md" alt="" />
                </div>
              )}
              {(results.length > 0 || favorites.length > 0) && (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700">作品库</h3>
                      <p className="text-xs text-slate-400 mt-0.5">参考 Firefly / Canva / Midjourney：历史图可复用、再编辑、收藏、删除。</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setViewMode('history')} className={`text-xs px-3 py-1.5 rounded-full border ${viewMode==='history'?'bg-brand-600 text-white border-brand-600':'bg-white text-slate-500 border-slate-200 hover:border-brand-300'}`}>📋 {tr.history} ({results.length})</button>
                      <button onClick={() => setViewMode('favorites')} className={`text-xs px-3 py-1.5 rounded-full border ${viewMode==='favorites'?'bg-brand-600 text-white border-brand-600':'bg-white text-slate-500 border-slate-200 hover:border-brand-300'}`}>⭐ {tr.favorites} ({favorites.length})</button>
                    </div>
                  </div>
                  {viewMode==='history' && selectedResults.size > 0 && (
                    <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-xl px-3 py-2 mb-3">
                      <span className="text-xs text-brand-700">已选择 {selectedResults.size} 张</span>
                      <div className="flex gap-2">
                        <button onClick={() => {
                          selectedResults.forEach(url => {
                            const a = document.createElement('a'); a.href = url; a.download = `ecompic-${Date.now()}.jpg`; a.click();
                          });
                          setSelectedResults(new Set());
                        }} className="text-xs bg-brand-600 text-white px-3 py-1 rounded-full">⬇️ {tr.downloadSelected}</button>
                        <button onClick={() => selectedResults.forEach(url => deleteHistoryImage(url))} className="text-xs bg-red-500 text-white px-3 py-1 rounded-full">🗑️ 删除</button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(viewMode==='history' ? results : favorites).map((url) => (
                      <div key={url} className="group relative bg-slate-50 rounded-xl p-2 border border-slate-200 hover:border-brand-400 transition">
                        <button className="block w-full" onClick={() => useHistoryImage(url)} title="点击载入这张图">
                          <img src={url} className="w-full aspect-square object-cover rounded-lg bg-white" alt="历史生成图" />
                        </button>
                        <div className="absolute inset-x-2 bottom-2 opacity-0 group-hover:opacity-100 transition bg-white/95 backdrop-blur rounded-lg p-1.5 shadow flex flex-wrap gap-1 justify-center">
                          <button onClick={() => useHistoryImage(url)} className="text-[11px] px-2 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200">查看</button>
                          <button onClick={() => remixHistoryImage(url)} className="text-[11px] px-2 py-1 rounded-md bg-brand-600 text-white hover:bg-brand-700">编辑/再生图</button>
                          <button onClick={() => {
                            fetch('/api/favorites', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({url}) })
                              .then(r => r.json()).then(d => { if (d.favorites) setFavorites(uniqueImages(d.favorites)); });
                          }} className="text-[11px] px-2 py-1 rounded-md bg-yellow-50 text-yellow-700 hover:bg-yellow-100">{favorites.includes(url) ? '取消收藏' : '收藏'}</button>
                          <button onClick={() => viewMode==='history' ? deleteHistoryImage(url) : deleteFavoriteImage(url)} className="text-[11px] px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100">删除</button>
                        </div>
                        {viewMode==='history' && (
                          <button onClick={() => {
                            const next = new Set(selectedResults);
                            next.has(url) ? next.delete(url) : next.add(url);
                            setSelectedResults(next);
                          }} className={`absolute top-3 left-3 text-xs rounded-full w-6 h-6 flex items-center justify-center border shadow-sm ${selectedResults.has(url) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white/90 text-slate-400 border-white'}`}>{selectedResults.has(url) ? '✓' : '+'}</button>
                        )}
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
          <button onClick={() => { setShowLogin(false); setShowForgot(true); setForgotEmail(authEmail); setForgotSent(false); setAuthError(''); }} className="w-full text-center text-xs text-slate-400 hover:text-brand-600 mt-2">忘记密码？</button>
          <p className="text-center text-sm text-slate-400 mt-3">
            {tr.noAccount} <button onClick={() => { setShowLogin(false); setShowRegister(true); }} className="text-brand-600 hover:underline">{tr.register}</button>
          </p>
        </Modal>

        {/* Forgot Password Modal */}
        <Modal show={showForgot} title="🔑 忘记密码" onClose={() => setShowForgot(false)}>
          {forgotSent ? (
            <div className="text-center">
              <p className="text-5xl mb-4">📧</p>
              <p className="font-medium text-slate-700 mb-2">邮件已发送</p>
              <p className="text-sm text-slate-500 mb-4">请检查 {forgotEmail} 的收件箱，点击链接重置密码（30 分钟有效）</p>
              <button onClick={() => { setShowForgot(false); setShowLogin(true); setForgotSent(false); }} className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold">返回登录</button>
            </div>
          ) : (
            <>
              {authError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{authError}</div>}
              <p className="text-sm text-slate-500 mb-4">输入注册邮箱，我们会发送重置链接</p>
              <input value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="注册邮箱" type="email"
                className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-4 outline-none focus:border-brand-400" />
              <button onClick={doForgot} className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition">发送重置链接</button>
              <button onClick={() => { setShowForgot(false); setShowLogin(true); }} className="w-full mt-2 text-slate-400 text-sm">返回登录</button>
            </>
          )}
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
          <p className="text-slate-500 text-center text-sm mb-4">{usageLeft <= 0 ? tr.limitReached : tr.freeLeftDesc.replace('{left}', String(usageLeft))}</p>

          {/* Credit Packs */}
          <div className="space-y-3 mb-4">
            <a href={process.env.NEXT_PUBLIC_LINK_5 || '#'} target="_blank" rel="noopener"
              className="flex items-center justify-between bg-white border-2 border-slate-200 hover:border-brand-400 rounded-xl p-3 transition">
              <div>
                <span className="font-semibold text-slate-800">📦 {tr.pack5}</span>
                <span className="text-xs text-slate-400 ml-2">{tr.oneTime}</span>
              </div>
              <span className="font-bold text-brand-600">$2</span>
            </a>
            <a href={process.env.NEXT_PUBLIC_LINK_20 || '#'} target="_blank" rel="noopener"
              className="flex items-center justify-between bg-white border-2 border-slate-200 hover:border-brand-400 rounded-xl p-3 transition">
              <div>
                <span className="font-semibold text-slate-800">📦 {tr.pack20}</span>
                <span className="text-xs text-slate-400 ml-2">{tr.hotDeal} 🔥</span>
              </div>
              <span className="font-bold text-brand-600">$5</span>
            </a>
            <a href={process.env.NEXT_PUBLIC_LINK_50 || '#'} target="_blank" rel="noopener"
              className="flex items-center justify-between bg-white border-2 border-slate-200 hover:border-brand-400 rounded-xl p-3 transition">
              <div>
                <span className="font-semibold text-slate-800">📦 {tr.pack50}</span>
                <span className="text-xs text-slate-400 ml-2">{tr.bestValue}</span>
              </div>
              <span className="font-bold text-brand-600">$10</span>
            </a>
          </div>

          {/* Monthly PRO */}
          <div className="bg-gradient-to-br from-brand-50 to-blue-50 rounded-xl p-4 mb-4 border-2 border-brand-200">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold">✨ {tr.proBadge} · {tr.monthly}</span>
              <span className="text-xs bg-brand-600 text-white px-2 py-0.5 rounded-full">{tr.recommended}</span>
            </div>
            <div className="flex justify-between items-center mb-2"><span className="font-bold text-2xl">$19</span><span className="text-slate-400 text-sm">{tr.month}</span></div>
            <ul className="text-sm text-slate-600 space-y-1"><li>✅ {tr.unlimited}</li><li>✅ {tr.allFeatures}</li><li>✅ {tr.prioritySupport}</li></ul>
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
