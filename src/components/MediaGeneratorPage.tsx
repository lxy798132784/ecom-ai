import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { MediaUpload } from './MediaUpload';
import { t, Lang } from '../lib/i18n';

type Kind = 'video' | 'audio' | 'voice-clone';

type Bilingual = { zh: string; en: string };
type MediaHistoryItem = { id?: string; kind: Kind; url: string; prompt?: string; createdAt?: string; model?: string; provider?: string };
type Field = {
  name: string | Bilingual;
  description: string | Bilingual;
  control: 'prompt' | 'style' | 'duration' | 'aspectRatio' | 'image' | 'voiceSample';
};

type Props = {
  kind: Kind;
  title: string | Bilingual;
  subtitle: string | Bilingual;
  emoji: string;
  promptPlaceholder: string | Bilingual;
  templatePrompt: string;
  fields: Field[];
};

function pickText(value: string | Bilingual, lang: Lang) {
  return typeof value === 'string' ? value : value[lang];
}

function getLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  return (localStorage.getItem('lang') as Lang) || 'zh';
}
function saveLang(l: Lang) { localStorage.setItem('lang', l); }

function downloadName(kind: Kind) {
  return kind === 'video' ? 'ecompic-video.mp4' : 'ecompic-audio.mp3';
}

function toolLinks(current: Kind, tr: any) {
  const links: { href: string; kind: Kind; label: string }[] = [
    { href: '/video', kind: 'video', label: tr.videoTool },
    { href: '/audio', kind: 'audio', label: tr.audioTool },
    { href: '/voice-clone', kind: 'voice-clone', label: tr.voiceCloneTool },
  ];
  return links.map(link => (
    <Link key={link.kind} href={link.href} className={`inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold transition ${current === link.kind ? 'bg-brand-600 text-white shadow-sm' : 'bg-white/[0.03] text-slate-300 border border-white/10 hover:border-brand-400'}`}>
      {link.label}
    </Link>
  ));
}

