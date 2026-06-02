import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSession, signIn, signOut } from 'next-auth/react';
import Head from 'next/head';
import { t, Lang } from '../lib/i18n';

type StudioMode = 'text' | 'edit' | 'background' | 'scene' | 'mask' | 'agent';
type TaskStatus = 'running' | 'done' | 'error';
type OutputFormat = 'png' | 'jpeg' | 'webp';
type GalleryItem = { id?: string; url: string; prompt?: string; action?: string; quality?: string; size?: string; createdAt?: string; provider?: string; model?: string };
type StudioTask = { id: string; prompt: string; action: StudioMode; status: TaskStatus; inputUrl?: string; outputUrl?: string; error?: string; createdAt: number; finishedAt?: number };
type FavoriteCollection = { id: string; name: string; urls: string[]; createdAt: number; updatedAt: number };
type AgentMessage = { id: string; role: 'user' | 'assistant'; content: string; imageUrl?: string; createdAt: number };

const COLLECTION_KEY = 'image-studio-favorite-collections';
const AGENT_KEY = 'image-studio-agent-messages';
const QUALITY_OPTIONS = [
  { id: 'low', labelKey: 'qualityLow', mult: 1 },
  { id: 'medium', labelKey: 'qualityMedium', mult: 2 },
  { id: 'high', labelKey: 'qualityHigh', mult: 4 },
] as const;
const SIZE_OPTIONS = [
  { id: '1024x1024', label: '1:1 · 1024×1024', mult: 1 },
  { id: '1280x720', label: '16:9 · 1280×720', mult: 1 },
  { id: '720x1280', label: '9:16 · 720×1280', mult: 1 },
  { id: '1920x1080', label: '16:9 · 1920×1080', mult: 2 },
  { id: '1080x1920', label: '9:16 · 1080×1920', mult: 2 },
  { id: '2048x2048', label: '1:1 · 2048×2048', mult: 2 },
  { id: '2560x1440', label: '16:9 · 2560×1440', mult: 3 },
  { id: '1440x2560', label: '9:16 · 1440×2560', mult: 3 },
  { id: '3840x2160', label: '16:9 · 3840×2160', mult: 5 },
] as const;
const SCENES = [
  { id: 'cinematic studio', e: '🎬', zh: '电影影棚', en: 'Cinematic' },
  { id: 'minimal clean background', e: '⚪', zh: '极简干净', en: 'Minimal' },
  { id: 'outdoor natural light', e: '🌿', zh: '户外自然光', en: 'Outdoor' },
  { id: 'futuristic neon room', e: '🌃', zh: '未来霓虹', en: 'Neon' },
  { id: 'warm lifestyle interior', e: '🛋️', zh: '生活空间', en: 'Lifestyle' },
  { id: 'flat lay desk setup', e: '🧩', zh: '平铺桌面', en: 'Flat lay' },
];

function getLang(): Lang { if (typeof window === 'undefined') return 'zh'; return (localStorage.getItem('lang') as Lang) || 'zh'; }
function setLang(l: Lang) { localStorage.setItem('lang', l); }
function uniqueImages(items: string[]): string[] { return Array.from(new Set((items || []).filter(Boolean))); }
function calcPoints(quality: string, size: string) { return (QUALITY_OPTIONS.find(x => x.id === quality)?.mult || 2) * (SIZE_OPTIONS.find(x => x.id === size)?.mult || 1); }
function newId() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function readLocalJson<T>(key: string, fallback: T): T { if (typeof window === 'undefined') return fallback; try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; } }
function writeLocalJson(key: string, value: unknown) { if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(value)); }
async function imageDeletePayload(url: string) {
  const canonical = String(url || '').trim().split('#')[0].split('?')[0];
  const bytes = new TextEncoder().encode(canonical || String(url || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const id = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { id, url: url.startsWith('data:') || url.length > 2000 ? undefined : url };
}
async function resizeImg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > 1536 || h > 1536) { const r = Math.min(1536 / w, 1536 / h); w = Math.round(w * r); h = Math.round(h * r); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9));
    };
    img.onerror = reject; img.src = URL.createObjectURL(file);
  });
}
async function downloadAs(url: string, format: OutputFormat, fileName = 'image-studio') {
  const res = await fetch(url); const blob = await res.blob();
  if (format === 'png' && blob.type.includes('png')) {
    const objectUrl = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = objectUrl; a.download = `${fileName}.png`; a.click(); URL.revokeObjectURL(objectUrl); return;
  }
  const img = new Image(); img.crossOrigin = 'anonymous';
  const objectInput = URL.createObjectURL(blob);
  await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = objectInput; });
  const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height; c.getContext('2d')!.drawImage(img, 0, 0);
  URL.revokeObjectURL(objectInput);
  const mime = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
  const out = await new Promise<Blob>(resolve => c.toBlob(b => resolve(b || new Blob()), mime, 0.94));
  const outUrl = URL.createObjectURL(out); const a = document.createElement('a'); a.href = outUrl; a.download = `${fileName}.${format === 'jpeg' ? 'jpg' : format}`; a.click(); URL.revokeObjectURL(outUrl);
}

