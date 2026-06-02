import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { MediaUpload } from './MediaUpload';

type Kind = 'video' | 'audio' | 'voice-clone';

type Field = {
  name: string;
  description: string;
  control: 'prompt' | 'style' | 'duration' | 'aspectRatio' | 'image' | 'voiceSample';
};

type Props = {
  kind: Kind;
  title: string;
  subtitle: string;
  emoji: string;
  promptPlaceholder: string;
  templatePrompt: string;
  fields: Field[];
};

function downloadName(kind: Kind) {
  return kind === 'video' ? 'ecompic-video.mp4' : 'ecompic-audio.mp3';
}

function toolLinks(current: Kind) {
  const links: { href: string; kind: Kind; label: string }[] = [
    { href: '/video', kind: 'video', label: '生视频' },
    { href: '/audio', kind: 'audio', label: '生语音' },
    { href: '/voice-clone', kind: 'voice-clone', label: '音色克隆' },
  ];
  return links.map(link => (
    <Link key={link.kind} href={link.href} className={`inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold transition ${current === link.kind ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-brand-400'}`}>
      {link.label}
    </Link>
  ));
}

export function MediaGeneratorPage({ kind, title, subtitle, emoji, promptPlaceholder, templatePrompt, fields }: Props) {
  const { status } = useSession();
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

  const generate = async () => {
    if (!loggedIn) { signIn(); return; }
    if (!prompt.trim()) { setError('请先填写生成描述'); return; }
    setLoading(true); setError(''); setResult('');
    try {
      const res = await fetch('/api/media', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, prompt, text: prompt, inputUrl: inputUrl || undefined, voiceSample: voiceSample || undefined, style, duration, aspectRatio }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || '生成失败');
      if (!data.url) throw new Error('没有返回可用结果');
      setResult(data.url);
    } catch (e: any) {
      setError(e?.message || '生成失败，请稍后重试');
    }
    setLoading(false);
  };

  return (
    <>
      <Head>
        <title>{title} - EcomPic AI</title>
        <meta name="description" content={subtitle} />
      </Head>
      <main className="min-h-screen px-4 py-6 md:py-10">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <Link href="/" className="inline-flex h-10 items-center text-sm font-semibold text-slate-500 hover:text-brand-600">← 返回首页</Link>
            <nav className="flex flex-wrap gap-2" aria-label="媒体工具导航">{toolLinks(kind)}</nav>
          </header>

          <section className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 md:grid-cols-[1.05fr_.95fr]">
              <div className="p-7 md:p-9">
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl">{emoji}</div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">独立工作台</p>
                <h1 className="text-3xl font-black leading-tight text-slate-900 md:text-5xl">{title}</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500 md:text-base">{subtitle}</p>
              </div>
              <div className="border-t border-slate-200 bg-slate-50 p-7 md:border-l md:border-t-0 md:p-9">
                <h2 className="text-sm font-bold text-slate-900">本页只处理一个功能</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">所有参数都按名称、说明、输入区分层排列，避免和其他功能混用。</p>
                <div className="mt-5 grid gap-2 text-xs text-slate-500">
                  {fields.slice(0, 4).map(f => <div key={f.name} className="rounded-xl bg-white px-3 py-2 shadow-sm"><span className="font-semibold text-slate-700">{f.name}</span> · {f.description}</div>)}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div>
                <label className="block text-sm font-bold text-slate-800">生成描述</label>
                <p className="mt-1 text-xs leading-5 text-slate-500">写清楚商品、场景、情绪、节奏和最终用途。描述越具体，结果越稳定。</p>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={7} placeholder={promptPlaceholder}
                  className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-400" />
              </div>

              {fields.some(f => f.control === 'image') && (
                <MediaUpload label="参考图片" description="上传商品图或场景图，系统会把它作为生成视频的视觉参考。" accept={{ 'image/*': ['.png','.jpg','.jpeg','.webp'] }} value={inputUrl} onChange={(v) => setInputUrl(v)} preview="image" />
              )}
              {fields.some(f => f.control === 'voiceSample') && (
                <MediaUpload label="参考音频" description="上传要克隆的音色样本。建议使用清晰、无背景音乐的人声。" accept={{ 'audio/*': ['.mp3','.wav','.m4a','.ogg'] }} value={voiceSample} onChange={(v) => setVoiceSample(v)} preview="audio" />
              )}

              <div className="grid gap-4 md:grid-cols-3">
                {fields.some(f => f.control === 'style') && <div className="rounded-2xl bg-slate-50 p-4"><label className="text-sm font-bold text-slate-800">风格</label><p className="mt-1 min-h-[40px] text-xs leading-5 text-slate-500">控制成片/声音的气质，例如高级、温暖、科技感。</p><input value={style} onChange={e => setStyle(e.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" placeholder="高级、自然、温暖" /></div>}
                {fields.some(f => f.control === 'duration') && <div className="rounded-2xl bg-slate-50 p-4"><label className="text-sm font-bold text-slate-800">时长</label><p className="mt-1 min-h-[40px] text-xs leading-5 text-slate-500">生成内容的秒数，短内容更适合广告测试。</p><input type="number" min={3} max={60} value={duration} onChange={e => setDuration(Number(e.target.value || 5))} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none" /></div>}
                {fields.some(f => f.control === 'aspectRatio') && <div className="rounded-2xl bg-slate-50 p-4"><label className="text-sm font-bold text-slate-800">画面比例</label><p className="mt-1 min-h-[40px] text-xs leading-5 text-slate-500">选择投放平台常用比例。</p><select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"><option>16:9</option><option>9:16</option><option>1:1</option></select></div>}
              </div>

              {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={generate} disabled={loading} className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-brand-600 px-6 py-3 font-bold text-white hover:bg-brand-700 disabled:opacity-50">{loading ? '生成中...' : '开始生成'}</button>
                <button type="button" onClick={() => setPrompt(templatePrompt)} className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-700 hover:bg-slate-200">套用高转化模板</button>
              </div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-black text-slate-900">参数说明</h2>
                <div className="mt-4 space-y-3">
                  {fields.map(f => <div key={f.name} className="rounded-2xl bg-slate-50 p-4"><div className="text-sm font-bold text-slate-800">{f.name}</div><div className="mt-1 text-xs leading-5 text-slate-500">{f.description}</div></div>)}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-black text-slate-900">生成结果</h2>
                {!result && <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-center text-sm leading-6 text-slate-500">结果会显示在这里，可预览并下载。</div>}
                {result && (kind === 'video' ? <video src={result} controls className="mt-4 w-full rounded-2xl" /> : <audio src={result} controls className="mt-4 w-full" />)}
                {result && <a href={result} download={downloadName(kind)} className="mt-4 inline-flex min-h-[40px] items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">⬇️ 下载结果</a>}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
