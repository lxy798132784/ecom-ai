import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { t, Lang } from '../lib/i18n';

function getLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  return (localStorage.getItem('lang') as Lang) || 'zh';
}
function setLang(l: Lang) { localStorage.setItem('lang', l); }

type Step = { icon: string; title: string; desc: string; href: string; action: string };

export default function ManualPage() {
  const [lang, setLangState] = useState<Lang>('zh');
  useEffect(() => setLangState(getLang()), []);
  const tr = t[lang] as any;
  const toggleLang = () => { const next = lang === 'zh' ? 'en' : 'zh'; setLangState(next); setLang(next); };
  const steps: Step[] = [
    { icon: '✍️', title: tr.manualStep1Title, desc: tr.manualStep1Desc, href: '/#create', action: tr.manualStep1Action },
    { icon: '🖼️', title: tr.manualStep2Title, desc: tr.manualStep2Desc, href: '/#references', action: tr.manualStep2Action },
    { icon: '⚙️', title: tr.manualStep3Title, desc: tr.manualStep3Desc, href: '/#specs', action: tr.manualStep3Action },
    { icon: '🎨', title: tr.manualStep4Title, desc: tr.manualStep4Desc, href: '/#gallery', action: tr.manualStep4Action },
    { icon: '🎬', title: tr.manualStep5Title, desc: tr.manualStep5Desc, href: '/video', action: tr.manualStep5Action },
    { icon: '🛠️', title: tr.manualStep6Title, desc: tr.manualStep6Desc, href: '/admin', action: tr.manualStep6Action },
  ];
  return <>
    <Head><title>{tr.manual} - Image Studio AI</title></Head>
    <main className="min-h-screen bg-[#08090a] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">← {tr.backHome}</Link>
          <button onClick={toggleLang} className="rounded-xl border border-white/10 px-3 py-2 text-xs">{lang === 'zh' ? 'EN' : '中'}</button>
        </header>
        <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(94,106,210,.28),transparent_34%),rgba(255,255,255,.03)] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-300">Workflow Manual</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] md:text-6xl">{tr.manualHeroTitle}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">{tr.manualHeroDesc}</p>
        </section>
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {steps.map(step => <Link key={step.title} href={step.href} className="group rounded-3xl border border-white/10 bg-white/[0.035] p-5 hover:border-brand-400/60">
            <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500/10 text-2xl">{step.icon}</div><div><h2 className="font-semibold text-slate-50">{step.title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{step.desc}</p><span className="mt-4 inline-flex rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white">{step.action} →</span></div></div>
          </Link>)}
        </section>
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
          <h2 className="font-semibold">FAQ</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm leading-6 text-slate-400">
            <div><b className="text-slate-100">{tr.helpSpecTitle}</b><p>{tr.helpSpecDesc}</p></div>
            <div><b className="text-slate-100">{tr.helpReferenceTitle}</b><p>{tr.helpReferenceDesc}</p></div>
            <div><b className="text-slate-100">{tr.helpGalleryTitle}</b><p>{tr.helpGalleryDesc}</p></div>
          </div>
        </section>
      </div>
    </main>
  </>;
}
