import Head from 'next/head';
import { useEffect, useMemo, useState, Fragment } from 'react';

type AdminUser = {
  id?: string;
  email: string;
  name?: string;
  plan?: 'free' | 'pro' | string;
  createdAt?: string;
  usage: number;
  credits: number;
  hasPassword?: boolean;
  passwordHashPreview?: string;
  newPassword?: string;
  history?: string[];
  favorites?: string[];
  historyCountPreview?: number;
  favoritesCountPreview?: number;
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

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
    if (data.loggedIn) await loadUsers();
  };

  const loadUsers = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/users?month=${encodeURIComponent(month)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载失败');
      setUsers(data.users || []);
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadSession().catch(() => {}); }, []);
  useEffect(() => { if (loggedIn) loadUsers().catch(() => {}); }, [month]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      const res = await fetch('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '登录失败');
      setLoggedIn(true); setAdminEmail(data.email || email); setPassword('');
      await loadUsers();
    } catch (e: any) { setError(e.message || '登录失败'); }
    setLoading(false);
  };

  const logout = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setLoggedIn(false); setUsers([]); setAdminEmail('');
  };

  const updateUser = async (user: AdminUser, patch: Partial<AdminUser>) => {
    const next = { ...user, ...patch };
    setUsers(prev => prev.map(u => u.email === user.email ? next : u));
    setMessage('保存中...'); setError('');
    try {
      const res = await fetch(`/api/admin/users?month=${encodeURIComponent(month)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, plan: next.plan, credits: next.credits, usage: next.usage, name: next.name, newPassword: next.newPassword || '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      setUsers(prev => prev.map(u => u.email === user.email ? { ...next, newPassword: '', hasPassword: true, passwordHashPreview: next.newPassword ? '已重置' : next.passwordHashPreview } : u));
      setMessage(`已保存 ${user.email}`);
    } catch (e: any) {
      setError(e.message || '保存失败');
      await loadUsers();
    }
  };

  if (!loggedIn) {
    return <>
      <Head><title>EcomPic Admin</title><meta name="robots" content="noindex,nofollow" /></Head>
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <form onSubmit={login} className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-5">
          <div><h1 className="text-2xl font-bold text-slate-900">EcomPic 后台</h1><p className="text-sm text-slate-500 mt-1">仅管理员账号可登录</p></div>
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-xl p-3">{error}</div>}
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="管理员邮箱" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="管理员密码" className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-brand-500" />
          <button disabled={loading} className="w-full rounded-xl bg-brand-600 text-white py-3 font-semibold hover:bg-brand-700 disabled:opacity-60">{loading ? '登录中...' : '登录后台'}</button>
          <p className="text-xs text-slate-400">需要在 Vercel 环境变量设置 ADMIN_EMAIL、ADMIN_PASSWORD，建议同时设置 ADMIN_SECRET。</p>
        </form>
      </main>
    </>;
  }

  return <>
    <Head><title>EcomPic Admin</title><meta name="robots" content="noindex,nofollow" /></Head>
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-5">
        <header className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold text-slate-900">EcomPic 管理后台</h1><p className="text-sm text-slate-500">当前管理员：{adminEmail}</p></div>
          <div className="flex flex-wrap gap-2">
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button onClick={loadUsers} className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm">刷新</button>
            <button onClick={logout} className="rounded-xl bg-white border border-slate-200 text-slate-600 px-4 py-2 text-sm">退出</button>
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200"><p className="text-xs text-slate-400">用户数</p><p className="text-2xl font-bold">{users.length}</p></div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200"><p className="text-xs text-slate-400">PRO</p><p className="text-2xl font-bold">{users.filter(u => u.plan === 'pro').length}</p></div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200"><p className="text-xs text-slate-400">本月生成</p><p className="text-2xl font-bold">{users.reduce((n, u) => n + Number(u.usage || 0), 0)}</p></div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200"><p className="text-xs text-slate-400">赠送次数</p><p className="text-2xl font-bold">{users.reduce((n, u) => n + Number(u.credits || 0), 0)}</p></div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索邮箱、昵称、会员状态" className="w-full md:w-96 rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-brand-500" />
            <div className="text-sm text-slate-500">{loading ? '加载中...' : `显示 ${filtered.length} / ${users.length}`}</div>
          </div>
          {message && <div className="mx-4 mt-4 bg-green-50 text-green-700 text-sm rounded-xl p-3">{message}</div>}
          {error && <div className="mx-4 mt-4 bg-red-50 text-red-600 text-sm rounded-xl p-3">{error}</div>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left p-3">账号 / 昵称</th><th className="text-left p-3">密码</th><th className="text-left p-3">会员</th><th className="text-left p-3">本月使用</th><th className="text-left p-3">剩余免费</th><th className="text-left p-3">赠送次数</th><th className="text-left p-3">作品</th><th className="text-left p-3">创建时间</th><th className="text-left p-3">操作</th></tr></thead>
              <tbody>
                {filtered.map(u => <Fragment key={u.email}>
                  <tr className="border-t border-slate-100">
                    <td className="p-3"><div className="font-medium text-slate-800">{u.email}</div><input value={u.name || ''} onChange={e => setUsers(prev => prev.map(x => x.email === u.email ? { ...x, name: e.target.value } : x))} className="mt-1 w-40 rounded-lg border border-slate-200 px-2 py-1 text-xs" /></td>
                    <td className="p-3">
                      <div className="text-[11px] text-slate-400 mb-1">明文不可查看，只能重置</div>
                      <input type="password" value={u.newPassword || ''} placeholder="输入新密码" onChange={e => setUsers(prev => prev.map(x => x.email === u.email ? { ...x, newPassword: e.target.value } : x))} className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-xs" />
                      <div className="text-[10px] text-slate-400 mt-1">{u.hasPassword ? `hash: ${u.passwordHashPreview || '已保存'}` : '未设置密码'}</div>
                    </td>
                    <td className="p-3"><select value={u.plan || 'free'} onChange={e => updateUser(u, { plan: e.target.value })} className="rounded-lg border border-slate-200 px-2 py-1"><option value="free">free</option><option value="pro">pro</option></select></td>
                    <td className="p-3"><input type="number" min={0} value={u.usage || 0} onChange={e => setUsers(prev => prev.map(x => x.email === u.email ? { ...x, usage: Number(e.target.value) } : x))} className="w-24 rounded-lg border border-slate-200 px-2 py-1" /></td>
                    <td className="p-3"><span className="inline-flex rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">{Math.max(0, (u.plan === 'pro' ? 1000 : 5) - Number(u.usage || 0))}</span></td>
                    <td className="p-3"><input type="number" min={0} value={u.credits || 0} onChange={e => setUsers(prev => prev.map(x => x.email === u.email ? { ...x, credits: Number(e.target.value) } : x))} className="w-24 rounded-lg border border-slate-200 px-2 py-1" /></td>
                    <td className="p-3 text-xs text-slate-500">历史 {u.history?.length || 0}<br/>收藏 {u.favorites?.length || 0}</td>
                    <td className="p-3 text-xs text-slate-500">{u.createdAt || '-'}</td>
                    <td className="p-3 space-y-2">
                      <button onClick={() => updateUser(u, {})} className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-xs hover:bg-brand-700">保存全部</button>
                      <button onClick={() => setExpandedEmail(expandedEmail === u.email ? '' : u.email)} className="block rounded-lg bg-slate-100 text-slate-600 px-3 py-1.5 text-xs hover:bg-slate-200">{expandedEmail === u.email ? '收起图片' : '查看图片'}</button>
                    </td>
                  </tr>
                  {expandedEmail === u.email && <tr className="bg-slate-50"><td colSpan={9} className="p-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-600 mb-2">历史图片 ({u.history?.length || 0})</h4>
                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">{(u.history || []).map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-200 bg-white p-1 hover:border-brand-400"><img src={url} className="aspect-square w-full object-cover rounded" alt="history" /></a>)}</div>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-600 mb-2">收藏图片 ({u.favorites?.length || 0})</h4>
                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">{(u.favorites || []).map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-200 bg-white p-1 hover:border-brand-400"><img src={url} className="aspect-square w-full object-cover rounded" alt="favorite" /></a>)}</div>
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