function Modal({ show, title, onClose, children }: { show: boolean; title: string; onClose: () => void; children: any }) {
  if (!show) return null;
  return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}><div className="bg-white text-slate-900 rounded-2xl p-8 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}><h2 className="text-xl font-bold text-center mb-6">{title}</h2>{children}</div></div>;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [lang, setLangState] = useState<Lang>('zh');
  const tr = t[lang] as any;
  const loggedIn = status === 'authenticated';
  const [mode, setMode] = useState<StudioMode>('text');
  const [prompt, setPrompt] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [references, setReferences] = useState<string[]>([]);
  const [activeRef, setActiveRef] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<GalleryItem[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<GalleryItem[]>([]);
  const [viewMode, setViewMode] = useState<'history'|'favorites'>('history');
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'running'|'done'|'error'>('all');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [tasks, setTasks] = useState<StudioTask[]>([]);
  const [collections, setCollections] = useState<FavoriteCollection[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState('all');
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [genQuality, setGenQuality] = useState<'low'|'medium'|'high'>('medium');
  const [genSize, setGenSize] = useState<typeof SIZE_OPTIONS[number]['id']>('1024x1024');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png');
  const [scene, setScene] = useState('cinematic studio');
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(5);
  const [credits, setCredits] = useState(0);
  const [accountPlan, setAccountPlan] = useState<'free'|'pro'>('free');

  const usageLeft = Math.max(0, usageLimit - usageCount);
  const pointsCost = calcPoints(genQuality, genSize);
  const favoriteUrls = favoriteItems.map(x => x.url);
  const activeGallery = viewMode === 'history' ? historyItems : favoriteItems;

  useEffect(() => { setLangState(getLang()); setCollections(readLocalJson(COLLECTION_KEY, [])); setAgentMessages(readLocalJson(AGENT_KEY, [])); }, []);
  const refreshGallery = useCallback(async () => {
    if (!loggedIn) return;
    const h = await fetch('/api/history').then(r => r.json()).catch(() => ({}));
    if (h.items) setHistoryItems(h.items); else if (h.history) setHistoryItems(uniqueImages(h.history).map((url: string) => ({ url })));
    if (h.credits !== undefined) setCredits(h.credits);
    if (h.plan === 'pro' || h.plan === 'free') setAccountPlan(h.plan);
    if (h.limit !== undefined) setUsageLimit(h.limit);
    if (h.plan === 'pro' && h.proUsage !== undefined) setUsageCount(h.proUsage); else if (h.plan === 'free' && h.freeUsage !== undefined) setUsageCount(h.freeUsage); else if (h.usage !== undefined) setUsageCount(h.usage);
    const f = await fetch('/api/favorites').then(r => r.json()).catch(() => ({}));
    if (f.items) setFavoriteItems(f.items); else if (f.favorites) setFavoriteItems(uniqueImages(f.favorites).map((url: string) => ({ url })));
  }, [loggedIn]);
  useEffect(() => { refreshGallery(); }, [refreshGallery]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase(); const favSet = new Set(favoriteUrls);
    return activeGallery.filter(item => {
      const task = tasks.find(x => x.outputUrl === item.url);
      if (favoriteOnly && !favSet.has(item.url)) return false;
      if (activeCollectionId !== 'all' && !collections.find(c => c.id === activeCollectionId)?.urls.includes(item.url)) return false;
      if (statusFilter !== 'all' && task?.status !== statusFilter) return false;
      if (!q) return true;
      return [item.prompt, item.action, item.quality, item.size, item.model, item.provider, item.url].some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [activeGallery, search, favoriteOnly, statusFilter, favoriteUrls, tasks, activeCollectionId, collections]);

  const onDrop = useCallback((accepted: File[]) => {
    if (!accepted.length) return;
    setError(tr.compressing);
    Promise.all(accepted.map(f => resizeImg(f))).then(dataUrls => { setReferences(prev => uniqueImages([...prev, ...dataUrls]).slice(0, 12)); setActiveRef(dataUrls[0]); setError(''); }).catch(() => setError(tr.failed));
  }, [tr.compressing, tr.failed]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': ['.png','.jpg','.jpeg','.webp','.gif'] }, maxFiles: 12 });

  const toggleLang = () => { const next = lang === 'zh' ? 'en' : 'zh'; setLangState(next); setLang(next); };
  const addReferenceFromGallery = (url: string) => { setReferences(prev => uniqueImages([url, ...prev]).slice(0, 12)); setActiveRef(url); setMode('edit'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const removeReference = (url: string) => { const next = references.filter(x => x !== url); setReferences(next); if (activeRef === url) setActiveRef(next[0] || ''); };
  const clearReferences = () => { setReferences([]); setActiveRef(''); };

  const submit = async () => {
    if (!loggedIn) { setShowLogin(true); return; }
    if (mode !== 'text' && mode !== 'agent' && !activeRef) { setError(tr.referenceRequired); return; }
    const basePrompt = (mode === 'text' || mode === 'agent' ? prompt : customPrompt).trim();
    if ((mode === 'text' || mode === 'edit' || mode === 'mask' || mode === 'agent') && !basePrompt) { setError(tr.pleaseFill); return; }
    if (usageLeft < pointsCost && credits < pointsCost) { accountPlan === 'pro' ? setError(tr.proMonthlyNotEnough) : setShowPay(true); return; }
    const action = mode === 'text' || mode === 'agent' ? 'text2img' : mode === 'background' ? 'whitebg' : mode === 'scene' ? 'scene' : 'custom';
    const effectivePrompt = mode === 'mask' ? `${basePrompt}. Apply as localized inpainting-style edit while preserving unmentioned areas.` : mode === 'agent' ? `${basePrompt}. Think like an image creation assistant and produce the best final image.` : basePrompt;
    const id = newId();
    setTasks(p => [{ id, prompt: effectivePrompt || scene, action: mode, status: 'running' as const, inputUrl: activeRef, createdAt: Date.now() }, ...p].slice(0, 50));
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: activeRef, action, scene, prompt: effectivePrompt, customPrompt: effectivePrompt, quality: genQuality, size: genSize, output_format: outputFormat, referenceImages: references }) });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.url) throw new Error(tr.apiEmptyUrl);
      setResult(data.url);
      if (data.historyItems) setHistoryItems(data.historyItems); else if (data.history) setHistoryItems(uniqueImages(data.history).map((url: string) => ({ url })));
      setTasks(p => p.map(x => x.id === id ? { ...x, status: 'done', outputUrl: data.url, finishedAt: Date.now() } : x));
      if (mode === 'agent') {
        setAgentMessages(prev => {
          const merged = [{ id: newId(), role: 'user' as const, content: basePrompt, createdAt: Date.now() }, { id: newId(), role: 'assistant' as const, content: tr.agentGeneratedReply, imageUrl: data.url, createdAt: Date.now() }, ...prev].slice(0, 40);
          writeLocalJson(AGENT_KEY, merged); return merged;
        });
      }
      if (data.plan === 'pro' || data.plan === 'free') setAccountPlan(data.plan);
      if (data.limit !== undefined) setUsageLimit(data.limit);
      if (data.plan === 'pro' && data.proUsage !== undefined) setUsageCount(data.proUsage); else if (data.plan === 'free' && data.freeUsage !== undefined) setUsageCount(data.freeUsage); else if (data.usage !== undefined) setUsageCount(data.usage);
      if (data.credits !== undefined) setCredits(data.credits);
    } catch (e: any) { setError(e.message); setTasks(p => p.map(x => x.id === id ? { ...x, status: 'error', error: e.message, finishedAt: Date.now() } : x)); }
    finally { setLoading(false); }
  };

  const toggleFavorite = async (url: string) => { const data = await fetch('/api/favorites', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ url, source: 'manual-favorite' }) }).then(r => r.json()).catch(() => ({})); if (data.items) setFavoriteItems(data.items); else if (data.favorites) setFavoriteItems(uniqueImages(data.favorites).map((u: string) => ({ url: u }))); };
  const deleteImage = async (url: string, kind: 'history'|'favorites') => { const payload = await imageDeletePayload(url); const data = await fetch(kind === 'history' ? '/api/history' : '/api/favorites', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json()).catch(() => ({})); if (kind === 'history') setHistoryItems(data.items || data.history?.map((u: string) => ({ url: u })) || []); else setFavoriteItems(data.items || data.favorites?.map((u: string) => ({ url: u })) || []); };
  const createCollection = () => { const name = window.prompt(tr.newCollectionName); if (!name?.trim()) return; const next = [{ id: newId(), name: name.trim(), urls: [], createdAt: Date.now(), updatedAt: Date.now() }, ...collections]; setCollections(next); writeLocalJson(COLLECTION_KEY, next); };
  const addToCollection = (url: string) => { if (!collections.length) { const next = [{ id: newId(), name: tr.favorites, urls: [url], createdAt: Date.now(), updatedAt: Date.now() }]; setCollections(next); writeLocalJson(COLLECTION_KEY, next); return; } const name = window.prompt(`${tr.addToCollectionPrompt}: ${collections.map(c => c.name).join(', ')}`); const col = collections.find(c => c.name === name || c.id === name) || collections[0]; const next = collections.map(c => c.id === col.id ? { ...c, urls: uniqueImages([url, ...c.urls]), updatedAt: Date.now() } : c); setCollections(next); writeLocalJson(COLLECTION_KEY, next); };
  const exportWorkspace = () => { const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), references, activeRef, tasks, collections, agentMessages, historyItems, favoriteItems }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'image-studio-workspace.json'; a.click(); URL.revokeObjectURL(url); };
  const importWorkspace = async (file: File) => { const payload = JSON.parse(await file.text()); if (Array.isArray(payload.references)) setReferences(payload.references.slice(0, 12)); if (typeof payload.activeRef === 'string') setActiveRef(payload.activeRef); if (Array.isArray(payload.tasks)) setTasks(payload.tasks.slice(0, 50)); if (Array.isArray(payload.collections)) { setCollections(payload.collections); writeLocalJson(COLLECTION_KEY, payload.collections); } if (Array.isArray(payload.agentMessages)) { setAgentMessages(payload.agentMessages); writeLocalJson(AGENT_KEY, payload.agentMessages); } };
  const doLogin = async () => { setAuthError(''); const res = await signIn('credentials', { email: authEmail, password: authPassword, redirect: false }); if (res?.error) { setAuthError(tr.authError); return; } setShowLogin(false); };
  const doRegister = async () => { setAuthError(''); if (!authEmail.trim() || !authPassword.trim()) { setAuthError(tr.pleaseFill); return; } const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: authEmail, password: authPassword, name: authName }) }); const data = await res.json(); if (!res.ok) { setAuthError(data.error); return; } await signIn('credentials', { email: authEmail, password: authPassword, redirect: false }); setShowRegister(false); };
  const doForgot = async () => { if (!forgotEmail.trim()) { setAuthError(tr.pleaseFill); return; } const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail }) }); if (!res.ok) { const d = await res.json(); setAuthError(d.error); return; } setForgotSent(true); };

  const modeIcon = (m: StudioMode) => m === 'text' ? '✍️' : m === 'edit' ? '🖌️' : m === 'background' ? '🪄' : m === 'scene' ? '🏞️' : m === 'mask' ? '🎭' : '🤖';

  return <>
    <Head><title>{tr.studioBrand} - AI Image Studio</title><meta name="description" content={tr.studioMeta} /></Head>
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-900/80 sticky top-0 z-30"><div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3"><div><div className="font-black text-lg">🎨 {tr.studioBrand}</div><div className="text-xs text-slate-400">{tr.studioSubtitle}</div></div><div className="flex items-center gap-2 text-xs"><a href="/blog" className="text-slate-400">Blog</a><button onClick={toggleLang} className="px-2 py-1 rounded-lg border border-white/10">{lang === 'zh' ? 'EN' : '中'}</button>{loggedIn ? <><span className="hidden sm:inline text-slate-400">{session?.user?.email}</span><span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300">{accountPlan.toUpperCase()} · {usageLeft}+{credits}</span><button onClick={() => signOut()}>{tr.logout}</button></> : <><button onClick={() => setShowLogin(true)} className="text-brand-300">{tr.login}</button><button onClick={() => setShowRegister(true)} className="bg-brand-600 text-white px-3 py-1.5 rounded-full">{tr.register}</button></>}</div></div></header>
      {!loggedIn && <div className="max-w-3xl mx-auto mt-4 px-4"><div className="rounded-2xl border border-brand-500/30 bg-brand-500/10 p-4 text-center text-sm">🔐 {tr.loginRequired}</div></div>}
      <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-12 gap-5">
        <section className="lg:col-span-4 space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between mb-3"><h2 className="font-bold">{tr.creationPanel}</h2><span className="text-[11px] rounded-full bg-brand-500/10 text-brand-200 px-2 py-1">{tr.estimatedCost.replace('{points}', String(pointsCost))}</span></div><div className="grid grid-cols-2 gap-2 mb-4">{(['text','edit','background','scene','mask','agent'] as StudioMode[]).map(m => <button key={m} onClick={() => setMode(m)} className={`rounded-2xl px-3 py-3 text-sm border ${mode===m?'bg-brand-600 border-brand-500 text-white':'bg-white/5 border-white/10 text-slate-300'}`}>{modeIcon(m)} {tr[`mode_${m}`]}</button>)}</div>{(mode === 'text' || mode === 'agent') ? <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={5} placeholder={mode==='agent'?tr.agentPromptPlaceholder:tr.promptPlaceholderGeneric} className="w-full rounded-2xl bg-slate-950 border border-white/10 p-3 text-sm" /> : <textarea value={customPrompt} onChange={e=>setCustomPrompt(e.target.value)} rows={4} placeholder={mode==='background'?tr.backgroundPromptPlaceholder:mode==='mask'?tr.maskPromptPlaceholder:tr.editPromptPlaceholder} className="w-full rounded-2xl bg-slate-950 border border-white/10 p-3 text-sm" />}{mode==='mask' && <div className="mt-3 rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-3 text-xs text-yellow-100">🎭 {tr.maskModeHint}</div>}{mode==='agent' && <div className="mt-3 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-3 text-xs text-blue-100">🤖 {tr.agentModeHint}</div>}{mode==='scene' && <div className="grid grid-cols-3 gap-2 mt-3">{SCENES.map(s => <button key={s.id} onClick={()=>setScene(s.id)} className={`rounded-xl border px-2 py-2 text-xs ${scene===s.id?'bg-brand-600 border-brand-500':'bg-white/5 border-white/10'}`}><div>{s.e}</div>{lang==='zh'?s.zh:s.en}</button>)}</div>}<button onClick={submit} disabled={loading} className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand-600 to-blue-600 py-3 font-bold disabled:opacity-50">{loading ? tr.generating : tr.startGenerate}</button>{error && <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">❌ {error}</div>}</div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between mb-3"><h2 className="font-bold">{tr.referencePanel}</h2><button onClick={clearReferences} disabled={!references.length} className="text-xs text-slate-400 disabled:opacity-40">{tr.clearAllRefs}</button></div><div {...getRootProps()} className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer ${isDragActive?'border-brand-400 bg-brand-500/10':'border-white/10 bg-slate-950'}`}><input {...getInputProps()} /><div className="text-3xl mb-2">🖼️</div><div className="text-sm font-medium">{tr.multiReferenceUpload}</div><div className="text-xs text-slate-500 mt-1">PNG · JPG · WEBP · GIF</div></div>{references.length>0 && <div className="mt-3 grid grid-cols-4 gap-2">{references.map((url,i)=><div key={url} className={`relative rounded-xl overflow-hidden border ${activeRef===url?'border-brand-400 ring-2 ring-brand-400/30':'border-white/10'}`}><button onClick={()=>setActiveRef(url)} className="block w-full"><img src={url} className="aspect-square w-full object-cover" alt="" /></button><button onClick={()=>removeReference(url)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs">×</button><span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px]">{i+1}</span></div>)}</div>}<div className="mt-2 text-xs text-slate-400">{activeRef ? tr.activeReferenceReady : tr.noActiveReference}</div></div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><h2 className="font-bold mb-3">{tr.generationSpec}</h2><p className="text-xs text-slate-500 mb-1">{tr.quality}</p><div className="grid grid-cols-3 gap-2 mb-3">{QUALITY_OPTIONS.map(q=><button key={q.id} onClick={()=>setGenQuality(q.id)} className={`rounded-xl border px-2 py-2 text-xs ${genQuality===q.id?'bg-brand-600 border-brand-500':'bg-white/5 border-white/10'}`}>{tr[q.labelKey]} ×{q.mult}</button>)}</div><p className="text-xs text-slate-500 mb-1">{tr.resolution}</p><div className="grid grid-cols-2 gap-2 mb-3">{SIZE_OPTIONS.map(sz=><button key={sz.id} onClick={()=>setGenSize(sz.id)} className={`rounded-xl border px-2 py-2 text-xs ${genSize===sz.id?'bg-brand-600 border-brand-500':'bg-white/5 border-white/10'}`}>{sz.label}</button>)}</div><p className="text-xs text-slate-500 mb-1">{tr.outputFormat}</p><div className="grid grid-cols-3 gap-2">{(['png','jpeg','webp'] as OutputFormat[]).map(f=><button key={f} onClick={()=>setOutputFormat(f)} className={`rounded-xl border px-2 py-2 text-xs uppercase ${outputFormat===f?'bg-brand-600 border-brand-500':'bg-white/5 border-white/10'}`}>{f}</button>)}</div></div>
        </section>
        <section className="lg:col-span-8 space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 min-h-[280px]">{loading && <div className="p-12 text-center"><div className="animate-bounce text-5xl mb-3">🎨</div><div>{tr.generating}</div><div className="text-xs text-slate-500 mt-1">{tr.waitSeconds}</div></div>}{!loading && result && <div><div className="flex items-center justify-between mb-3"><h2 className="font-bold">✅ {tr.done}</h2><div className="flex flex-wrap gap-2 text-xs"><button onClick={()=>addReferenceFromGallery(result)} className="rounded-full bg-white/10 px-3 py-1">{tr.useAsReference}</button><button onClick={()=>toggleFavorite(result)} className="rounded-full bg-yellow-500/10 text-yellow-200 px-3 py-1">{favoriteUrls.includes(result)?tr.unfavorite:tr.favorite}</button><button onClick={()=>downloadAs(result, outputFormat, 'image-studio-result')} className="rounded-full bg-slate-100 text-slate-900 px-3 py-1">⬇️ {tr.download}</button><button onClick={()=>setResult(null)}>{tr.clear}</button></div></div><img src={result} className="w-full max-h-[720px] object-contain rounded-2xl bg-slate-950" alt="" /></div>}{!loading && !result && <div className="p-16 text-center text-slate-500"><div className="text-7xl mb-4">🧠</div><div className="font-medium text-slate-300">{tr.emptyStudioTitle}</div><div className="text-sm mt-2">{tr.emptyStudioDesc}</div></div>}</div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between mb-3"><div><h2 className="font-bold">{tr.taskStatus}</h2><p className="text-xs text-slate-500">{tr.taskStatusDesc}</p></div><div className="flex gap-2 text-xs"><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)} className="bg-slate-950 border border-white/10 rounded-xl px-2 py-2"><option value="all">{tr.allStatus}</option><option value="running">{tr.statusRunning}</option><option value="done">{tr.statusDone}</option><option value="error">{tr.statusError}</option></select><button onClick={()=>setTasks([])} className="rounded-xl border border-white/10 px-3 py-2 text-slate-400">{tr.clearTasks}</button></div></div><div className="space-y-2 max-h-48 overflow-auto">{tasks.length===0 && <div className="text-sm text-slate-500">{tr.noTasks}</div>}{tasks.map(task=><div key={task.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-950 p-3 text-sm"><div className="min-w-0"><div className="truncate">{task.prompt || tr.noPrompt}</div><div className="text-xs text-slate-500">{tr[`mode_${task.action}`]} · {task.status==='running'?tr.statusRunning:task.status==='done'?tr.statusDone:tr.statusError}</div></div>{task.outputUrl && <button onClick={()=>setResult(task.outputUrl!)} className="text-xs text-brand-300">{tr.view}</button>}</div>)}</div></div>
          {agentMessages.length>0 && <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><h2 className="font-bold mb-3">🤖 {tr.agentConversation}</h2><div className="space-y-2 max-h-56 overflow-auto">{agentMessages.map(m=><div key={m.id} className={`rounded-2xl p-3 text-sm ${m.role==='user'?'bg-brand-500/10':'bg-slate-950'}`}><div className="text-xs text-slate-500 mb-1">{m.role}</div><div>{m.content}</div>{m.imageUrl&&<button onClick={()=>setResult(m.imageUrl!)} className="mt-2 text-brand-300 text-xs">{tr.view}</button>}</div>)}</div></div>}
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3"><div><h2 className="font-bold">{tr.galleryTitle}</h2><p className="text-xs text-slate-500">{tr.galleryDescGeneric}</p></div><div className="flex flex-wrap gap-2"><button onClick={exportWorkspace} className="text-xs px-3 py-2 rounded-xl border border-white/10">{tr.exportWorkspace}</button><label className="text-xs px-3 py-2 rounded-xl border border-white/10 cursor-pointer">{tr.importWorkspace}<input type="file" accept="application/json" className="hidden" onChange={e=>e.target.files?.[0]&&importWorkspace(e.target.files[0])}/></label><button onClick={createCollection} className="text-xs px-3 py-2 rounded-xl border border-white/10">{tr.newCollection}</button><button onClick={()=>setViewMode('history')} className={`text-xs px-3 py-2 rounded-xl border ${viewMode==='history'?'bg-brand-600 border-brand-500':'border-white/10'}`}>📋 {tr.history} ({historyItems.length})</button><button onClick={()=>setViewMode('favorites')} className={`text-xs px-3 py-2 rounded-xl border ${viewMode==='favorites'?'bg-brand-600 border-brand-500':'border-white/10'}`}>⭐ {tr.favorites} ({favoriteItems.length})</button></div></div><div className="grid md:grid-cols-[1fr_auto_auto_auto] gap-2 mb-3"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr.searchImagesPlaceholder} className="rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm" /><select value={activeCollectionId} onChange={e=>setActiveCollectionId(e.target.value)} className="bg-slate-950 border border-white/10 rounded-xl px-2 py-2 text-xs"><option value="all">{tr.allCollections}</option>{collections.map(c=><option key={c.id} value={c.id}>{c.name} ({c.urls.length})</option>)}</select><button onClick={()=>setFavoriteOnly(v=>!v)} className={`rounded-xl border px-3 py-2 text-xs ${favoriteOnly?'bg-yellow-500/20 border-yellow-400 text-yellow-100':'border-white/10 text-slate-400'}`}>{tr.favoriteOnly}</button><button disabled={!selectedResults.size} onClick={async()=>{ await Promise.all(Array.from(selectedResults).map((url,i)=>downloadAs(url, outputFormat, `image-studio-${i+1}`))); setSelectedResults(new Set()); }} className="rounded-xl bg-slate-100 text-slate-900 px-3 py-2 text-xs disabled:opacity-30">⬇️ {tr.downloadSelected}</button></div><div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">{filteredItems.map(item=><div key={item.url} className="relative rounded-2xl border border-white/10 bg-slate-950 p-2"><button onClick={()=>setResult(item.url)} className="block w-full"><img src={item.url} className="aspect-square w-full object-cover rounded-xl bg-slate-900" alt={tr.historyImageAlt} /></button><button onClick={()=>{const next=new Set(selectedResults); next.has(item.url)?next.delete(item.url):next.add(item.url); setSelectedResults(next);}} className={`absolute left-3 top-3 w-6 h-6 rounded-full text-xs border ${selectedResults.has(item.url)?'bg-brand-600 border-brand-500':'bg-black/60 border-white/20'}`}>{selectedResults.has(item.url)?'✓':'+'}</button><div className="mt-2 text-[11px] text-slate-500 truncate">{item.prompt || item.action || item.size || tr.galleryItem}</div><div className="mt-2 flex flex-wrap gap-1 text-[11px]"><button onClick={()=>setResult(item.url)} className="rounded-md bg-white/10 px-2 py-1">{tr.view}</button><button onClick={()=>addReferenceFromGallery(item.url)} className="rounded-md bg-brand-600 px-2 py-1 text-white">{tr.specifyReference}</button><button onClick={()=>toggleFavorite(item.url)} className="rounded-md bg-yellow-500/10 px-2 py-1 text-yellow-200">{favoriteUrls.includes(item.url)?tr.unfavorite:tr.favorite}</button><button onClick={()=>addToCollection(item.url)} className="rounded-md bg-purple-500/10 px-2 py-1 text-purple-200">{tr.addToCollection}</button><button onClick={()=>downloadAs(item.url, outputFormat, 'image-studio-gallery')} className="rounded-md bg-white/10 px-2 py-1">{tr.download}</button><button onClick={()=>deleteImage(item.url, viewMode)} className="rounded-md bg-red-500/10 px-2 py-1 text-red-200">{tr.delete}</button></div></div>)}</div>{filteredItems.length===0 && <div className="py-12 text-center text-slate-500 text-sm">{tr.noImagesMatched}</div>}</div>
        </section>
      </div>
      <Modal show={showLogin} title={'🔐 ' + tr.loginTitle} onClose={() => setShowLogin(false)}>{authError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{authError}</div>}<input value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder={tr.email} type="email" className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-3" /><input value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder={tr.password} type="password" onKeyDown={e=>e.key==='Enter'&&doLogin()} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-4" /><button onClick={doLogin} className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold">{tr.login}</button><button onClick={()=>{setShowLogin(false);setShowForgot(true);setForgotEmail(authEmail);setForgotSent(false);setAuthError('');}} className="w-full text-center text-xs text-slate-400 hover:text-brand-600 mt-2">{tr.forgotPassword}</button><p className="text-center text-sm text-slate-400 mt-3">{tr.noAccount} <button onClick={()=>{setShowLogin(false);setShowRegister(true);}} className="text-brand-600">{tr.register}</button></p></Modal>
      <Modal show={showRegister} title={'✨ ' + tr.registerTitle} onClose={() => setShowRegister(false)}>{authError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{authError}</div>}<input value={authName} onChange={e=>setAuthName(e.target.value)} placeholder={tr.name} className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-3" /><input value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder={tr.email} type="email" className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-3" /><input value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder={tr.passwordHint} type="password" className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-4" /><button onClick={doRegister} className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold">{tr.register}</button></Modal>
      <Modal show={showForgot} title={'🔑 ' + tr.forgotTitle} onClose={() => setShowForgot(false)}>{forgotSent ? <div className="text-center"><p className="text-5xl mb-4">📧</p><p className="font-medium text-slate-700 mb-2">{tr.emailSent}</p><p className="text-sm text-slate-500 mb-4">{tr.resetEmailSent.replace('{email}', forgotEmail)}</p><button onClick={()=>{setShowForgot(false);setShowLogin(true);setForgotSent(false);}} className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold">{tr.backToLogin}</button></div> : <>{authError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{authError}</div>}<p className="text-sm text-slate-500 mb-4">{tr.forgotDesc}</p><input value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} placeholder={tr.registeredEmail} type="email" className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-4" /><button onClick={doForgot} className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold">{tr.sendResetLink}</button></>}</Modal>
      <Modal show={showPay} title={'🚀 ' + tr.upgradeTitle} onClose={() => setShowPay(false)}><p className="text-slate-500 text-center text-sm mb-4">{usageLeft <= 0 ? tr.limitReached : tr.freeLeftDesc.replace('{left}', String(usageLeft))}</p><a href={process.env.NEXT_PUBLIC_STRIPE_LINK || '#'} target="_blank" rel="noopener" className="block w-full bg-brand-600 text-white text-center py-2.5 rounded-xl font-semibold">💳 {tr.upgradeBtn}</a><button onClick={()=>setShowPay(false)} className="w-full mt-2 text-slate-400 text-sm">{tr.later}</button></Modal>
    </main>
  </>;
}