export function MediaGeneratorPage({ kind, title, subtitle, emoji, promptPlaceholder, templatePrompt, fields }: Props) {
  const { status } = useSession();
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>('zh');
  useEffect(() => setLangState(getLang()), []);
  const tr = t[lang];
  const pageTitle = pickText(title, lang);
  const pageSubtitle = pickText(subtitle, lang);
  const pagePlaceholder = pickText(promptPlaceholder, lang);
  const fieldText = (f: Field) => ({ name: pickText(f.name, lang), description: pickText(f.description, lang) });
  const toggleLang = () => { const next = lang === 'zh' ? 'en' : 'zh'; setLangState(next); saveLang(next); };
  const loggedIn = status === 'authenticated';
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [inputUrl, setInputUrl] = useState('');
  const [voiceSample, setVoiceSample] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mediaHistory, setMediaHistory] = useState<MediaHistoryItem[]>([]);
  useEffect(() => { const input = typeof router.query.input === 'string' ? router.query.input : ''; if (input && !inputUrl) setInputUrl(input); }, [router.query.input, inputUrl]);
  useEffect(() => { if (loggedIn) fetch(`/api/media-history?kind=${kind}`).then(r => r.json()).then(d => setMediaHistory(d.items || [])).catch(() => {}); }, [loggedIn, kind]);

  const generate = async () => {
    if (!loggedIn) { signIn(); return; }
    if (!prompt.trim()) { setError(tr.mediaPromptRequired); return; }
    setLoading(true); setError(''); setResult('');
    try {
      const res = await fetch('/api/media', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, prompt, text: prompt, inputUrl: inputUrl || undefined, voiceSample: voiceSample || undefined, style, duration, aspectRatio }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || tr.mediaGenerateFailed);
      if (!data.url) throw new Error(tr.mediaNoResult);
      setResult(data.url); if (data.mediaItems) setMediaHistory(data.mediaItems.filter((x: MediaHistoryItem) => x.kind === kind));
    } catch (e: any) {
      setError(e?.message || tr.mediaRetryLater);
    }
    setLoading(false);
  };

  return (
    <>
      <Head>
        <title>{pageTitle} - Image Studio AI</title>
        <meta name="description" content={pageSubtitle} />
      </Head>
      <main className="studio-shell media-shell min-h-screen bg-[#08090a] px-4 py-6 text-slate-100 md:py-10">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl md:flex-row md:items-center md:justify-between">
            <Link href="/" className="inline-flex h-10 items-center text-sm font-semibold text-slate-400 hover:text-brand-300">← {tr.backHome}</Link>
            <div className="flex flex-wrap items-center gap-2"><nav className="flex flex-wrap gap-2" aria-label={tr.mediaNav}>{toolLinks(kind, tr)}</nav><button onClick={toggleLang} className="inline-flex h-10 items-center rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-semibold text-slate-400 hover:border-brand-400">{lang === 'zh' ? 'EN' : '中'}</button></div>
          </header>

          <section className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035] shadow-sm">
            <div className="grid gap-0 md:grid-cols-[1.05fr_.95fr]">
              <div className="p-7 md:p-9">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl">{emoji}</div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{tr.standaloneWorkspace}</p>
                <h1 className="text-3xl font-black leading-tight text-slate-50 md:text-5xl">{pageTitle}</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 md:text-base">{pageSubtitle}</p>
              </div>
              <div className="border-t border-white/10 bg-slate-950 p-7 md:border-l md:border-t-0 md:p-9">
                <h2 className="text-sm font-bold text-slate-50">{tr.singleFunctionPage}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{tr.singleFunctionDesc}</p>
                <div className="mt-5 grid gap-2 text-xs text-slate-400">
                  {fields.slice(0, 4).map((f, idx) => { const ft = fieldText(f); return <div key={idx} className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 shadow-sm"><span className="font-semibold text-slate-200">{ft.name}</span> · {ft.description}</div>; })}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-sm md:p-6">
              <div>
                <label className="block text-sm font-bold text-slate-200">{tr.mediaPromptLabel}</label>
                <p className="mt-1 text-xs leading-5 text-slate-400">{tr.mediaPromptHelp}</p>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={7} placeholder={pagePlaceholder}
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-brand-400" />
              </div>

              {fields.some(f => f.control === 'image') && (
                <MediaUpload label={tr.referenceImage} description={tr.referenceImageDesc} text={tr.mediaUploadText} accept={{ 'image/*': ['.png','.jpg','.jpeg','.webp'] }} value={inputUrl} onChange={(v) => setInputUrl(v)} preview="image" />
              )}
              {fields.some(f => f.control === 'voiceSample') && (
                <MediaUpload label={tr.referenceAudio} description={tr.referenceAudioDesc} text={tr.mediaUploadText} accept={{ 'audio/*': ['.mp3','.wav','.m4a','.ogg'] }} value={voiceSample} onChange={(v) => setVoiceSample(v)} preview="audio" />
              )}

              <div className="grid gap-4 md:grid-cols-3">
                {fields.some(f => f.control === 'style') && <div className="rounded-2xl bg-slate-950 p-4"><label className="text-sm font-bold text-slate-200">{tr.style}</label><p className="mt-1 min-h-[40px] text-xs leading-5 text-slate-400">{tr.styleDesc}</p><input value={style} onChange={e => setStyle(e.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none" placeholder={tr.stylePlaceholder} /></div>}
                {fields.some(f => f.control === 'duration') && <div className="rounded-2xl bg-slate-950 p-4"><label className="text-sm font-bold text-slate-200">{tr.duration}</label><p className="mt-1 min-h-[40px] text-xs leading-5 text-slate-400">{tr.durationDesc}</p><input type="number" min={3} max={60} value={duration} onChange={e => setDuration(Number(e.target.value || 5))} className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none" /></div>}
                {fields.some(f => f.control === 'aspectRatio') && <div className="rounded-2xl bg-slate-950 p-4"><label className="text-sm font-bold text-slate-200">{tr.aspectRatio}</label><p className="mt-1 min-h-[40px] text-xs leading-5 text-slate-400">{tr.aspectRatioDesc}</p><select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"><option>16:9</option><option>9:16</option><option>1:1</option></select></div>}
              </div>

              {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={generate} disabled={loading} className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-brand-600 px-6 py-3 font-bold text-white hover:bg-brand-700 disabled:opacity-50">{loading ? tr.generatingShort : tr.startGenerate}</button>
                <button type="button" onClick={() => setPrompt(templatePrompt)} className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white/10 px-5 py-3 font-bold text-slate-300 hover:bg-white/15">{tr.applyTemplate}</button>
              </div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-sm">
                <h2 className="text-base font-black text-slate-50">{tr.parameterGuide}</h2>
                <div className="mt-4 space-y-3">
                  {fields.map((f, idx) => { const ft = fieldText(f); return <div key={idx} className="rounded-2xl bg-slate-950 p-4"><div className="text-sm font-bold text-slate-200">{ft.name}</div><div className="mt-1 text-xs leading-5 text-slate-400">{ft.description}</div></div>; })}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-sm">
                <h2 className="text-base font-black text-slate-50">{tr.generatedResult}</h2>
                {!result && <div className="mt-4 rounded-2xl bg-slate-950 p-6 text-center text-sm leading-6 text-slate-400">{tr.resultPlaceholder}</div>}
                {result && (kind === 'video' ? <video src={result} controls className="mt-4 w-full rounded-2xl" /> : <audio src={result} controls className="mt-4 w-full" />)}
                {result && <a href={result} download={downloadName(kind)} className="mt-4 inline-flex min-h-[40px] items-center rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">⬇️ {tr.downloadResult}</a>}
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-sm">
                <h2 className="text-base font-black text-slate-50">{tr.mediaHistory}</h2>
                <div className="mt-4 max-h-64 space-y-2 overflow-auto">{mediaHistory.length === 0 && <div className="rounded-2xl bg-slate-950 p-4 text-sm text-slate-500">{tr.noMediaHistory}</div>}{mediaHistory.map(item => <button key={item.id || item.url} onClick={() => setResult(item.url)} className="block w-full rounded-2xl bg-slate-950 p-3 text-left text-xs text-slate-400"><div className="truncate text-slate-200">{item.prompt || item.url}</div><div className="mt-1">{item.createdAt || ''}</div></button>)}</div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
