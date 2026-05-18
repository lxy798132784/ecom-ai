import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useSession, signIn, signOut } from 'next-auth/react';
import { SessionProvider } from 'next-auth/react';
import Head from 'next/head';
import type { AppProps } from 'next/app';

type Mode = 'upload' | 'text';
const FREE_LIMIT = 5;

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
  { id: 'kitchen', e: '🍳', l: '厨房' }, { id: 'living-room', e: '🛋️', l: '客厅' },
  { id: 'bedroom', e: '🛏️', l: '卧室' }, { id: 'office', e: '💼', l: '办公桌' },
  { id: 'outdoor', e: '🌳', l: '户外' }, { id: 'bathroom', e: '🛁', l: '浴室' },
  { id: 'marble', e: '🪨', l: '大理石' }, { id: 'wooden-table', e: '🪵', l: '木桌' },
];
const PRESETS = [
  { id: 'whitebg', l: '纯白背景', p: 'white background, clean, product photography' },
  { id: 'lifestyle', l: '生活场景', p: 'lifestyle setting, natural light, warm' },
  { id: 'minimal', l: '极简风格', p: 'minimalist, clean, soft shadows' },
  { id: 'studio', l: '影棚质感', p: 'studio lighting, high-end, dramatic' },
  { id: 'flatlay', l: '平铺展示', p: 'flat lay, top-down, bright' },
  { id: 'closeup', l: '细节特写', p: 'close-up macro, detailed texture' },
  { id: 'chinese', l: '国潮风格', p: 'Chinese traditional, elegant, red gold' },
  { id: 'warm', l: '温馨暖调', p: 'warm tones, cozy, soft sunlight' },
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

  // Auth modals
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [usageCount, setUsageCount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(FREE_LIMIT);

  const userPlan = (session?.user as any)?.plan || 'free';
  const usageLeft = userPlan === 'pro' ? Infinity : Math.max(0, usageLimit - usageCount);
  const loggedIn = status === 'authenticated';

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]; if (!f) return;
    setError('压缩中...');
    resizeImg(f).then(d => { setImage(d); setResult(null); setResults([]); setError(''); }).catch(() => setError('失败'));
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': ['.png','.jpg','.jpeg','.webp'] }, maxFiles: 1,
  });

  const generate = async (action: string, scene?: string, promptOverride?: string) => {
    if (action !== 'text2img' && !image) return;
    if (action === 'text2img' && !textPrompt.trim()) { setError('请输入描述'); return; }
    if (!loggedIn) { setShowLogin(true); return; }
    if (usageLeft <= 0) { setShowPay(true); return; }
    setLoading(true); setError(''); setResult('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, action, scene, prompt: promptOverride || '', customPrompt: promptOverride || '' }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      if (!data.url) throw new Error('API 返回空地址');
      setResult(data.url); setResults(p => [...p, data.url]);
      if (data.usage !== undefined) { setUsageCount(data.usage); setUsageLimit(data.limit); }
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const doLogin = async () => {
    setAuthError('');
    const res = await signIn('credentials', {
      email: authEmail, password: authPassword, redirect: false,
    });
    if (res?.error) { setAuthError('邮箱或密码错误'); return; }
    setShowLogin(false); setAuthEmail(''); setAuthPassword('');
  };

  const doRegister = async () => {
    setAuthError('');
    if (!authEmail.trim() || !authPassword.trim()) { setAuthError('请填写邮箱和密码'); return; }
    if (authPassword.length < 6) { setAuthError('密码至少 6 位'); return; }
    const res = await fetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail, password: authPassword, name: authName }),
    });
    const data = await res.json();
    if (!res.ok) { setAuthError(data.error); return; }
    // Auto-login after register
    const loginRes = await signIn('credentials', {
      email: authEmail, password: authPassword, redirect: false,
    });
    if (loginRes?.error) { setAuthError('注册成功但登录失败，请手动登录'); return; }
    setShowRegister(false); setAuthEmail(''); setAuthPassword(''); setAuthName('');
  };

  const doLogout = () => { signOut(); setUsageCount(0); };

  const doText = () => generate('text2img', '', textPrompt);
  const doWhiteBg = () => generate('whitebg', '', customPrompt);
  const doCustom = () => generate('custom', '', customEditPrompt);
  const doScene = (sid: string) => { setSelScene(sid); generate('scene', sid, customPrompt); };

  return (
    <>
      <Head><title>EcomPic AI</title></Head>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Top Bar */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between">
            <span className="font-bold text-slate-800">🛍️ EcomPic AI</span>
            <div className="flex items-center gap-3 text-sm">
              {status === 'loading' ? (
                <span className="text-slate-400 text-xs">加载中...</span>
              ) : loggedIn ? (
                <>
                  {userPlan === 'pro' ? (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">✨ PRO</span>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${usageLeft <= 1 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                      剩余 {usageLeft === Infinity ? '∞' : usageLeft} 次
                    </span>
                  )}
                  {userPlan !== 'pro' && (
                    <button onClick={() => setShowPay(true)} className="bg-brand-600 text-white px-4 py-1.5 rounded-full text-xs font-medium hover:bg-brand-700">
                      升级 PRO
                    </button>
                  )}
                  <span className="text-slate-500 text-xs">{session?.user?.email}</span>
                  <button onClick={doLogout} className="text-slate-400 hover:text-red-500 text-xs transition">退出</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setShowLogin(true); setAuthError(''); }} className="text-brand-600 font-medium text-xs hover:underline">登录</button>
                  <button onClick={() => { setShowRegister(true); setAuthError(''); }} className="bg-brand-600 text-white px-4 py-1.5 rounded-full text-xs font-medium hover:bg-brand-700">注册</button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex justify-center mt-8 mb-4">
          <div className="bg-slate-100 rounded-xl p-1 inline-flex">
            <button onClick={() => setMode('upload')} className={`px-5 py-2 rounded-lg text-sm font-medium transition ${mode === 'upload' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>📸 上传产品图</button>
            <button onClick={() => setMode('text')} className={`px-5 py-2 rounded-lg text-sm font-medium transition ${mode === 'text' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>✍️ 文字生图</button>
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
                      <div><p className="text-4xl mb-3">📸</p><p className="font-medium text-slate-700">拖拽产品图</p><p className="text-xs text-slate-400 mt-1">自动压缩</p></div>
                    )}
                  </div>
                  {image && (
                    <>
                      <button onClick={doWhiteBg} disabled={loading} className="w-full bg-brand-600 text-white px-6 py-3 rounded-xl font-semibold text-lg hover:bg-brand-700 disabled:opacity-50 transition">
                        {loading ? '🎨 生成中...' : '🪄 一键白底图'}
                      </button>

                      {/* Custom Edit */}
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-500 mb-2">✏️ 自由编辑原图</h3>
                        <div className="flex gap-2">
                          <input value={customEditPrompt} onChange={e => setCustomEditPrompt(e.target.value)}
                            placeholder="换色/加效果/改风格：变成红色、加闪光..."
                            className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-brand-400" />
                          <button onClick={doCustom} disabled={loading || !customEditPrompt.trim()}
                            className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-900 disabled:opacity-50 transition whitespace-nowrap">🎨 生成</button>
                        </div>
                      </div>

                      {/* Scenes */}
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-500 mb-3">🏠 场景图</h3>
                        <div className="grid grid-cols-4 gap-2">
                          {SCENES.map(s => (
                            <button key={s.id} onClick={() => doScene(s.id)} disabled={loading}
                              className={`flex flex-col items-center p-2 rounded-xl border transition text-sm ${selScene === s.id ? 'border-brand-500 bg-blue-50' : 'border-slate-200 hover:border-brand-400'} disabled:opacity-50`}>
                              <span className="text-xl">{s.e}</span><span className="text-xs mt-1 text-slate-600">{s.l}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Advanced */}
                      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                        <button onClick={() => setShowAdv(!showAdv)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 w-full">
                          <span>{showAdv ? '🔽' : '▶️'}</span><span className="font-medium">高级选项</span>
                        </button>
                        {showAdv && (
                          <div className="mt-3 space-y-3">
                            <div className="flex flex-wrap gap-1.5">
                              {PRESETS.map(p => (
                                <button key={p.id} onClick={() => setCustomPrompt(p.p)} className={`text-xs px-3 py-1.5 rounded-full border ${customPrompt === p.p ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-brand-400'}`}>{p.l}</button>
                              ))}
                            </div>
                            <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder="自定义提示词（中英文都行）" rows={3} className="w-full text-sm border border-slate-200 rounded-xl p-3 outline-none focus:border-brand-400 resize-none" />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {mode === 'text' && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                  <h3 className="font-semibold text-slate-700 mb-2">✍️ 描述你的产品</h3>
                  <textarea value={textPrompt} onChange={e => setTextPrompt(e.target.value)}
                    placeholder="例如：白色无线耳机，大理石桌面，侧面视角，柔光..." rows={4}
                    className="w-full text-sm border border-slate-200 rounded-xl p-3 outline-none focus:border-brand-400 resize-none mb-3" />
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {PRESETS.map(p => (
                      <button key={p.id} onClick={() => setTextPrompt(p.p + ' product photography, white background, studio lighting')}
                        className="text-xs px-3 py-1.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200 hover:border-brand-400">{p.l}</button>
                    ))}
                  </div>
                  <button onClick={doText} disabled={loading} className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition">
                    {loading ? '🎨 生成中...' : '🪄 生成产品图'}
                  </button>
                </div>
              )}
            </div>

            {/* Right */}
            <div className="md:col-span-3">
              {loading && (
                <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 text-center">
                  <div className="animate-bounce text-5xl mb-4">🎨</div><p className="text-slate-600 font-medium text-lg">AI 正在生成中...</p>
                </div>
              )}
              {error && (<div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm mb-4">❌ {error}</div>)}
              {result && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-700">✅ 生成完成</h3>
                    <div className="flex gap-2">
                      <button onClick={() => setResult(null)} className="text-xs text-slate-400 hover:text-slate-600">清除</button>
                      <a href={result} download="result.png" target="_blank" className="text-xs bg-slate-900 text-white px-4 py-1.5 rounded-full hover:bg-slate-800">⬇️ 下载</a>
                    </div>
                  </div>
                  <img src={result} className="w-full rounded-xl shadow-md" alt="" />
                </div>
              )}
              {results.length > 1 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 mb-3">📋 历史 ({results.length})</h3>
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
                  <p className="text-slate-500">{mode === 'text' ? '输入描述开始生成' : '上传产品图开始生成'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Login Modal */}
        <Modal show={showLogin} title="🔐 登录" onClose={() => setShowLogin(false)}>
          {authError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{authError}</div>}
          <input value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="邮箱" type="email"
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-brand-400" />
          <input value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="密码" type="password"
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-4 outline-none focus:border-brand-400"
            onKeyDown={e => e.key === 'Enter' && doLogin()} />
          <button onClick={doLogin} className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition">登录</button>
          <p className="text-center text-sm text-slate-400 mt-3">
            还没有账号？ <button onClick={() => { setShowLogin(false); setShowRegister(true); }} className="text-brand-600 hover:underline">注册</button>
          </p>
        </Modal>

        {/* Register Modal */}
        <Modal show={showRegister} title="🦐 注册 EcomPic" onClose={() => setShowRegister(false)}>
          {authError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-4">{authError}</div>}
          <input value={authName} onChange={e => setAuthName(e.target.value)} placeholder="昵称（选填）"
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-brand-400" />
          <input value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="邮箱" type="email"
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-3 outline-none focus:border-brand-400" />
          <input value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="密码（至少 6 位）" type="password"
            className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 mb-4 outline-none focus:border-brand-400" />
          <button onClick={doRegister} className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition">注册</button>
          <p className="text-xs text-slate-400 text-center mt-3">注册即表示同意服务条款</p>
          <p className="text-center text-sm text-slate-400 mt-2">
            已有账号？ <button onClick={() => { setShowRegister(false); setShowLogin(true); }} className="text-brand-600 hover:underline">登录</button>
          </p>
        </Modal>

        {/* Paywall */}
        <Modal show={showPay} title="🚀 升级 PRO" onClose={() => setShowPay(false)}>
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center mb-2"><span className="font-bold text-2xl">$19</span><span className="text-slate-400 text-sm">/月</span></div>
            <ul className="text-sm text-slate-600 space-y-1"><li>✅ 无限次生成</li><li>✅ 所有功能</li><li>✅ 优先支持</li></ul>
          </div>
          <a href={process.env.NEXT_PUBLIC_STRIPE_LINK || '#'} target="_blank" rel="noopener" className="block w-full bg-brand-600 text-white text-center py-3 rounded-xl font-semibold hover:bg-brand-700 transition">💳 立即升级 ($19/月)</a>
          <p className="text-xs text-slate-400 text-center mt-3">Stripe 安全处理 · 随时取消</p>
        </Modal>
      </main>
    </>
  );
}
