import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Head from 'next/head';

const SCENES = [
  { id: 'kitchen', emoji: '🍳', label: '厨房' },
  { id: 'living-room', emoji: '🛋️', label: '客厅' },
  { id: 'bedroom', emoji: '🛏️', label: '卧室' },
  { id: 'office', emoji: '💼', label: '办公桌' },
  { id: 'outdoor', emoji: '🌳', label: '户外' },
  { id: 'bathroom', emoji: '🛁', label: '浴室' },
  { id: 'marble', emoji: '🪨', label: '大理石台面' },
  { id: 'wooden-table', emoji: '🪵', label: '木桌' },
];

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setImage(reader.result as string); setResult(null); setError(''); };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }, maxFiles: 1,
  });

  const process = async (action: string, scene?: string) => {
    if (!image) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, action, scene }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.url);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <>
      <Head><title>EcomPic AI - 跨境电商 AI 美工</title></Head>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Hero */}
        <header className="text-center pt-16 pb-8 px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">
            🛍️ EcomPic<span className="text-brand-600"> AI</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            上传产品图 → AI 自动生成白底图 / 场景图 / A+详情图<br/>
            跨境电商卖家的 AI 美工，5 分钟出图
          </p>
        </header>

        <div className="max-w-5xl mx-auto px-4 pb-20">
          {/* Upload */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
              isDragActive ? 'border-brand-500 bg-blue-50' : 'border-slate-300 hover:border-brand-400'
            } ${image ? 'p-4' : ''}`}
          >
            <input {...getInputProps()} />
            {image ? (
              <img src={image} className="max-h-64 mx-auto rounded-lg" alt="Uploaded" />
            ) : (
              <div>
                <p className="text-5xl mb-4">📸</p>
                <p className="text-lg font-medium text-slate-700">拖拽产品图到这里</p>
                <p className="text-sm text-slate-400 mt-1">或点击选择文件 · PNG / JPG / WebP</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {image && (
            <div className="mt-8 space-y-6">
              {/* White BG */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold mb-2">🪄 一键白底图</h3>
                <p className="text-sm text-slate-500 mb-4">符合亚马逊主图要求，纯白背景</p>
                <button
                  onClick={() => process('whitebg')}
                  disabled={loading}
                  className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition"
                >
                  {loading ? '生成中...' : '生成白底图'}
                </button>
              </div>

              {/* Scenes */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold mb-2">🏠 场景图生成</h3>
                <p className="text-sm text-slate-500 mb-4">把产品放进真实场景，买家更想买</p>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                  {SCENES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => process('scene', s.id)}
                      disabled={loading}
                      className="flex flex-col items-center p-3 rounded-xl border border-slate-200 hover:border-brand-400 hover:bg-blue-50 disabled:opacity-50 transition"
                    >
                      <span className="text-2xl">{s.emoji}</span>
                      <span className="text-xs mt-1 text-slate-600">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              ❌ {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center">
              <h3 className="text-lg font-semibold mb-4">✅ 生成完成</h3>
              <img src={result} className="max-w-full max-h-96 mx-auto rounded-xl shadow-lg" alt="Result" />
              <div className="mt-4 flex justify-center gap-3">
                <a
                  href={result} download="ecompic-result.png" target="_blank"
                  className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition"
                >
                  ⬇️ 下载图片
                </a>
              </div>
            </div>
          )}

          {/* Footer CTA */}
          <div className="mt-16 text-center">
            <p className="text-slate-400 text-sm">
              🚀 跨境电商 AI 美工 · 不用再等设计师
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
