import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Head from 'next/head';

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1024, maxH = 1024;
      let w = img.width, h = img.height;
      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio); h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

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

const PRESET_PROMPTS = [
  { id: 'whitebg', label: '纯白背景', prompt: 'Product on pure white background, professional product photography lighting, no shadows, centered' },
  { id: 'lifestyle', label: '生活场景', prompt: 'Product in a beautiful lifestyle setting, natural light, realistic' },
  { id: 'minimal', label: '极简风格', prompt: 'Minimalist product photography, clean composition, soft shadows, aesthetic' },
  { id: 'studio', label: '影棚质感', prompt: 'Studio lighting product shot, dramatic lighting, high-end commercial photography' },
  { id: 'flatlay', label: '平铺展示', prompt: 'Flat lay product photography, top-down view, neatly arranged, bright' },
  { id: 'closeup', label: '细节特写', prompt: 'Close-up macro product shot, detailed texture visible, depth of field, premium' },
];

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedScene, setSelectedScene] = useState('');

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setError('压缩图片中...');
    resizeImage(file).then((dataUrl) => {
      setImage(dataUrl); setResult(null); setResults([]); setError('');
    }).catch(() => setError('图片处理失败'));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }, maxFiles: 1,
  });

  const process = async (action: string, scene?: string, promptOverride?: string) => {
    if (!image) return;
    setLoading(true); setError(''); setResult('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, action, scene, prompt: promptOverride || '' }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.url) throw new Error('API 返回了空的图片地址');
      setResult(data.url);
      setResults(prev => [...prev, data.url]);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleWhiteBg = () => process('whitebg', '', customPrompt);
  const handleScene = (sceneId: string) => {
    setSelectedScene(sceneId);
    process('scene', sceneId, customPrompt);
  };

  return (
    <>
      <Head><title>EcomPic AI - 跨境电商 AI 美工</title></Head>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <header className="text-center pt-12 pb-6 px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-2">
            🛍️ EcomPic<span className="text-brand-600"> AI</span>
          </h1>
          <p className="text-lg text-slate-500">
            上传产品图 → AI 自动出图 · 跨境电商卖家的 AI 美工
          </p>
        </header>

        <div className="max-w-6xl mx-auto px-4 pb-20">
          <div className="grid md:grid-cols-5 gap-6">
            {/* Left: Upload & Controls */}
            <div className="md:col-span-2 space-y-4">
              {/* Upload */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all bg-white ${
                  isDragActive ? 'border-brand-500 bg-blue-50' : 'border-slate-300 hover:border-brand-400'
                }`}
              >
                <input {...getInputProps()} />
                {image ? (
                  <img src={image} className="max-h-48 mx-auto rounded-lg" alt="Uploaded" />
                ) : (
                  <div>
                    <p className="text-4xl mb-3">📸</p>
                    <p className="font-medium text-slate-700">拖拽产品图到这里</p>
                    <p className="text-xs text-slate-400 mt-1">PNG / JPG / WebP · 自动压缩</p>
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              {image && (
                <>
                  <button
                    onClick={handleWhiteBg}
                    disabled={loading}
                    className="w-full bg-brand-600 text-white px-6 py-3 rounded-xl font-semibold text-lg hover:bg-brand-700 disabled:opacity-50 transition"
                  >
                    {loading ? '🎨 生成中...' : '🪄 一键白底图'}
                  </button>

                  {/* Scene Grid */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-500 mb-3">🏠 场景图生成</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {SCENES.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleScene(s.id)}
                          disabled={loading}
                          className={`flex flex-col items-center p-2 rounded-xl border transition text-sm ${
                            selectedScene === s.id
                              ? 'border-brand-500 bg-blue-50'
                              : 'border-slate-200 hover:border-brand-400 hover:bg-blue-50'
                          } disabled:opacity-50`}
                        >
                          <span className="text-xl">{s.emoji}</span>
                          <span className="text-xs mt-1 text-slate-600">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Advanced: Custom Prompt */}
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition w-full"
                    >
                      <span>{showAdvanced ? '🔽' : '▶️'}</span>
                      <span className="font-medium">高级选项 · 自定义提示词</span>
                    </button>
                    {showAdvanced && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <label className="text-xs text-slate-500 font-medium mb-1 block">提示词预设</label>
                          <div className="flex flex-wrap gap-1.5">
                            {PRESET_PROMPTS.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => setCustomPrompt(p.prompt)}
                                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                                  customPrompt === p.prompt
                                    ? 'bg-brand-600 text-white border-brand-600'
                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-brand-400'
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 font-medium mb-1 block">
                            自定义提示词 <span className="text-slate-300">（英文效果更好）</span>
                          </label>
                          <textarea
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder="输入你想要的画面描述，例如：白色大理石背景，柔光，高端商务风格..."
                            rows={3}
                            className="w-full text-sm border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand-400 resize-none"
                          />
                        </div>
                        <p className="text-xs text-slate-400">
                          💡 提示词会追加到预设指令后面，留空则使用默认效果
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Right: Results */}
            <div className="md:col-span-3">
              {/* Loading */}
              {loading && (
                <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 text-center">
                  <div className="animate-bounce text-5xl mb-4">🎨</div>
                  <p className="text-slate-600 font-medium text-lg">AI 正在生成中...</p>
                  <p className="text-sm text-slate-400 mt-1">通常需要 5-15 秒</p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">
                  ❌ {error}
                </div>
              )}

              {/* Current Result */}
              {result && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-700">✅ 生成完成</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setResult(null); }}
                        className="text-xs text-slate-400 hover:text-slate-600 transition"
                      >
                        清除
                      </button>
                      <a
                        href={result} download="ecompic-result.png" target="_blank"
                        className="text-xs bg-slate-900 text-white px-4 py-1.5 rounded-full hover:bg-slate-800 transition"
                      >
                        ⬇️ 下载
                      </a>
                    </div>
                  </div>
                  <img src={result} className="w-full rounded-xl shadow-md" alt="Result" />
                </div>
              )}

              {/* History */}
              {results.length > 1 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-slate-500 mb-3">📋 生成历史</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {results.slice(0, -1).reverse().map((url, i) => (
                      <div key={i} className="bg-white rounded-xl p-2 shadow-sm border border-slate-200 cursor-pointer hover:border-brand-400 transition" onClick={() => setResult(url)}>
                        <img src={url} className="w-full rounded-lg" alt={`History ${i}`} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!image && !result && !loading && (
                <div className="bg-white rounded-2xl p-16 shadow-sm border border-slate-200 text-center">
                  <p className="text-6xl mb-4">🖼️</p>
                  <p className="text-slate-500">上传产品图片开始生成</p>
                  <p className="text-xs text-slate-300 mt-2">支持白底图、场景图、A+ 详情图</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 text-center">
            <p className="text-slate-400 text-sm">🚀 EcomPic AI · 跨境电商 AI 美工 · 不用再等设计师</p>
          </div>
        </div>
      </main>
    </>
  );
}
