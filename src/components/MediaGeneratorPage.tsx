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
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="text-sm text-slate-500 hover:text-brand-600">← 返回首页</Link>
            <div className="flex gap-2 text-sm">
              <Link href="/video" className="px-3 py-1 rounded-full bg-white border border-slate-200">生视频</Link>
              <Link href="/audio" className="px-3 py-1 rounded-full bg-white border border-slate-200">生语音</Link>
              <Link href="/voice-clone" className="px-3 py-1 rounded-full bg-white border border-slate-200">音色克隆</Link>
            </div>
          </div>

          <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 mb-6">
            <div className="text-5xl mb-4">{emoji}</div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">{title}</h1>
            <p className="text-slate-500 mt-3 max-w-2xl">{subtitle}</p>
          </section>

          <div className="grid lg:grid-cols-5 gap-6">
            <section className="lg:col-span-3 bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-5">
              <div>
                <div className="text-sm font-bold text-slate-800">生成描述</div>
                <div className="text-xs text-slate-500 mt-1">写清楚商品、场景、情绪、节奏和最终用途。描述越具体，结果越稳定。</div>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={6} placeholder={promptPlaceholder}
                  className="mt-2 w-full text-sm border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-brand-400" />
              </div>

              {fields.some(f => f.control === 'image') && (
                <MediaUpload label="参考图片" description="上传商品图或场景图，系统会把它作为生成视频的视觉参考。" accept={{ 'image/*': ['.png','.jpg','.jpeg','.webp'] }} value={inputUrl} onChange={(v) => setInputUrl(v)} preview="image" />
              )}
              {fields.some(f => f.control === 'voiceSample') && (
                <MediaUpload label="参考音频" description="上传要克隆的音色样本。建议使用清晰、无背景音乐的人声。" accept={{ 'audio/*': ['.mp3','.wav','.m4a','.ogg'] }} value={voiceSample} onChange={(v) => setVoiceSample(v)} preview="audio" />
              )}

              <div className="grid md:grid-cols-3 gap-3">
                {fields.some(f => f.control === 'style') && <div><div className="text-sm font-bold text-slate-800">风格</div><div className="text-xs text-slate-500 mb-1">控制成片/声音的气质，例如高级、温暖、科技感。</div><input value={style} onChange={e => setStyle(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none" placeholder="高级、自然、温暖" /></div>}
                {fields.some(f => f.control === 'duration') && <div><div className="text-sm font-bold text-slate-800">时长</div><div className="text-xs text-slate-500 mb-1">生成内容的秒数，短内容更适合广告测试。</div><input type="number" min={3} max={60} value={duration} onChange={e => setDuration(Number(e.target.value || 5))} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none" /></div>}
                {fields.some(f => f.control === 'aspectRatio') && <div><div className="text-sm font-bold text-slate-800">画面比例</div><div className="text-xs text-slate-500 mb-1">选择投放平台常用比例。</div><select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none"><option>16:9</option><option>9:16</option><option>1:1</option></select></div>}
              </div>

              {error && <div className="rounded-2xl bg-red-50 text-red-700 text-sm px-4 py-3 border border-red-100">{error}</div>}
              <div className="flex flex-wrap gap-3">
                <button onClick={generate} disabled={loading} className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50">{loading ? '生成中...' : '开始生成'}</button>
                <button type="button" onClick={() => setPrompt(templatePrompt)} className="bg-slate-100 text-slate-700 px-5 py-3 rounded-xl font-bold hover:bg-slate-200">套用高转化模板</button>
              </div>
            </section>

            <aside className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                <h2 className="font-black text-slate-900 mb-3">参数说明</h2>
                <div className="space-y-3">
                  {fields.map(f => <div key={f.name} className="rounded-2xl bg-slate-50 p-3"><div className="text-sm font-bold text-slate-800">{f.name}</div><div className="text-xs text-slate-500 mt-1">{f.description}</div></div>)}
                </div>
              </div>
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                <h2 className="font-black text-slate-900 mb-3">生成结果</h2>
                {!result && <p className="text-sm text-slate-500">结果会显示在这里，可预览并下载。</p>}
                {result && (kind === 'video' ? <video src={result} controls className="w-full rounded-2xl" /> : <audio src={result} controls className="w-full" />)}
                {result && <a href={result} download={downloadName(kind)} className="inline-flex mt-4 bg-slate-900 text-white px-4 py-2 rounded-full text-sm">⬇️ 下载结果</a>}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
