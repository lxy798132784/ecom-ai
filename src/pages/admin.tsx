import Head from 'next/head';
import { useEffect, useMemo, useState, Fragment } from 'react';
import { t, Lang } from '../lib/i18n';
import { FREE_MONTHLY_POINTS, PRO_MONTHLY_POINTS } from '../lib/pricing';

type AdminUser = {
  id?: string;
  email: string;
  name?: string;
  plan?: 'free' | 'pro' | string;
  createdAt?: string;
  usage: number;
  freeUsage?: number;
  proUsage?: number;
  totalPoints?: number;
  credits: number;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  hasPassword?: boolean;
  passwordHashPreview?: string;
  newPassword?: string;
  history?: string[];
  favorites?: string[];
  historyCountPreview?: number;
  favoritesCountPreview?: number;
  collections?: { id: string; name: string; urls: string[] }[];
  mediaHistory?: { id: string; kind: string; url: string; prompt?: string; createdAt?: string }[];
};

type AdminImageProvider = {
  id: string;
  name: string;
  baseURL: string;
  model: string;
  enabled: boolean;
  priority: number;
  hasKey?: boolean;
  keyPreview?: string;
  apiKey?: string;
};

async function imageHash(url: string) {
  const canonical = String(url || '').split('#')[0].split('?')[0];
  const bytes = new TextEncoder().encode(canonical || String(url || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function downloadImage(url: string, filename = 'ecompic-image.png') {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  return (localStorage.getItem('lang') as Lang) || 'zh';
}
function saveLang(l: Lang) { localStorage.setItem('lang', l); }

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [expandedEmail, setExpandedEmail] = useState('');
  const [lang, setLangState] = useState<Lang>('zh');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', plan: 'free', credits: 0, emailVerified: true });
  const [providers, setProviders] = useState<AdminImageProvider[]>([]);
  const [newProvider, setNewProvider] = useState({ name: '', baseURL: '', model: 'gpt-image-2', apiKey: '', priority: 100, enabled: true });
  const tr = t[lang];
  const toggleLang = () => { const next = lang === 'zh' ? 'en' : 'zh'; setLangState(next); saveLang(next); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => `${u.email} ${u.name || ''} ${u.plan || ''}`.toLowerCase().includes(q));
  }, [users, query]);

  const loadSession = async () => {
    const res = await fetch('/api/admin/session');
    const data = await res.json();
    setLoggedIn(Boolean(data.loggedIn));
    setAdminEmail(data.email || '');
    if (data.loggedIn) { await loadUsers(); await loadProviders(); }
  };

  const loadProviders = async () => {
    try {
      const res = await fetch('/api/admin/image-providers');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr.failed);
      setProviders(data.providers || []);
    } catch (e: any) {
      setError(e.message || tr.failed);
    }
  };

  const loadUsers = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/users?month=${encodeURIComponent(month)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr.failed);
      setUsers(data.users || []);
    } catch (e: any) {
      setError(e.message || tr.failed);
    } finally { setLoading(false); }
  };

  useEffect(() => { setLangState(getLang()); loadSession().catch(() => {}); }, []);
  useEffect(() => { if (loggedIn) loadUsers().catch(() => {}); }, [month]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      const res = await fetch('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr.authError);
      setLoggedIn(true); setAdminEmail(data.email || email); setPassword('');
      await loadUsers();
      await loadProviders();
    } catch (e: any) { setError(e.message || tr.authError); }
    setLoading(false);
  };

  const logout = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setLoggedIn(false); setUsers([]); setAdminEmail('');
  };

  const updateUser = async (user: AdminUser, patch: Partial<AdminUser>) => {
    const next = { ...user, ...patch };
    setUsers(prev => prev.map(u => u.email === user.email ? next : u));
    setMessage(tr.saving); setError('');
    try {
      const res = await fetch(`/api/admin/users?month=${encodeURIComponent(month)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, plan: next.plan, credits: next.credits, usage: next.usage, name: next.name, emailVerified: next.emailVerified !== false, newPassword: next.newPassword || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr.failed);
      setUsers(prev => prev.map(u => u.email === user.email ? { ...next, newPassword: '', hasPassword: true, passwordHashPreview: next.newPassword ? tr.saved : next.passwordHashPreview } : u));
      setMessage(tr.savedUser.replace('{email}', user.email));
    } catch (e: any) {
      setError(e.message || tr.failed);
      await loadUsers();
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMessage(tr.saving); setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr.failed);
      setNewUser({ email: '', name: '', password: '', plan: 'free', credits: 0, emailVerified: true });
      setMessage(tr.userCreated.replace('{email}', data.user?.email || newUser.email));
      await loadUsers();
    } catch (err: any) {
      setError(err.message || tr.failed);
    } finally {
      setLoading(false);
    }
  };
  const saveProvider = async (provider?: AdminImageProvider) => {
    const payload = provider || newProvider;
    setMessage('保存生图模型配置中...'); setError('');
    try {
      const res = await fetch('/api/admin/image-providers', {
        method: provider?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr.failed);
      setProviders(data.providers || []);
      if (!provider?.id) setNewProvider({ name: '', baseURL: '', model: 'gpt-image-2', apiKey: '', priority: 100, enabled: true });
      setMessage('生图模型配置已保存');
    } catch (e: any) {
      setError(e.message || tr.failed);
    }
  };

  const deleteProvider = async (provider: AdminImageProvider) => {
    if (!confirm(`删除生图模型配置：${provider.name || provider.baseURL}？`)) return;
    try {
      const res = await fetch('/api/admin/image-providers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: provider.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr.failed);
      setProviders(data.providers || []);
      setMessage('生图模型配置已删除');
    } catch (e: any) { setError(e.message || tr.failed); }
  };


  const deleteUserImage = async (user: AdminUser, kind: 'history' | 'favorites', url: string) => {
    if (!confirm(tr.confirmDeleteUserImage.replace('{email}', user.email).replace('{kind}', kind === 'history' ? tr.historyKind : tr.favoritesKind))) return;
    const id = await imageHash(url);
    const prev = users;
    setUsers(list => list.map(u => u.email === user.email ? { ...u, [kind]: (u[kind] || []).filter(x => x !== url) } : u));
    setMessage(tr.deleting); setError('');
    try {
      const res = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, kind, id, url: url.length < 2000 ? url : '' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tr.deleteFailed);
      setMessage(tr.imageDeleted);
    } catch (e: any) {
      setUsers(prev);
      setError(e.message || tr.deleteFailed);
    }
  };

  const copyImageLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage(tr.imageLinkCopied);
    } catch {
      setError(tr.copyFailed);
    }
  };

  const exportUserData = (user: AdminUser) => {
    const blob = new Blob([JSON.stringify(user, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `user-${user.email}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const deleteUserAccount = async (user: AdminUser) => {
    if (!confirm(tr.confirmDeleteUserAccount.replace('{email}', user.email))) return;
    const typed = window.prompt(tr.confirmDeleteUserAccountPrompt.replace('{email}', user.email));
    if (typed !== user.email) { setError(tr.deleteUserAccountMismatch); return; }
    const prev = users;
    setUsers(list => list.filter(u => u.email !== user.email));
    setMessage(tr.deleting); setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, kind: 'account', confirm: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr.deleteUserAccountFailed);
      if (expandedEmail === user.email) setExpandedEmail('');
      setMessage(tr.userAccountDeleted.replace('{email}', user.email));
    } catch (e: any) {
      setUsers(prev);
      setError(e.message || tr.deleteUserAccountFailed);
    }
  };

  const deleteUserMedia = async (user: AdminUser, item: { id?: string; url: string }) => {
    if (!confirm(tr.confirmDeleteUserMedia.replace('{email}', user.email))) return;
    const prev = users; setUsers(list => list.map(u => u.email === user.email ? { ...u, mediaHistory: (u.mediaHistory || []).filter(x => x.id !== item.id && x.url !== item.url) } : u));
    try { const res = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, kind: 'media', id: item.id, url: item.url }) }); if (!res.ok) throw new Error(tr.deleteFailed); setMessage(tr.imageDeleted); } catch (e: any) { setUsers(prev); setError(e.message || tr.deleteFailed); }
  };

  const deleteUserCollection = async (user: AdminUser, id: string, url = '') => {
    if (!confirm(tr.confirmDeleteUserCollection.replace('{email}', user.email))) return;
    const prev = users;
    setUsers(list => list.map(u => u.email === user.email ? { ...u, collections: url ? (u.collections || []).map(c => c.id === id ? { ...c, urls: (c.urls || []).filter(x => x !== url) } : c) : (u.collections || []).filter(c => c.id !== id) } : u));
    try { const res = await fetch('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, kind: 'collection', id, url }) }); if (!res.ok) throw new Error(tr.deleteFailed); setMessage(tr.imageDeleted); } catch (e: any) { setUsers(prev); setError(e.message || tr.deleteFailed); }
  };


  if (!loggedIn) {
    return <>
      <Head><title>EcomPic Admin</title><meta name="robots" content="noindex,nofollow" /></Head>
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <form onSubmit={login} className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-5">
          <div className="flex justify-end"><button type="button" onClick={toggleLang} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">{lang === 'zh' ? 'EN' : '中'}</button></div>
          <div><h1 className="text-2xl font-bold text-slate-900">{tr.adminLoginTitle}</h1><p className="text-sm text-slate-500 mt-1">{tr.adminLoginDesc}</p></div>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3">{error}</div>}
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder={tr.adminEmail} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder={tr.adminPassword} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" />
          <button disabled={loading} className="w-full rounded-xl bg-brand-600 text-white py-3 font-semibold hover:bg-brand-700 disabled:opacity-60">{loading ? tr.adminLoginLoading : tr.adminLoginButton}</button>
          <p className="text-xs text-slate-400">{tr.adminLoginHelp}</p>
        </form>
      </main>
    </>;
  }

  return <>
    <Head><title>EcomPic Admin</title><meta name="robots" content="noindex,nofollow" /></Head>
    <main className="min-h-screen bg-slate-100 px-3 py-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-4 md:space-y-5">
        <header className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0"><h1 className="text-xl font-bold text-slate-900 md:text-2xl">{tr.adminDashboardTitle}</h1><p className="break-all text-xs text-slate-500 md:text-sm">{tr.currentAdmin.replace('{email}', adminEmail)}</p></div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap md:justify-end">
            <button onClick={toggleLang} className="rounded-xl bg-white border border-slate-200 text-slate-600 px-3 py-2 text-sm whitespace-nowrap">{lang === 'zh' ? 'EN' : '中'}</button>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="min-w-0 rounded-xl border border-slate-200 px-2 py-2 text-sm" />
            <button onClick={loadUsers} className="rounded-xl bg-slate-900 text-white px-3 py-2 text-sm whitespace-nowrap">{tr.refresh}</button>
            <button onClick={logout} className="rounded-xl bg-white border border-slate-200 text-slate-600 px-3 py-2 text-sm whitespace-nowrap">{tr.logout}</button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm md:rounded-2xl md:p-4">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 md:text-xs md:tracking-[0.18em]">{tr.userCount}</p>
            <p className="mt-1 text-xl font-black tracking-tight text-slate-950 md:mt-2 md:text-3xl">{users.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm md:rounded-2xl md:p-4">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 md:text-xs md:tracking-[0.18em]">PRO</p>
            <p className="mt-1 text-xl font-black tracking-tight text-slate-950 md:mt-2 md:text-3xl">{users.filter(u => u.plan === 'pro').length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm md:rounded-2xl md:p-4">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 md:text-xs md:tracking-[0.18em]">{tr.verifiedAccounts}</p>
            <p className="mt-1 text-xl font-black tracking-tight text-emerald-600 md:mt-2 md:text-3xl">{users.filter(u => u.emailVerified !== false).length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm md:rounded-2xl md:p-4">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 md:text-xs md:tracking-[0.18em]">{tr.monthUsage}</p>
            <p className="mt-1 text-xl font-black tracking-tight text-slate-950 md:mt-2 md:text-3xl">{users.reduce((n, u) => n + Number(u.freeUsage || 0) + Number(u.proUsage || 0), 0)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm md:rounded-2xl md:p-4">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 md:text-xs md:tracking-[0.18em]">总积分</p>
            <p className="mt-1 text-xl font-black tracking-tight text-slate-950 md:mt-2 md:text-3xl">{users.reduce((n, u) => n + Number(u.totalPoints ?? (Math.max(0, (u.plan === 'pro' ? PRO_MONTHLY_POINTS : FREE_MONTHLY_POINTS) - Number(u.usage || 0)) + Number(u.credits || 0))), 0)}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">生图模型配置</h2>
              <p className="text-sm text-slate-500">按优先级从小到大调用；当前配置失败会自动回落到下一条，最后回落到 Vercel 环境变量 OPENAI_*。</p>
            </div>
            <button onClick={loadProviders} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">刷新模型</button>
          </div>
          <div className="grid gap-2 md:grid-cols-6">
            <input value={newProvider.name} onChange={e => setNewProvider(v => ({ ...v, name: e.target.value }))} placeholder="名称，如 SafeAPI 主线路" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-1" />
            <input value={newProvider.baseURL} onChange={e => setNewProvider(v => ({ ...v, baseURL: e.target.value }))} placeholder="Base URL，如 https://safeapi.vip/v1" className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
            <input value={newProvider.model} onChange={e => setNewProvider(v => ({ ...v, model: e.target.value }))} placeholder="模型名，如 gpt-image-2" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input type="password" value={newProvider.apiKey} onChange={e => setNewProvider(v => ({ ...v, apiKey: e.target.value }))} placeholder="API Key" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" onClick={() => saveProvider()} className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white">添加模型</button>
          </div>
          <div className="mt-3 space-y-2">
            {providers.map(p => <div key={p.id} className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs md:grid-cols-12 md:items-center">
              <input value={p.name} onChange={e => setProviders(list => list.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} className="rounded-lg border border-slate-200 px-2 py-2 md:col-span-2" />
              <input value={p.baseURL} onChange={e => setProviders(list => list.map(x => x.id === p.id ? { ...x, baseURL: e.target.value } : x))} className="rounded-lg border border-slate-200 px-2 py-2 md:col-span-3" />
              <input value={p.model} onChange={e => setProviders(list => list.map(x => x.id === p.id ? { ...x, model: e.target.value } : x))} className="rounded-lg border border-slate-200 px-2 py-2 md:col-span-2" />
              <input type="password" value={p.apiKey || ''} onChange={e => setProviders(list => list.map(x => x.id === p.id ? { ...x, apiKey: e.target.value } : x))} placeholder={p.hasKey ? `留空保留 ${p.keyPreview}` : 'API Key'} className="rounded-lg border border-slate-200 px-2 py-2 md:col-span-2" />
              <input type="number" value={p.priority} onChange={e => setProviders(list => list.map(x => x.id === p.id ? { ...x, priority: Number(e.target.value) } : x))} className="rounded-lg border border-slate-200 px-2 py-2" />
              <label className="flex items-center gap-1"><input type="checkbox" checked={p.enabled !== false} onChange={e => setProviders(list => list.map(x => x.id === p.id ? { ...x, enabled: e.target.checked } : x))} />启用</label>
              <div className="flex gap-1"><button onClick={() => saveProvider(p)} className="rounded-lg bg-brand-600 px-2 py-2 font-semibold text-white">保存</button><button onClick={() => deleteProvider(p)} className="rounded-lg bg-red-50 px-2 py-2 font-semibold text-red-600">删</button></div>
            </div>)}
            {!providers.length && <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">暂无后台模型配置。系统仍会使用 Vercel 环境变量 OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_IMAGE_MODEL。</div>}
          </div>
        </section>

        <form onSubmit={createUser} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
          <div className="mb-3 flex flex-col gap-3 md:mb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{tr.createUserTitle}</h2>
              <p className="text-sm text-slate-500">{tr.createUserDesc}</p>
            </div>
            <button type="button" onClick={() => setShowCreateForm(v => !v)} className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 md:w-auto md:py-2">{showCreateForm ? tr.collapseImages : tr.createUserButton}</button>
          </div>
          {showCreateForm && <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-6 md:gap-3">
              <input required type="email" value={newUser.email} onChange={e => setNewUser(v => ({ ...v, email: e.target.value }))} placeholder={tr.accountEmail} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 md:col-span-2" />
              <input value={newUser.name} onChange={e => setNewUser(v => ({ ...v, name: e.target.value }))} placeholder={tr.accountNameInput} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              <input required type="password" value={newUser.password} onChange={e => setNewUser(v => ({ ...v, password: e.target.value }))} placeholder={tr.initialPassword} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              <select value={newUser.plan} onChange={e => setNewUser(v => ({ ...v, plan: e.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"><option value="free">free</option><option value="pro">pro</option></select>
              <input type="number" min={0} value={newUser.credits} onChange={e => setNewUser(v => ({ ...v, credits: Number(e.target.value) }))} placeholder={tr.creditBalance} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </div>
            <label className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 md:inline-flex">
              <input type="checkbox" checked={newUser.emailVerified} onChange={e => setNewUser(v => ({ ...v, emailVerified: e.target.checked }))} className="h-5 w-5 shrink-0 accent-emerald-600" />
              {tr.markVerifiedOnCreate}
            </label>
            <button disabled={loading} className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 md:w-auto md:py-2">{tr.createUserButton}</button>
          </div>}
        </form>

        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tr.searchUsers} className="w-full md:w-96 rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand-500" />
            <div className="text-sm text-slate-500">{loading ? tr.loading : tr.adminShowing.replace('{shown}', String(filtered.length)).replace('{total}', String(users.length))}</div>
          </div>
          {message && <div className="mx-4 mt-4 bg-green-50 text-green-700 text-sm rounded-xl p-3">{message}</div>}
          {error && <div className="mx-4 mt-4 bg-red-50 text-red-600 text-sm rounded-xl p-3">{error}</div>}
          <div className="md:hidden divide-y divide-slate-100">
            {filtered.map(u => <div key={`mobile-${u.email}`} className="p-3 space-y-3 md:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <div className="break-all text-sm font-semibold text-slate-900">{u.email}</div>
                  <input value={u.name || ''} onChange={e => setUsers(prev => prev.map(x => x.email === u.email ? { ...x, name: e.target.value } : x))} placeholder={tr.accountNameInput} className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                </div>
                <button onClick={() => updateUser(u, { emailVerified: u.emailVerified === false })} className={`min-h-10 shrink-0 rounded-xl px-3 py-2 text-xs font-semibold sm:rounded-full ${u.emailVerified === false ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'}`}>{u.emailVerified === false ? tr.unverified : tr.verified}</button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="space-y-1"><span className="text-slate-500">{tr.planCol}</span><select value={u.plan || 'free'} onChange={e => updateUser(u, { plan: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-2"><option value="free">free</option><option value="pro">pro</option></select></label>
                <label className="space-y-1"><span className="text-slate-500">{tr.creditBalance}</span><input type="number" min={0} value={u.credits || 0} onChange={e => setUsers(prev => prev.map(x => x.email === u.email ? { ...x, credits: Number(e.target.value) } : x))} className="w-full rounded-lg border border-slate-200 px-2 py-2" /></label>
                <label className="space-y-1"><span className="text-slate-500">{tr.monthUsageCol}</span><input type="number" min={0} value={u.usage || 0} onChange={e => setUsers(prev => prev.map(x => x.email === u.email ? { ...x, usage: Number(e.target.value), ...(x.plan === 'pro' ? { proUsage: Number(e.target.value) } : { freeUsage: Number(e.target.value) }) } : x))} className="w-full rounded-lg border border-slate-200 px-2 py-2" /></label>
                <label className="space-y-1"><span className="text-slate-500">{tr.newPassword}</span><input type="password" value={u.newPassword || ''} onChange={e => setUsers(prev => prev.map(x => x.email === u.email ? { ...x, newPassword: e.target.value } : x))} className="w-full rounded-lg border border-slate-200 px-2 py-2" /></label>
              </div>
              <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                <div>{tr.creditBalance}: <b>{u.totalPoints ?? (Math.max(0, (u.plan === 'pro' ? PRO_MONTHLY_POINTS : FREE_MONTHLY_POINTS) - Number(u.usage || 0)) + Number(u.credits || 0))}</b></div>
                <div>{tr.createdAt}: <b className="break-all">{u.createdAt || '-'}</b></div>
                <div>{tr.historyCount.replace('{count}', String(u.history?.length || 0))}</div>
                <div>{tr.favoritesCount.replace('{count}', String(u.favorites?.length || 0))}</div>
                <div>{tr.collectionsCount.replace('{count}', String(u.collections?.length || 0))}</div>
                <div>{tr.mediaCount.replace('{count}', String(u.mediaHistory?.length || 0))}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => updateUser(u, {})} className="rounded-lg bg-brand-600 px-3 py-2.5 text-xs font-semibold text-white">{tr.saveAll}</button>
                <button onClick={() => setExpandedEmail(expandedEmail === u.email ? '' : u.email)} className="rounded-lg bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700">{expandedEmail === u.email ? tr.collapseImages : tr.viewImages}</button>
                <button onClick={() => exportUserData(u)} className="rounded-lg bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700">{tr.exportData}</button>
                <button onClick={() => deleteUserAccount(u)} className="rounded-lg bg-red-600 px-3 py-2.5 text-xs font-semibold text-white">{tr.deleteAccount}</button>
              </div>
              {expandedEmail === u.email && <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-slate-600">{tr.historyImages} ({u.history?.length || 0})</h4>
                  <div className="grid grid-cols-2 gap-2">{(u.history || []).map((url, idx) => <div key={url} className="rounded-xl border border-slate-200 bg-white p-2"><a href={url} target="_blank" rel="noreferrer"><img src={url} className="aspect-square w-full rounded-lg object-cover" alt="history" /></a><div className="mt-2 grid grid-cols-2 gap-1 text-[10px]"><button onClick={() => window.open(url, '_blank')} className="rounded bg-slate-100 px-1 py-1">{tr.open}</button><button onClick={() => downloadImage(url, `history-${idx + 1}.png`)} className="rounded bg-slate-100 px-1 py-1">{tr.download}</button><button onClick={() => copyImageLink(url)} className="rounded bg-slate-100 px-1 py-1">{tr.copy}</button><button onClick={() => deleteUserImage(u, 'history', url)} className="rounded bg-red-50 px-1 py-1 text-red-600">{tr.delete}</button></div></div>)}</div>
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-slate-600">{tr.favoriteImages} ({u.favorites?.length || 0})</h4>
                  <div className="grid grid-cols-2 gap-2">{(u.favorites || []).map((url, idx) => <div key={url} className="rounded-xl border border-slate-200 bg-white p-2"><a href={url} target="_blank" rel="noreferrer"><img src={url} className="aspect-square w-full rounded-lg object-cover" alt="favorite" /></a><div className="mt-2 grid grid-cols-2 gap-1 text-[10px]"><button onClick={() => window.open(url, '_blank')} className="rounded bg-slate-100 px-1 py-1">{tr.open}</button><button onClick={() => downloadImage(url, `favorite-${idx + 1}.png`)} className="rounded bg-slate-100 px-1 py-1">{tr.download}</button><button onClick={() => copyImageLink(url)} className="rounded bg-slate-100 px-1 py-1">{tr.copy}</button><button onClick={() => deleteUserImage(u, 'favorites', url)} className="rounded bg-red-50 px-1 py-1 text-red-600">{tr.delete}</button></div></div>)}</div>
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-slate-600">{tr.collections} ({u.collections?.length || 0})</h4>
                  <div className="space-y-2">{(u.collections || []).map(c => <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs"><div className="flex items-center justify-between gap-2"><div className="font-semibold text-slate-700">{c.name}</div><button onClick={() => deleteUserCollection(u, c.id)} className="rounded bg-red-50 px-2 py-1 text-red-600">{tr.delete}</button></div><div className="mt-1 text-slate-500">{c.urls?.length || 0} images</div><div className="mt-2 grid grid-cols-3 gap-1">{(c.urls || []).slice(0, 6).map(url => <div key={url} className="relative"><img src={url} className="aspect-square rounded object-cover" alt=""/><button onClick={() => deleteUserCollection(u, c.id, url)} className="absolute right-0 top-0 rounded bg-black/60 px-1 text-white">×</button></div>)}</div></div>)}</div>
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-slate-600">{tr.mediaHistory} ({u.mediaHistory?.length || 0})</h4>
                  <div className="space-y-2">{(u.mediaHistory || []).map(m => <div key={m.id || m.url} className="rounded-xl border border-slate-200 bg-white p-3 text-xs"><div className="font-semibold text-slate-700">{m.kind}</div><div className="line-clamp-2 break-all text-slate-500">{m.prompt || m.url}</div><div className="mt-2 flex flex-wrap gap-1"><button onClick={() => window.open(m.url, '_blank')} className="rounded bg-slate-100 px-2 py-1">{tr.open}</button><button onClick={() => copyImageLink(m.url)} className="rounded bg-slate-100 px-2 py-1">{tr.copy}</button><button onClick={() => deleteUserMedia(u, m)} className="rounded bg-red-50 px-2 py-1 text-red-600">{tr.delete}</button></div></div>)}</div>
                </div>
              </div>}
            </div>)}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left p-3">{tr.accountName}</th><th className="text-left p-3">{tr.verificationCol}</th><th className="text-left p-3">{tr.passwordCol}</th><th className="text-left p-3">{tr.planCol}</th><th className="text-left p-3">{tr.monthUsageCol}</th><th className="text-left p-3">总积分</th><th className="text-left p-3">充值积分</th><th className="text-left p-3">{tr.works}</th><th className="text-left p-3">{tr.createdAt}</th><th className="text-left p-3">{tr.actions}</th></tr></thead>
              <tbody>
                {filtered.map(u => <Fragment key={u.email}>
                  <tr className="border-t border-slate-100">
                    <td className="p-3"><div className="font-medium text-slate-800">{u.email}</div><input value={u.name || ''} onChange={e => setUsers(prev => prev.map(x => x.email === u.email ? { ...x, name: e.target.value } : x))} className="mt-1 w-40 rounded-lg border border-slate-200 px-2 py-1 text-xs" /></td>
                    <td className="p-3">
                      <button onClick={() => updateUser(u, { emailVerified: u.emailVerified === false })} className={`inline-flex min-w-24 items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${u.emailVerified === false ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'}`}>{u.emailVerified === false ? tr.unverified : tr.verified}</button>
                      <div className="mt-1 text-[10px] text-slate-400">{u.emailVerified === false ? tr.setVerified : tr.setUnverified}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-[11px] text-slate-400 mb-1">{tr.passwordNoView}</div>
                      <input type="password" value={u.newPassword || ''} placeholder={tr.newPassword} onChange={e => setUsers(prev => prev.map(x => x.email === u.email ? { ...x, newPassword: e.target.value } : x))} className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs" />
                      <div className="text-[10px] text-slate-400 mt-1">{u.hasPassword ? `hash: ${u.passwordHashPreview || tr.saved}` : tr.noPassword}</div>
                    </td>
                    <td className="p-3"><select value={u.plan || 'free'} onChange={e => updateUser(u, { plan: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1"><option value="free">free</option><option value="pro">pro</option></select></td>
                    <td className="p-3"><input type="number" min={0} value={u.usage || 0} onChange={e => setUsers(prev => prev.map(x => x.email === u.email ? { ...x, usage: Number(e.target.value), ...(x.plan === 'pro' ? { proUsage: Number(e.target.value) } : { freeUsage: Number(e.target.value) }) } : x))} className="w-24 rounded-lg border border-slate-200 px-2 py-1" /><div className="text-[10px] text-slate-400 mt-1">free {u.freeUsage || 0} {tr.times} · pro {u.proUsage || 0} {tr.times}</div></td>
                    <td className="p-3"><span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">{u.totalPoints ?? (Math.max(0, (u.plan === 'pro' ? PRO_MONTHLY_POINTS : FREE_MONTHLY_POINTS) - Number(u.usage || 0)) + Number(u.credits || 0))}</span></td>
                    <td className="p-3"><input type="number" min={0} value={u.credits || 0} onChange={e => setUsers(prev => prev.map(x => x.email === u.email ? { ...x, credits: Number(e.target.value) } : x))} className="w-24 rounded-lg border border-slate-200 px-2 py-1" /></td>
                    <td className="p-3 text-xs text-slate-500">{tr.historyCount.replace('{count}', String(u.history?.length || 0))}<br/>{tr.favoritesCount.replace('{count}', String(u.favorites?.length || 0))}<br/>{tr.collectionsCount.replace('{count}', String(u.collections?.length || 0))}<br/>{tr.mediaCount.replace('{count}', String(u.mediaHistory?.length || 0))}</td>
                    <td className="p-3 text-xs text-slate-500">{u.createdAt || '-'}</td>
                    <td className="p-3 space-y-2">
                      <button onClick={() => updateUser(u, {})} className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-xs hover:bg-brand-700">{tr.saveAll}</button>
                      <button onClick={() => setExpandedEmail(expandedEmail === u.email ? '' : u.email)} className="block rounded-lg bg-slate-100 text-slate-600 px-3 py-1.5 text-xs hover:bg-slate-200">{expandedEmail === u.email ? tr.collapseImages : tr.viewImages}</button><button onClick={() => exportUserData(u)} className="block rounded-lg bg-slate-100 text-slate-600 px-3 py-1.5 text-xs hover:bg-slate-200">{tr.exportData}</button>
                      <button onClick={() => deleteUserAccount(u)} className="block rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs hover:bg-red-700">{tr.deleteAccount}</button>
                    </td>
                  </tr>
                  {expandedEmail === u.email && <tr className="bg-slate-50"><td colSpan={10} className="p-4">
                    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-600 mb-2">{tr.historyImages} ({u.history?.length || 0})</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{(u.history || []).map((url, idx) => <div key={url} className="rounded-xl border border-slate-200 bg-white p-2"><a href={url} target="_blank" rel="noreferrer"><img src={url} className="aspect-square w-full object-cover rounded-lg" alt="history" /></a><div className="mt-2 grid grid-cols-2 gap-1 text-[10px]"><button onClick={() => window.open(url, '_blank')} className="rounded bg-slate-100 px-1 py-1">{tr.open}</button><button onClick={() => downloadImage(url, `history-${idx + 1}.png`)} className="rounded bg-slate-100 px-1 py-1">{tr.download}</button><button onClick={() => copyImageLink(url)} className="rounded bg-slate-100 px-1 py-1">{tr.copy}</button><button onClick={() => deleteUserImage(u, 'history', url)} className="rounded bg-red-50 px-1 py-1 text-red-600">{tr.delete}</button></div></div>)}</div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-600 mb-2">{tr.favoriteImages} ({u.favorites?.length || 0})</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{(u.favorites || []).map((url, idx) => <div key={url} className="rounded-xl border border-slate-200 bg-white p-2"><a href={url} target="_blank" rel="noreferrer"><img src={url} className="aspect-square w-full object-cover rounded-lg" alt="favorite" /></a><div className="mt-2 grid grid-cols-2 gap-1 text-[10px]"><button onClick={() => window.open(url, '_blank')} className="rounded bg-slate-100 px-1 py-1">{tr.open}</button><button onClick={() => downloadImage(url, `favorite-${idx + 1}.png`)} className="rounded bg-slate-100 px-1 py-1">{tr.download}</button><button onClick={() => copyImageLink(url)} className="rounded bg-slate-100 px-1 py-1">{tr.copy}</button><button onClick={() => deleteUserImage(u, 'favorites', url)} className="rounded bg-red-50 px-1 py-1 text-red-600">{tr.delete}</button></div></div>)}</div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-600 mb-2">{tr.collections} ({u.collections?.length || 0})</h4>
                        <div className="space-y-2">{(u.collections || []).map(c => <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs"><div className="flex items-center justify-between gap-2"><div className="font-semibold text-slate-700">{c.name}</div><button onClick={() => deleteUserCollection(u, c.id)} className="rounded bg-red-50 px-2 py-1 text-red-600">{tr.delete}</button></div><div className="mt-1 text-slate-500">{c.urls?.length || 0} images</div><div className="mt-2 grid grid-cols-3 gap-1">{(c.urls || []).slice(0, 6).map(url => <div key={url} className="relative"><img src={url} className="aspect-square rounded object-cover" alt=""/><button onClick={() => deleteUserCollection(u, c.id, url)} className="absolute right-0 top-0 rounded bg-black/60 px-1 text-white">×</button></div>)}</div></div>)}</div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-600 mb-2">{tr.mediaHistory} ({u.mediaHistory?.length || 0})</h4>
                        <div className="space-y-2">{(u.mediaHistory || []).map(m => <div key={m.id || m.url} className="rounded-xl border border-slate-200 bg-white p-3 text-xs"><div className="font-semibold text-slate-700">{m.kind}</div><div className="line-clamp-2 text-slate-500">{m.prompt || m.url}</div><div className="mt-2 flex gap-1"><button onClick={() => window.open(m.url, '_blank')} className="rounded bg-slate-100 px-2 py-1">{tr.open}</button><button onClick={() => copyImageLink(m.url)} className="rounded bg-slate-100 px-2 py-1">{tr.copy}</button><button onClick={() => deleteUserMedia(u, m)} className="rounded bg-red-50 px-2 py-1 text-red-600">{tr.delete}</button></div></div>)}</div>
                      </div>
                    </div>
                  </td></tr>}
                </Fragment>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  </>;
}
