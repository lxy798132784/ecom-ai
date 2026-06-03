import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSession, signIn, signOut } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { t, Lang } from '../lib/i18n';

type StudioMode = 'text' | 'edit' | 'background' | 'scene' | 'mask' | 'agent';
type TaskStatus = 'running' | 'done' | 'error';
type OutputFormat = 'png' | 'jpeg' | 'webp';
type SizeTier = '1K' | '2K' | '4K';
type SizePickerMode = 'auto' | 'ratio' | 'resolution';
type GalleryItem = { id?: string; url: string; prompt?: string; action?: string; quality?: string; size?: string; createdAt?: string; provider?: string; model?: string; outputFormat?: string; referenceCount?: number };
type StudioTask = { id: string; prompt: string; action: StudioMode; status: TaskStatus; inputUrl?: string; outputUrl?: string; error?: string; createdAt: number; finishedAt?: number };
type FavoriteCollection = { id: string; name: string; urls: string[]; createdAt: number; updatedAt: number };
type AgentMessage = { id: string; role: 'user' | 'assistant'; content: string; imageUrl?: string; createdAt: number };
type MediaStatus = { video?: { configured: boolean }; audio?: { configured: boolean }; voiceClone?: { configured: boolean } };

const COLLECTION_KEY = 'image-studio-favorite-collections';
const AGENT_KEY = 'image-studio-agent-messages';
const QUALITY_OPTIONS = [
  { id: 'auto', labelKey: 'qualityAuto', mult: 2 },
  { id: 'low', labelKey: 'qualityLow', mult: 1 },
  { id: 'medium', labelKey: 'qualityMedium', mult: 2 },
  { id: 'high', labelKey: 'qualityHigh', mult: 4 },
] as const;
const SIZE_TIERS: SizeTier[] = ['1K', '2K', '4K'];
const RATIO_OPTIONS = [
  { label: '1:1', value: '1:1' },
  { label: '3:2', value: '3:2' },
  { label: '2:3', value: '2:3' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
  { label: '21:9', value: '21:9' },
] as const;
const SIZE_OPTIONS = SIZE_TIERS.flatMap(tier => RATIO_OPTIONS.map(ratio => {
  const size = calculateImageSize(tier, ratio.value);
  return { id: size, label: `${tier} · ${ratio.label} · ${size.replace('x', '×')}`, mult: tier === '4K' ? 5 : tier === '2K' ? 3 : 1 };
}));
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
function round16(value: number) { return Math.max(16, Math.round(value / 16) * 16); }
function floor16(value: number) { return Math.max(16, Math.floor(value / 16) * 16); }
function ceil16(value: number) { return Math.max(16, Math.ceil(value / 16) * 16); }
function normalizeDimensions(width: number, height: number) {
  let w = round16(width), h = round16(height);
  const fit = (scale: number) => { w = floor16(w * scale); h = floor16(h * scale); };
  const fill = (scale: number) => { w = ceil16(w * scale); h = ceil16(h * scale); };
  for (let i = 0; i < 4; i++) {
    const maxEdge = Math.max(w, h);
    if (maxEdge > 3840) fit(3840 / maxEdge);
    if (w / h > 3) w = floor16(h * 3); else if (h / w > 3) h = floor16(w * 3);
    const pixels = w * h;
    if (pixels > 8294400) fit(Math.sqrt(8294400 / pixels)); else if (pixels < 655360) fill(Math.sqrt(655360 / pixels));
  }
  return { width: w, height: h };
}
function normalizeImageSize(size: string) { const m = String(size).trim().match(/^(\d+)\s*[xX×]\s*(\d+)$/); if (!m) return String(size).trim(); const d = normalizeDimensions(Number(m[1]), Number(m[2])); return `${d.width}x${d.height}`; }
function parseRatio(ratio: string) { const m = String(ratio).trim().match(/^(\d+(?:\.\d+)?)\s*[:xX×]\s*(\d+(?:\.\d+)?)$/); if (!m) return null; const width = Number(m[1]), height = Number(m[2]); return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? { width, height } : null; }
function calculateImageSize(tier: SizeTier, ratio: string) {
  const parsed = parseRatio(ratio) || { width: 1, height: 1 };
  const exact: Record<string, Record<string, string>> = {
    '1K': { '1:1': '1024x1024', '3:2': '1216x816', '2:3': '816x1216', '16:9': '1280x720', '9:16': '720x1280', '4:3': '1152x864', '3:4': '864x1152', '21:9': '1360x576' },
    '2K': { '1:1': '2048x2048', '3:2': '2160x1440', '2:3': '1440x2160', '16:9': '2560x1440', '9:16': '1440x2560', '4:3': '2048x1536', '3:4': '1536x2048', '21:9': '2560x1088' },
    '4K': { '1:1': '2880x2880', '3:2': '3360x2240', '2:3': '2240x3360', '16:9': '3840x2160', '9:16': '2160x3840', '4:3': '3328x2496', '3:4': '2496x3328', '21:9': '3840x1648' },
  };
  if (exact[tier]?.[ratio]) return exact[tier][ratio];
  const pixels = tier === '4K' ? 8294400 : tier === '2K' ? 4194304 : 1048576;
  const w = Math.sqrt(pixels * parsed.width / parsed.height);
  const h = w * parsed.height / parsed.width;
  const d = normalizeDimensions(w, h);
  return `${d.width}x${d.height}`;
}
function uniqueImages(items: string[]): string[] { return Array.from(new Set((items || []).filter(Boolean))); }
function calcPoints(quality: string, size: string) { const q = QUALITY_OPTIONS.find(x => x.id === quality)?.mult || 2; if (size === 'auto') return q; const m = String(size).match(/^(\d+)x(\d+)$/); if (!m) return q; const mp = (Number(m[1]) * Number(m[2])) / (1024 * 1024); const sm = mp > 7 ? 5 : mp > 3 ? 3 : mp > 1.5 ? 2 : 1; return q * sm; }
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
async function resizeImg(file: File, quality = 0.9): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > 1536 || h > 1536) { const r = Math.min(1536 / w, 1536 / h); w = Math.round(w * r); h = Math.round(h * r); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality));
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
  const [selectedRefUrls, setSelectedRefUrls] = useState<string[]>([]);
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
  const [mediaStatus, setMediaStatus] = useState<MediaStatus>({});
  const [detailItem, setDetailItem] = useState<GalleryItem | null>(null);
  const [dateFilter, setDateFilter] = useState<'all'|'today'|'week'>('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [batchCount, setBatchCount] = useState(1);
  const [compressionQuality, setCompressionQuality] = useState(0.9);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [genQuality, setGenQuality] = useState<'auto'|'low'|'medium'|'high'>('auto');
  const [genSize, setGenSize] = useState<string>('auto');
  const [moderation, setModeration] = useState<'auto'|'low'>('auto');
  const [sizePickerMode, setSizePickerMode] = useState<SizePickerMode>('auto');
  const [sizeTier, setSizeTier] = useState<SizeTier>('1K');
  const [sizeRatio, setSizeRatio] = useState('1:1');
  const [customRatio, setCustomRatio] = useState('16:9');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png');
  const [scene, setScene] = useState('cinematic studio');
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [customWidth, setCustomWidth] = useState('1024');
  const [customHeight, setCustomHeight] = useState('1024');
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
  const displaySize = genSize === 'auto' ? tr.sizeAuto : genSize;
  const compressionPercent = Math.round(compressionQuality * 100);
  const favoriteUrls = favoriteItems.map(x => x.url);
  const activeGallery = viewMode === 'history' ? historyItems : favoriteItems;
  const selectedReferenceImages = selectedRefUrls.filter(url => references.includes(url));
  const primaryReference = (activeRef && selectedReferenceImages.includes(activeRef)) ? activeRef : (selectedReferenceImages[0] || '');

  useEffect(() => { setLangState(getLang()); setCollections(readLocalJson(COLLECTION_KEY, [])); fetch('/api/collections').then(r => r.json()).then(d => { if (d.items) { setCollections(d.items); writeLocalJson(COLLECTION_KEY, d.items); } }).catch(() => {}); setAgentMessages(readLocalJson(AGENT_KEY, [])); fetch('/api/media-status').then(r => r.json()).then(setMediaStatus).catch(() => {}); }, []);
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

  const selected = selectedResults;
  const toggleSelect = (url: string) => setSelectedResults(prev => { const next = new Set(prev); next.has(url) ? next.delete(url) : next.add(url); return next; });
  const downloadSelected = () => selectedResults.forEach(url => downloadAs(url, outputFormat, 'studio-selected'));

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase(); const favSet = new Set(favoriteUrls);
    return activeGallery.filter(item => {
      const task = tasks.find(x => x.outputUrl === item.url);
      if (favoriteOnly && !favSet.has(item.url)) return false;
      if (activeCollectionId !== 'all' && !collections.find(c => c.id === activeCollectionId)?.urls.includes(item.url)) return false;
      if (sizeFilter !== 'all' && item.size !== sizeFilter) return false;
      if (dateFilter !== 'all') { const ts = item.createdAt ? new Date(item.createdAt).getTime() : 0; const age = Date.now() - ts; if (!ts || (dateFilter === 'today' && age > 86400000) || (dateFilter === 'week' && age > 7 * 86400000)) return false; }
      if (statusFilter !== 'all' && task?.status !== statusFilter) return false;
      if (!q) return true;
      return [item.prompt, item.action, item.quality, item.size, item.model, item.provider, item.url].some(v => String(v || '').toLowerCase().includes(q));
    });
  }, [activeGallery, search, favoriteOnly, statusFilter, favoriteUrls, tasks, activeCollectionId, collections, dateFilter, sizeFilter]);

  const onDrop = useCallback((accepted: File[]) => {
    if (!accepted.length) return;
    setError(tr.compressing);
    Promise.all(accepted.map(f => resizeImg(f, compressionQuality))).then(dataUrls => { setReferences(prev => uniqueImages([...prev, ...dataUrls]).slice(0, 12)); setActiveRef(dataUrls[0]); setSelectedRefUrls(prev => uniqueImages([...prev, ...dataUrls]).slice(0, 12)); setError(''); }).catch(() => setError(tr.failed));
  }, [tr.compressing, tr.failed, compressionQuality]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': ['.png','.jpg','.jpeg','.webp','.gif'] }, maxFiles: 12 });

  const toggleLang = () => { const next = lang === 'zh' ? 'en' : 'zh'; setLangState(next); setLang(next); };
  const addReferenceFromGallery = (url: string) => { setReferences(prev => uniqueImages([url, ...prev]).slice(0, 12)); setActiveRef(url); setSelectedRefUrls(prev => uniqueImages([url, ...prev]).slice(0, 12)); setMode('edit'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggleReferenceSelection = (url: string) => setSelectedRefUrls(prev => {
    const next = prev.includes(url) ? prev.filter(x => x !== url) : uniqueImages([...prev, url]).slice(0, 12);
    if (!next.includes(activeRef) && activeRef === url) setActiveRef(next[0] || '');
    if (!activeRef && next.includes(url)) setActiveRef(url);
    return next;
  });
  const selectAllReferences = () => { setSelectedRefUrls(references); if (!activeRef && references[0]) setActiveRef(references[0]); };
  const clearSelectedReferences = () => setSelectedRefUrls([]);
  const setPrimaryReference = (url: string) => { setActiveRef(url); setSelectedRefUrls(prev => prev.includes(url) ? prev : uniqueImages([url, ...prev]).slice(0, 12)); };
  const removeReference = (url: string) => { const next = references.filter(x => x !== url); setReferences(next); setSelectedRefUrls(prev => prev.filter(x => x !== url)); if (activeRef === url) setActiveRef(next[0] || ''); };
  const clearReferences = () => { setReferences([]); setActiveRef(''); setSelectedRefUrls([]); };
  const applyPromptTemplate = (text: string) => { if (mode === 'text' || mode === 'agent') setPrompt(text); else setCustomPrompt(text); };
  const currentPromptValue = mode === 'text' || mode === 'agent' ? prompt : customPrompt;
  const setCurrentPromptValue = (value: string) => { if (mode === 'text' || mode === 'agent') setPrompt(value); else setCustomPrompt(value); };
  const appendPromptStyle = (text: string) => {
    const base = currentPromptValue.trim();
    if (base.toLowerCase().includes(text.toLowerCase())) return;
    setCurrentPromptValue([base, text].filter(Boolean).join(', '));
  };
  const enhancePrompt = () => {
    const base = currentPromptValue.trim();
    if (!base) { setCurrentPromptValue(tr.promptEnhanceSeed); return; }
    if (base.includes(tr.promptEnhanceSuffix)) return;
    setCurrentPromptValue(`${base}, ${tr.promptEnhanceSuffix}`);
  };
  const draftWithAgent = () => {
    const base = currentPromptValue.trim();
    const seed = base || tr.agentPromptSeed;
    setPrompt(`${seed}

${tr.agentDraftSuffix}`);
    setMode('agent');
  };

  const submit = async () => {
    if (!loggedIn) { setShowLogin(true); return; }
    if (mode !== 'text' && mode !== 'agent' && !primaryReference) { setError(tr.referenceRequired); return; }
    const basePrompt = (mode === 'text' || mode === 'agent' ? prompt : customPrompt).trim();
    if ((mode === 'text' || mode === 'edit' || mode === 'mask' || mode === 'agent') && !basePrompt) { setError(tr.pleaseFill); return; }
    if (usageLeft < pointsCost && credits < pointsCost) { accountPlan === 'pro' ? setError(tr.proMonthlyNotEnough) : setShowPay(true); return; }
    const action = mode === 'text' || mode === 'agent' ? 'text2img' : mode === 'background' ? 'whitebg' : mode === 'scene' ? 'scene' : 'custom';
    const effectivePrompt = mode === 'mask' ? `${basePrompt}. Apply as localized inpainting-style edit while preserving unmentioned areas.` : mode === 'agent' ? `${basePrompt}. Use this as a polished final image prompt; prioritize clear subject, coherent composition, lighting, style consistency, and production-ready details.` : basePrompt;
    const id = newId();
    setTasks(p => [{ id, prompt: effectivePrompt || scene, action: mode, status: 'running' as const, inputUrl: primaryReference, createdAt: Date.now() }, ...p].slice(0, 50));
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: primaryReference, action, scene, prompt: effectivePrompt, customPrompt: effectivePrompt, quality: genQuality, size: genSize, output_format: outputFormat, output_compression: outputFormat === 'png' ? null : compressionPercent, moderation, referenceImages: selectedReferenceImages, batch: batchCount > 1, batchCount: Math.min(12, Math.max(1, Number(batchCount) || 1)), compressionQuality }) });
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
  const createCollection = () => { const name = window.prompt(tr.newCollectionName); if (!name?.trim()) return; const next = [{ id: newId(), name: name.trim(), urls: [], createdAt: Date.now(), updatedAt: Date.now() }, ...collections]; setCollections(next); writeLocalJson(COLLECTION_KEY, next); fetch('/api/collections', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: name.trim() }) }).then(r => r.json()).then(d => d.items && setCollections(d.items)).catch(() => {}); };
  const addToCollection = (url: string) => { if (!collections.length) { const next = [{ id: newId(), name: tr.favorites, urls: [url], createdAt: Date.now(), updatedAt: Date.now() }]; setCollections(next); writeLocalJson(COLLECTION_KEY, next); return; } const name = window.prompt(`${tr.addToCollectionPrompt}: ${collections.map(c => c.name).join(', ')}`); const col = collections.find(c => c.name === name || c.id === name) || collections[0]; const next = collections.map(c => c.id === col.id ? { ...c, urls: uniqueImages([url, ...c.urls]), updatedAt: Date.now() } : c); setCollections(next); writeLocalJson(COLLECTION_KEY, next); fetch('/api/collections', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: next }) }).catch(() => {}); };
  const exportWorkspace = () => { const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), references, activeRef, selectedRefUrls, tasks, collections, agentMessages, historyItems, favoriteItems }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'image-studio-workspace.json'; a.click(); URL.revokeObjectURL(url); };
  const importWorkspace = async (file: File) => { const payload = JSON.parse(await file.text()); if (Array.isArray(payload.references)) setReferences(payload.references.slice(0, 12)); if (typeof payload.activeRef === 'string') setActiveRef(payload.activeRef); if (Array.isArray(payload.selectedRefUrls)) setSelectedRefUrls(payload.selectedRefUrls.slice(0, 12)); if (Array.isArray(payload.tasks)) setTasks(payload.tasks.slice(0, 50)); if (Array.isArray(payload.collections)) { setCollections(payload.collections); writeLocalJson(COLLECTION_KEY, payload.collections); } if (Array.isArray(payload.agentMessages)) { setAgentMessages(payload.agentMessages); writeLocalJson(AGENT_KEY, payload.agentMessages); } };
  const doLogin = async () => { setAuthError(''); const res = await signIn('credentials', { email: authEmail, password: authPassword, redirect: false }); if (res?.error) { setAuthError(tr.authError); return; } setShowLogin(false); };
  const doRegister = async () => { setAuthError(''); if (!authEmail.trim() || !authPassword.trim()) { setAuthError(tr.pleaseFill); return; } const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: authEmail, password: authPassword, name: authName }) }); const data = await res.json(); if (!res.ok) { setAuthError(data.error); return; } await signIn('credentials', { email: authEmail, password: authPassword, redirect: false }); setShowRegister(false); };
  const doForgot = async () => { if (!forgotEmail.trim()) { setAuthError(tr.pleaseFill); return; } const res = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail }) }); if (!res.ok) { const d = await res.json(); setAuthError(d.error); return; } setForgotSent(true); };


  const mediaTools = [
    { href: '/video', key: 'video', icon: '🎬', label: tr.videoTool, desc: tr.videoToolDesc, ready: mediaStatus.video?.configured },
    { href: '/audio', key: 'audio', icon: '🎙️', label: tr.audioTool, desc: tr.audioToolDesc, ready: mediaStatus.audio?.configured },
    { href: '/voice-clone', key: 'voiceClone', icon: '🗣️', label: tr.voiceCloneTool, desc: tr.voiceCloneToolDesc, ready: mediaStatus.voiceClone?.configured },
  ];
  const withResult = (href: string) => result ? `${href}?input=${encodeURIComponent(result)}` : href;

  const modeIcon = (m: StudioMode) => m === 'text' ? '✍️' : m === 'edit' ? '🖌️' : m === 'background' ? '🪄' : m === 'scene' ? '🏞️' : m === 'mask' ? '🎭' : '🤖';

  return <>
    <Head><title>{tr.studioBrand} - AI Image Studio</title><meta name="description" content={tr.studioMeta} /></Head>
    <main className="studio-shell min-h-screen bg-[#08090a] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#08090a]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div><div className="text-lg font-black tracking-tight">🎨 {tr.studioBrand}</div><div className="text-xs text-slate-500">{tr.multimodalNav}</div></div>
          <nav className="hidden items-center gap-1 text-xs md:flex">
            <Link href="/" className="rounded-full bg-brand-600 px-3 py-1.5 text-white">{tr.imageWorkspace}</Link>
            <Link href="/video" className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:text-white">🎬 {tr.videoTool}</Link>
            <Link href="/audio" className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:text-white">🎙️ {tr.audioTool}</Link>
            <Link href="/voice-clone" className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:text-white">🗣️ {tr.voiceCloneTool}</Link>
            <Link href="/manual" className="rounded-full border border-white/10 px-3 py-1.5 text-slate-300 hover:text-white">📘 {tr.manual}</Link><Link href="/blog" className="rounded-full border border-white/10 px-3 py-1.5 text-slate-400">Blog</Link>
          </nav>
          <div className="flex items-center gap-2 text-xs">
            <button onClick={toggleLang} className="rounded-lg border border-white/10 px-2 py-1">{lang === 'zh' ? 'EN' : '中'}</button>
            {loggedIn ? <><span className="hidden text-slate-400 sm:inline">{session?.user?.email}</span><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">{accountPlan.toUpperCase()} · {usageLeft}+{credits}</span><button onClick={() => signOut()}>{tr.logout}</button></> : <><button onClick={() => setShowLogin(true)} className="text-brand-300">{tr.login}</button><button onClick={() => setShowRegister(true)} className="rounded-full bg-brand-600 px-3 py-1.5 text-white">{tr.register}</button></>}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pt-8">
        <div className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(94,106,210,.28),transparent_34%),rgba(255,255,255,.03)] p-6 shadow-2xl md:p-8">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
            <div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-brand-300">{tr.studioHeroKicker}</p><h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-50 md:text-5xl">{tr.studioHeroTitle}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 md:text-base">{tr.studioHeroDesc}</p></div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="text-[11px] text-slate-500">{tr.selectedRefsLabel}</div><div className="mt-1 text-2xl font-bold text-slate-100">{selectedReferenceImages.length}</div></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="text-[11px] text-slate-500">{tr.resolution}</div><div className="mt-1 truncate text-lg font-bold text-slate-100">{displaySize}</div></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="text-[11px] text-slate-500">{tr.outputFormat}</div><div className="mt-1 text-2xl font-bold text-slate-100">{outputFormat.toUpperCase()}</div></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><div className="text-[11px] text-slate-500">{tr.batchCount}</div><div className="mt-1 text-2xl font-bold text-slate-100">×{batchCount}</div></div>
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {mediaTools.map(tool => <Link key={tool.key} href={withResult(tool.href)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 hover:border-brand-400/60"><div className="flex items-center justify-between gap-2"><span className="text-2xl">{tool.icon}</span><span className={`shrink-0 rounded-full px-2 py-1 ${tool.ready ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>{tool.ready ? tr.configured : tr.pendingConfig}</span></div><div className="mt-3 font-semibold text-slate-100">{tool.label}</div><div className="mt-1 line-clamp-2 text-slate-500">{tool.desc}</div></Link>)}
              </div>
            </div>
          </div>
        </div>
      </section>
      {!loggedIn && <div className="mx-auto mt-4 max-w-3xl px-4"><div className="rounded-2xl border border-brand-500/30 bg-brand-500/10 p-4 text-center text-sm">🔐 {tr.loginRequired}</div></div>}

      <section className="mx-auto max-w-7xl px-4 pt-5">
        <div className="grid gap-2 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-2 text-xs md:grid-cols-5">
          {[
            ['01', tr.workflowPrompt, '#create'],
            ['02', tr.workflowReference, '#references'],
            ['03', tr.workflowSpecs, '#specs'],
            ['04', tr.workflowGenerate, '#create'],
            ['05', tr.workflowReuse, '#gallery'],
          ].map(step => <a key={step[0]} href={step[2]} className="group rounded-2xl border border-white/[0.06] bg-[#08090a] p-3 transition hover:border-brand-400/50 hover:bg-white/[0.04]"><div className="font-mono text-[10px] text-brand-300">{step[0]}</div><div className="mt-1 font-semibold text-slate-200 group-hover:text-white">{step[1]}</div></a>)}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-5">
        <section id="create" className="rounded-[28px] border border-white/[0.08] bg-[#0f1011]/95 p-3 shadow-2xl shadow-black/30 backdrop-blur md:p-4">
          <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_200px] xl:items-start">
            <div className="grid self-start grid-cols-2 gap-1.5 rounded-2xl border border-white/[0.06] bg-black/25 p-1.5 sm:grid-cols-3 xl:grid-cols-2">
              {(['text','edit','background','scene','mask','agent'] as StudioMode[]).map(m => <button key={m} onClick={() => setMode(m)} className={`rounded-xl px-2.5 py-2 text-xs font-medium transition ${mode === m ? 'bg-brand-600 text-white shadow-[0_0_0_1px_rgba(255,255,255,.12)_inset]' : 'text-slate-400 hover:bg-white/[0.07] hover:text-slate-100'}`}><span className="mr-1">{modeIcon(m)}</span>{tr[`mode_${m}`]}</button>)}
            </div>
            <div className="min-w-0">
              {(mode === 'text' || mode === 'agent') ? <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder={mode === 'agent' ? tr.agentPromptPlaceholder : tr.promptPlaceholderGeneric} className="h-full min-h-[106px] w-full resize-none rounded-2xl border border-white/[0.08] bg-[#08090a] p-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-brand-400/70" /> : <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} rows={3} placeholder={mode === 'background' ? tr.backgroundPromptPlaceholder : mode === 'mask' ? tr.maskPromptPlaceholder : tr.editPromptPlaceholder} className="h-full min-h-[106px] w-full resize-none rounded-2xl border border-white/[0.08] bg-[#08090a] p-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-brand-400/70" />}
              <div className="mt-2 rounded-2xl border border-white/[0.06] bg-black/20 p-2">
                <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
                  <button onClick={enhancePrompt} className="rounded-xl border border-brand-400/40 bg-brand-500/15 px-3 py-2 text-xs font-semibold text-brand-100 hover:bg-brand-500/25">✨ {tr.enhancePrompt}</button>
                  <button onClick={draftWithAgent} className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100 hover:bg-blue-500/20">🤖 {tr.agentDraftAction}</button>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{tr.promptTemplateGroup}</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button onClick={() => applyPromptTemplate(tr.templateCinematicPrompt)} className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]">{tr.templateCinematic}</button>
                      <button onClick={() => applyPromptTemplate(tr.templatePortraitPrompt)} className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]">{tr.templatePortrait}</button>
                      <button onClick={() => applyPromptTemplate(tr.templateProductPrompt)} className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/[0.06]">{tr.templateProduct}</button>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{tr.promptStyleGroup}</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button onClick={() => appendPromptStyle(tr.stylePhotorealPrompt)} className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-400 hover:bg-white/[0.06] hover:text-white">{tr.stylePhotoreal}</button>
                      <button onClick={() => appendPromptStyle(tr.styleDesignPosterPrompt)} className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-400 hover:bg-white/[0.06] hover:text-white">{tr.styleDesignPoster}</button>
                      <button onClick={() => appendPromptStyle(tr.styleMinimalPrompt)} className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-slate-400 hover:bg-white/[0.06] hover:text-white">{tr.styleMinimal}</button>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[11px] leading-5 text-slate-500">{tr.promptAssistHint}</div>
                {mode === 'scene' && <div className="mt-2 flex flex-wrap gap-1.5">{SCENES.slice(0, 4).map(s => <button key={s.id} onClick={() => setScene(s.id)} className={`rounded-full border px-2.5 py-1 text-xs ${scene === s.id ? 'border-brand-400 bg-brand-500/20 text-brand-100' : 'border-white/10 text-slate-400 hover:text-white'}`}>{s.e} {lang === 'zh' ? s.zh : s.en}</button>)}</div>}
              </div>
              {mode === 'mask' && <div className="mt-2 rounded-xl border border-yellow-400/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">🎭 {tr.maskModeHint}</div>}
              {mode === 'agent' && <div className="mt-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">🤖 {tr.agentModeHint}</div>}
            </div>
            <div className="flex flex-col justify-between gap-2">
              <a href="#specs" className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 xl:grid-cols-1" aria-label={tr.generationSpec}>
                <span className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 text-left"><b className="text-slate-200">{displaySize}</b> · {outputFormat.toUpperCase()} · {tr[QUALITY_OPTIONS.find(q => q.id === genQuality)?.labelKey || 'qualityAuto']}</span>
                <span className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-2.5 py-2 text-left">{tr.selectedRefs.replace('{count}', String(selectedReferenceImages.length))} · ×{batchCount} · {outputFormat === 'png' ? 'PNG' : compressionPercent + '%'}</span>
              </a>
              <button onClick={submit} disabled={loading} className="min-h-[48px] rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-900/30 transition hover:brightness-110 disabled:opacity-50">{loading ? tr.generatingShort : tr.generate}</button>
            </div>
          </div>
        </section>
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 pb-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
          <div id="references" className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-100">{tr.referencePanel}</h2><button onClick={clearReferences} disabled={!references.length} className="rounded-full px-2 py-1 text-xs text-slate-500 hover:bg-white/[0.06] disabled:opacity-40">{tr.clearAllRefs}</button></div>
            <div {...getRootProps()} className={`cursor-pointer rounded-2xl border border-dashed p-5 text-center transition ${isDragActive ? 'border-brand-400 bg-brand-500/10' : 'border-white/10 bg-[#08090a] hover:border-brand-400/50 hover:bg-white/[0.04]'}`}><input {...getInputProps({ className: 'hidden' })} /><div className="mb-2 text-2xl">🖼️</div><div className="text-sm font-medium text-slate-200">{tr.multiReferenceUpload}</div><div className="mt-1 text-[11px] text-slate-500">PNG · JPG · WEBP · GIF</div></div>
            {references.length > 0 && <><div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><button onClick={selectAllReferences} className="rounded-full border border-white/10 px-2 py-1 text-slate-300 hover:bg-white/[0.06]">{tr.selectAllRefs}</button><button onClick={clearSelectedReferences} className="rounded-full border border-white/10 px-2 py-1 text-slate-300 hover:bg-white/[0.06]">{tr.clearSelectedRefs}</button><span className="text-slate-500">{tr.selectedRefs.replace('{count}', String(selectedReferenceImages.length))}</span></div><div className="mt-3 grid grid-cols-3 gap-2">{references.map((url, i) => <div key={url} className={`relative overflow-hidden rounded-xl border ${selectedRefUrls.includes(url) ? 'border-emerald-400 ring-2 ring-emerald-400/25' : activeRef === url ? 'border-brand-400 ring-2 ring-brand-400/25' : 'border-white/10'}`}><button onClick={() => toggleReferenceSelection(url)} className="block w-full"><img src={url} className="aspect-square w-full object-cover" alt="" /></button><button onClick={() => removeReference(url)} className="absolute right-1 top-1 h-5 w-5 rounded-full bg-black/75 text-xs text-white">×</button><span className="absolute left-1 top-1 rounded bg-black/75 px-1 text-[10px]">{selectedRefUrls.includes(url) ? '✓' : i + 1}</span><button onClick={() => setPrimaryReference(url)} className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px]">{tr.primaryRef}</button></div>)}</div></>}
            <div className="mt-2 text-xs text-slate-500">{selectedReferenceImages.length ? tr.multiReferenceReady.replace('{count}', String(selectedReferenceImages.length)) : tr.noActiveReference}</div>
          </div>

          <div id="specs" className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><h2 className="text-sm font-semibold text-slate-100">{tr.generationSpec}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{tr.specHint}</p></div>
              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-300">{pointsCost * batchCount} pts</span>
            </div>
            <div className="space-y-3">
              <button type="button" onClick={() => setShowSizePicker(true)} title={tr.openSizePicker} className="group flex w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-[#08090a] px-3.5 py-3 text-left transition hover:border-brand-400/50 hover:bg-white/[0.035]">
                <div><div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">{tr.resolution}</div><div className="mt-1 font-mono text-[15px] font-semibold text-slate-100">{displaySize}</div></div>
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300 group-hover:text-white">{tr.openSizePicker}</div>
              </button>
              <div className="grid grid-cols-4 gap-1 rounded-2xl border border-white/[0.08] bg-[#08090a] p-1">{QUALITY_OPTIONS.map(q => <button key={q.id} onClick={() => setGenQuality(q.id)} className={`rounded-xl px-2 py-2 text-xs font-medium transition ${genQuality === q.id ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-white/[0.08] hover:text-slate-100'}`}>{tr[q.labelKey]}</button>)}</div>
              <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/[0.08] bg-[#08090a] p-1">{(['png','jpeg','webp'] as OutputFormat[]).map(f => <button key={f} onClick={() => setOutputFormat(f)} className={`rounded-xl px-2 py-2 text-xs font-semibold uppercase tracking-wide transition ${outputFormat === f ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-white/[0.08] hover:text-white'}`}>{f}</button>)}</div>
              <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/[0.08] bg-[#08090a] p-1"><button onClick={() => setModeration('auto')} className={`rounded-xl px-2 py-2 text-xs font-medium ${moderation === 'auto' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-white/[0.08]'}`}>{tr.moderationAuto}</button><button onClick={() => setModeration('low')} className={`rounded-xl px-2 py-2 text-xs font-medium ${moderation === 'low' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-white/[0.08]'}`}>{tr.moderationLow}</button></div>
              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-2xl border border-white/[0.08] bg-[#08090a] p-3" title={outputFormat === 'png' ? tr.compressionDisabledHint : tr.helpSpecDesc}><span className="block text-[11px] text-slate-500">{tr.outputCompression}</span><div className="mt-2 flex items-center gap-1"><input type="number" min={0} max={100} value={compressionPercent} disabled={outputFormat === 'png'} onChange={e => setCompressionQuality(Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100)} className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-2 py-2 text-sm font-semibold text-slate-100 outline-none focus:border-brand-400 disabled:cursor-not-allowed disabled:text-slate-600 disabled:opacity-50" /><span className="text-xs text-slate-500">%</span></div></label>
                <label className="rounded-2xl border border-white/[0.08] bg-[#08090a] p-3"><span className="block text-[11px] text-slate-500">{tr.batchCount}</span><div className="mt-2 flex items-center gap-1"><button type="button" onClick={() => setBatchCount(Math.max(1, batchCount - 1))} className="h-9 w-8 rounded-xl border border-white/[0.08] text-slate-300 hover:bg-white/[0.08]">−</button><input type="number" min={1} max={12} value={batchCount} onChange={e => setBatchCount(Math.min(12, Math.max(1, Number(e.target.value) || 1)))} className="h-9 min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/40 px-2 text-center text-sm font-semibold text-slate-100 outline-none focus:border-brand-400" /><button type="button" onClick={() => setBatchCount(Math.min(12, batchCount + 1))} className="h-9 w-8 rounded-xl border border-white/[0.08] text-slate-300 hover:bg-white/[0.08]">＋</button></div></label>
              </div>
            </div>
          </div>

          <div className="grid gap-2 text-xs text-slate-400">
            <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><summary className="cursor-pointer font-semibold text-slate-200">{tr.helpSpecTitle}</summary><p className="mt-2 leading-5">{tr.helpSpecDesc}</p></details>
            <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><summary className="cursor-pointer font-semibold text-slate-200">{tr.helpReferenceTitle}</summary><p className="mt-2 leading-5">{tr.helpReferenceDesc}</p></details>
            <Link href="/manual" className="rounded-2xl border border-brand-400/30 bg-brand-500/10 p-3 font-semibold text-brand-200">📘 {tr.manual}</Link>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="min-h-[520px] rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4">
            {loading && <div className="flex min-h-[480px] flex-col items-center justify-center text-center"><div className="mb-3 animate-bounce text-5xl">🎨</div><div>{tr.generating}</div><div className="mt-1 text-xs text-slate-500">{tr.waitSeconds}</div></div>}
            {!loading && result && <div><div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-bold">✅ {tr.done}</h2><div className="grid grid-cols-2 gap-2 text-xs sm:flex sm:flex-wrap"><button onClick={() => addReferenceFromGallery(result)} className="rounded-xl bg-white/10 px-3 py-2 hover:bg-white/15">{tr.useAsReference}</button><button onClick={() => toggleFavorite(result)} className="rounded-xl bg-yellow-500/10 px-3 py-2 text-yellow-200">{favoriteUrls.includes(result) ? tr.unfavorite : tr.favorite}</button><button onClick={() => downloadAs(result, outputFormat, 'image-studio-result')} className="rounded-xl bg-slate-100 px-3 py-2 text-slate-900">⬇️ {tr.download}</button><button onClick={() => setResult(null)} className="text-slate-400 hover:text-white">{tr.clear}</button></div></div><img src={result} className="max-h-[760px] w-full rounded-2xl bg-[#08090a] object-contain" alt="" /></div>}
            {!loading && !result && <div className="flex min-h-[480px] flex-col items-center justify-center p-8 text-center text-slate-500"><div className="mb-4 text-7xl">🧠</div><div className="font-medium text-slate-300">{tr.emptyStudioTitle}</div><div className="mt-2 max-w-md text-sm leading-6">{tr.emptyStudioDesc}</div><div className="mt-6 grid w-full max-w-2xl gap-2 text-left text-xs sm:grid-cols-3"><button onClick={() => { setMode('text'); applyPromptTemplate(tr.templateCinematicPrompt); }} className="rounded-2xl border border-white/10 bg-[#08090a] p-4 hover:border-brand-400/50"><div className="text-lg">✨</div><div className="mt-2 font-semibold text-slate-200">{tr.quickTextStart}</div><p className="mt-1 text-slate-500">{tr.quickTextStartDesc}</p></button><button onClick={() => { setMode('edit'); document.getElementById('references')?.scrollIntoView({ behavior: 'smooth' }); }} className="rounded-2xl border border-white/10 bg-[#08090a] p-4 hover:border-brand-400/50"><div className="text-lg">🖼️</div><div className="mt-2 font-semibold text-slate-200">{tr.quickRefStart}</div><p className="mt-1 text-slate-500">{tr.quickRefStartDesc}</p></button><button onClick={() => { setMode('agent'); setPrompt(`${tr.agentPromptSeed}\n\n${tr.agentDraftSuffix}`); }} className="rounded-2xl border border-white/10 bg-[#08090a] p-4 hover:border-brand-400/50"><div className="text-lg">🤖</div><div className="mt-2 font-semibold text-slate-200">{tr.quickAgentStart}</div><p className="mt-1 text-slate-500">{tr.quickAgentStartDesc}</p></button></div></div>}
          </div>

          <div id="gallery" className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="mb-3 flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div><h2 className="font-bold">{tr.galleryTitle}</h2><p className="text-xs text-slate-500">{tr.galleryDescGeneric}</p></div>
              <div className="flex flex-wrap gap-2"><button onClick={exportWorkspace} className="rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/[0.06]">{tr.exportWorkspace}</button><label className="cursor-pointer rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/[0.06]">{tr.importWorkspace}<input type="file" accept="application/json" className="hidden" onChange={e => e.target.files?.[0] && importWorkspace(e.target.files[0])}/></label><button onClick={createCollection} className="rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/[0.06]">{tr.newCollection}</button></div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2"><button onClick={() => setViewMode('history')} className={`rounded-xl border px-3 py-2 text-xs ${viewMode === 'history' ? 'border-brand-500 bg-brand-600 text-white' : 'border-white/10 text-slate-300'}`}>📋 {tr.history} ({historyItems.length})</button><button onClick={() => setViewMode('favorites')} className={`rounded-xl border px-3 py-2 text-xs ${viewMode === 'favorites' ? 'border-brand-500 bg-brand-600 text-white' : 'border-white/10 text-slate-300'}`}>⭐ {tr.favorites} ({favoriteItems.length})</button>{selected.size > 0 && <button onClick={downloadSelected} className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-900">{tr.downloadSelected} ({selected.size})</button>}</div>
            <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]"><input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr.searchImagesPlaceholder} className="rounded-xl border border-white/10 bg-[#08090a] px-3 py-2 text-sm outline-none focus:border-brand-400" /><select value={activeCollectionId} onChange={e => setActiveCollectionId(e.target.value)} className="rounded-xl border border-white/10 bg-[#08090a] px-2 py-2 text-xs"><option value="all">{tr.allCollections}</option>{collections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.urls.length})</option>)}</select><select value={dateFilter} onChange={e => setDateFilter(e.target.value as any)} className="rounded-xl border border-white/10 bg-[#08090a] px-2 py-2 text-xs"><option value="all">{tr.anyDate}</option><option value="today">{tr.today}</option><option value="week">{tr.thisWeek}</option></select><select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)} className="rounded-xl border border-white/10 bg-[#08090a] px-2 py-2 text-xs"><option value="all">{tr.anySize}</option>{SIZE_OPTIONS.map(sz => <option key={sz.id} value={sz.id}>{sz.label}</option>)}</select><button onClick={() => setFavoriteOnly(v => !v)} className={`rounded-xl border px-3 py-2 text-xs ${favoriteOnly ? 'border-yellow-400 bg-yellow-500/10 text-yellow-200' : 'border-white/10 text-slate-300'}`}>{tr.favoriteOnly}</button></div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
              {filteredItems.map(item => <div key={item.url} className="overflow-hidden rounded-2xl border border-white/10 bg-[#08090a]"><button onClick={() => toggleSelect(item.url)} className="relative block w-full"><img src={item.url} className="aspect-square w-full object-cover" alt={tr.galleryItem} />{selected.has(item.url) && <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs text-white">✓</span>}</button><div className="space-y-2 p-2 text-xs"><div className="line-clamp-2 text-slate-400">{item.prompt || item.action || tr.galleryItem}</div><div className="grid grid-cols-2 gap-1"><button onClick={() => { setResult(item.url); setDetailItem(item); }} className="rounded bg-white/10 px-2 py-1 text-center">{tr.view}</button><button onClick={() => addReferenceFromGallery(item.url)} className="rounded bg-brand-500/20 px-2 py-1 text-center text-brand-200">{tr.specifyReference}</button><button onClick={() => toggleFavorite(item.url)} className="rounded bg-yellow-500/10 px-2 py-1 text-center text-yellow-200">{favoriteUrls.includes(item.url) ? tr.unfavorite : tr.favorite}</button><button onClick={() => addToCollection(item.url)} className="rounded bg-white/10 px-2 py-1 text-center">{tr.addToCollection}</button><button onClick={() => downloadAs(item.url, outputFormat, 'gallery-image')} className="rounded bg-white/10 px-2 py-1 text-center">{tr.download}</button><button onClick={() => deleteImage(item.url, viewMode)} className="rounded bg-red-500/10 px-2 py-1 text-center text-red-200">{tr.delete}</button></div></div></div>)}
            </div>
            {filteredItems.length === 0 && <div className="py-10 text-center text-sm text-slate-500">{tr.noImagesMatched}</div>}
          </div>
        </section>

        <aside className="grid gap-4 lg:col-span-2 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-bold">{tr.taskStatus}</h2><p className="text-xs text-slate-500">{tr.taskStatusDesc}</p></div><button onClick={() => setTasks([])} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 hover:bg-white/[0.06]">{tr.clearTasks}</button></div><select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="mb-3 w-full rounded-xl border border-white/10 bg-[#08090a] px-2 py-2 text-xs"><option value="all">{tr.allStatus}</option><option value="running">{tr.statusRunning}</option><option value="done">{tr.statusDone}</option><option value="error">{tr.statusError}</option></select><div className="max-h-72 space-y-2 overflow-auto">{tasks.length === 0 && <div className="text-sm text-slate-500">{tr.noTasks}</div>}{tasks.map(task => <div key={task.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#08090a] p-3 text-sm"><div className="min-w-0"><div className="truncate">{task.prompt || tr.noPrompt}</div><div className="text-xs text-slate-500">{tr[`mode_${task.action}`]} · {task.status === 'running' ? tr.statusRunning : task.status === 'done' ? tr.statusDone : tr.statusError}</div></div>{task.outputUrl && <button onClick={() => setResult(task.outputUrl!)} className="text-xs text-brand-300">{tr.view}</button>}</div>)}</div></div>
          {agentMessages.length > 0 && <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4"><h2 className="mb-3 font-bold">🤖 {tr.agentConversation}</h2><div className="max-h-56 space-y-2 overflow-auto">{agentMessages.map(m => <div key={m.id} className={`rounded-2xl p-3 text-sm ${m.role === 'user' ? 'bg-brand-500/10' : 'bg-[#08090a]'}`}><div className="mb-1 text-xs text-slate-500">{m.role}</div><div>{m.content}</div>{m.imageUrl && <button onClick={() => setResult(m.imageUrl!)} className="mt-2 text-xs text-brand-300">{tr.view}</button>}</div>)}</div></div>}
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4"><h2 className="font-bold">{tr.mediaSuiteTitle}</h2><p className="mt-2 text-xs leading-5 text-slate-500">{tr.mediaSuiteDesc}</p><div className="mt-4 space-y-2">{mediaTools.map(tool => <div key={tool.key} className="rounded-2xl border border-white/10 bg-[#08090a] p-3"><div className="flex items-center justify-between"><div className="font-semibold">{tool.icon} {tool.label}</div><span className={`text-[11px] ${tool.ready ? 'text-emerald-300' : 'text-amber-300'}`}>{tool.ready ? tr.configured : tr.pendingConfig}</span></div><p className="mt-1 text-xs text-slate-500">{tool.desc}</p><div className="mt-3 flex gap-2 text-xs"><Link href={tool.href} className="rounded-lg border border-white/10 px-2 py-1 text-slate-300">{tr.openTool}</Link>{result && <Link href={withResult(tool.href)} className="rounded-lg bg-brand-600 px-2 py-1 text-white">{tr.useCurrentResult}</Link>}</div></div>)}</div></div>
          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4"><h2 className="font-bold">{tr.workspaceStatus}</h2><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-2xl bg-[#08090a] p-3"><div className="text-slate-500">{tr.selectedRefsLabel}</div><div className="mt-1 text-xl font-bold text-slate-100">{selectedReferenceImages.length}</div></div><div className="rounded-2xl bg-[#08090a] p-3"><div className="text-slate-500">{tr.batchCount}</div><div className="mt-1 text-xl font-bold text-slate-100">{batchCount}</div></div><div className="rounded-2xl bg-[#08090a] p-3"><div className="text-slate-500">{tr.galleryTitle}</div><div className="mt-1 text-xl font-bold text-slate-100">{historyItems.length + favoriteItems.length}</div></div><div className="rounded-2xl bg-[#08090a] p-3"><div className="text-slate-500">{tr.compressionQuality}</div><div className="mt-1 text-xl font-bold text-slate-100">{Math.round(compressionQuality * 100)}%</div></div></div></div>
        </aside>
      </div>
      <Modal show={showSizePicker} title={tr.sizePickerTitle} onClose={() => setShowSizePicker(false)}>
        <div className="space-y-5 text-sm">
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{tr.sizeCurrent}: <b>{displaySize}</b></div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 text-xs">
            {(['auto','ratio','resolution'] as SizePickerMode[]).map(m => <button key={m} onClick={() => setSizePickerMode(m)} className={`rounded-lg px-2 py-2 font-medium ${sizePickerMode === m ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{m === 'auto' ? tr.sizeAuto : m === 'ratio' ? tr.sizeByRatio : tr.sizeCustomWH}</button>)}
          </div>
          {sizePickerMode === 'auto' && <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 text-center text-sm text-blue-700"><div className="mb-2 text-3xl">⚡</div><div className="font-semibold">{tr.sizeAuto}</div><p className="mt-2 text-xs leading-5 text-blue-500">{tr.sizeAutoDesc}</p><button onClick={() => { setGenSize('auto'); setShowSizePicker(false); }} className="mt-4 w-full rounded-xl bg-brand-600 py-2 text-white">{tr.applySize}</button></div>}
          {sizePickerMode === 'ratio' && <div className="space-y-4">
            <section><p className="mb-2 text-xs font-semibold text-slate-500">{tr.baseResolution}</p><div className="grid grid-cols-3 gap-2">{SIZE_TIERS.map(tier => <button key={tier} onClick={() => setSizeTier(tier)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${sizeTier === tier ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'}`}>{tier}</button>)}</div></section>
            <section><p className="mb-2 text-xs font-semibold text-slate-500">{tr.imageRatio}</p><div className="grid grid-cols-4 gap-2">{RATIO_OPTIONS.map(item => { const [rw,rh] = item.value.split(':').map(Number); const horizontal = rw > rh; const square = rw === rh; return <button key={item.value} onClick={() => setSizeRatio(item.value)} className={`rounded-xl border px-2 py-2 text-xs ${sizeRatio === item.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'}`}><div className="mx-auto mb-1 flex h-5 w-5 items-center justify-center"><div className="rounded-[3px] border border-current opacity-70" style={{ width: horizontal || square ? '100%' : `${(rw / rh) * 100}%`, height: !horizontal || square ? '100%' : `${(rh / rw) * 100}%` }} /></div>{item.label}</button> })}<button onClick={() => setSizeRatio('custom')} className={`col-span-4 rounded-xl border px-3 py-2 text-xs ${sizeRatio === 'custom' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600'}`}>{tr.customRatio}</button></div></section>
            {sizeRatio === 'custom' && <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-500">{tr.customRatioInput}</span><input value={customRatio} onChange={e => setCustomRatio(e.target.value)} placeholder={tr.customRatioPlaceholder} className={`w-full rounded-xl border px-3 py-2 ${parseRatio(customRatio) ? 'border-slate-200' : 'border-red-300'}`} /></label>}
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{tr.willUse}: <b>{calculateImageSize(sizeTier, sizeRatio === 'custom' ? customRatio : sizeRatio)}</b></div>
            <button onClick={() => { const ratio = sizeRatio === 'custom' ? customRatio : sizeRatio; if (!parseRatio(ratio)) return; setGenSize(calculateImageSize(sizeTier, ratio)); setShowSizePicker(false); }} className="w-full rounded-xl bg-brand-600 py-2 text-white">{tr.applySize}</button>
          </div>}
          {sizePickerMode === 'resolution' && <div className="space-y-4">
            <p className="text-xs leading-5 text-slate-500">{tr.sizeLimitText}</p>
            <div className="grid grid-cols-2 gap-2"><label><span className="mb-1 block text-xs text-slate-500">{tr.customWidth}</span><input value={customWidth} onChange={e => setCustomWidth(e.target.value)} type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2"/></label><label><span className="mb-1 block text-xs text-slate-500">{tr.customHeight}</span><input value={customHeight} onChange={e => setCustomHeight(e.target.value)} type="number" className="w-full rounded-xl border border-slate-200 px-3 py-2"/></label></div>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{tr.willUse}: <b>{normalizeImageSize(`${customWidth}x${customHeight}`)}</b></div>
            <button onClick={() => { const w=Number(customWidth)||1024; const h=Number(customHeight)||1024; setGenSize(normalizeImageSize(`${w}x${h}`)); setShowSizePicker(false); }} className="w-full rounded-xl bg-brand-600 py-2 text-white">{tr.applySize}</button>
          </div>}
        </div>
      </Modal>
      <Modal show={Boolean(detailItem)} title={tr.imageDetails} onClose={() => setDetailItem(null)}>{detailItem && <div className="space-y-3 text-sm"><img src={detailItem.url} className="max-h-64 w-full rounded-xl object-contain bg-slate-100" alt="" /><div className="grid grid-cols-2 gap-2 text-xs"><div><b>{tr.customPrompt}</b><p className="break-words text-slate-500">{detailItem.prompt || '-'}</p></div><div><b>{tr.actions}</b><p className="text-slate-500">{detailItem.action || '-'}</p></div><div><b>{tr.resolution}</b><p className="text-slate-500">{detailItem.size || '-'}</p></div><div><b>{tr.outputFormat}</b><p className="text-slate-500">{detailItem.outputFormat || '-'}</p></div><div><b>{tr.referencePanel}</b><p className="text-slate-500">{detailItem.referenceCount || 0}</p></div><div><b>{tr.createdAt}</b><p className="text-slate-500">{detailItem.createdAt || '-'}</p></div></div><button onClick={() => navigator.clipboard?.writeText(detailItem.prompt || detailItem.url)} className="w-full rounded-xl bg-brand-600 py-2 text-white">{tr.copy}</button></div>}</Modal>
      <Modal show={showLogin} title={'🔐 ' + tr.loginTitle} onClose={() => setShowLogin(false)}>{authError && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{authError}</div>}<input value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder={tr.email} type="email" className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /><input value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder={tr.password} type="password" onKeyDown={e => e.key === 'Enter' && doLogin()} className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /><button onClick={doLogin} className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white">{tr.login}</button><button onClick={() => { setShowLogin(false); setShowForgot(true); setForgotEmail(authEmail); setForgotSent(false); setAuthError(''); }} className="mt-2 w-full text-center text-xs text-slate-400 hover:text-brand-600">{tr.forgotPassword}</button><p className="mt-3 text-center text-sm text-slate-400">{tr.noAccount} <button onClick={() => { setShowLogin(false); setShowRegister(true); }} className="text-brand-600">{tr.register}</button></p></Modal>
      <Modal show={showRegister} title={'✨ ' + tr.registerTitle} onClose={() => setShowRegister(false)}>{authError && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{authError}</div>}<input value={authName} onChange={e => setAuthName(e.target.value)} placeholder={tr.name} className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /><input value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder={tr.email} type="email" className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /><input value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder={tr.passwordHint} type="password" className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /><button onClick={doRegister} className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white">{tr.register}</button></Modal>
      <Modal show={showForgot} title={'🔑 ' + tr.forgotTitle} onClose={() => setShowForgot(false)}>{forgotSent ? <div className="text-center"><p className="mb-4 text-5xl">📧</p><p className="mb-2 font-medium text-slate-700">{tr.emailSent}</p><p className="mb-4 text-sm text-slate-500">{tr.resetEmailSent.replace('{email}', forgotEmail)}</p><button onClick={() => { setShowForgot(false); setShowLogin(true); setForgotSent(false); }} className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white">{tr.backToLogin}</button></div> : <>{authError && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">{authError}</div>}<p className="mb-4 text-sm text-slate-500">{tr.forgotDesc}</p><input value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder={tr.registeredEmail} type="email" className="mb-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" /><button onClick={doForgot} className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white">{tr.sendResetLink}</button></>}</Modal>
      <Modal show={showPay} title={'🚀 ' + tr.upgradeTitle} onClose={() => setShowPay(false)}><p className="mb-4 text-center text-sm text-slate-500">{usageLeft <= 0 ? tr.limitReached : tr.freeLeftDesc.replace('{left}', String(usageLeft))}</p><a href={process.env.NEXT_PUBLIC_STRIPE_LINK || '#'} target="_blank" rel="noopener" className="block w-full rounded-xl bg-brand-600 py-2.5 text-center font-semibold text-white">💳 {tr.upgradeBtn}</a><button onClick={() => setShowPay(false)} className="mt-2 w-full text-sm text-slate-400">{tr.later}</button></Modal>
    </main>
  </>;
}
