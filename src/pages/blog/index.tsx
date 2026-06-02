import { GetStaticProps } from 'next';
import fs from 'fs';
import path from 'path';
import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { getBlogZh, BlogLang } from '../../lib/blogBilingual';

interface Post {
  slug: string; title: string; date: string; category: string; description: string; titleZh?: string; categoryZh?: string; descriptionZh?: string;
}

function fallbackDescription(title?: string, content?: string): string {
  const plain = (content || '')
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[[^\]]+\]\([^\)]+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (plain || title || 'AI ecommerce product photography guide').slice(0, 160);
}

export default function BlogIndex({ posts }: { posts: Post[] }) {
  const [lang, setLang] = useState<BlogLang>('zh');
  useEffect(() => { setLang((localStorage.getItem('lang') as BlogLang) || 'zh'); }, []);
  const viewPosts = useMemo(() => posts.map(p => ({ ...p, viewTitle: lang === 'zh' ? (p.titleZh || p.title) : p.title, viewCategory: lang === 'zh' ? (p.categoryZh || p.category) : p.category, viewDescription: lang === 'zh' ? (p.descriptionZh || p.description) : p.description })), [posts, lang]);
  return (
    <>
      <Head>
        <title>{lang === 'zh' ? 'EcomPic 博客 - AI 产品摄影指南' : 'EcomPic Blog - AI Product Photography Guides'}</title>
        <meta name="description" content={lang === 'zh' ? 'AI 产品摄影、电商图片优化、平台图片要求和产品图工作流指南。' : 'Expert guides on AI product photography, ecommerce image optimization, marketplace image requirements, and product photo workflows.'} />
        <link rel="canonical" href={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-pixel.online'}/blog`} />
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-2">📝 {lang === 'zh' ? 'EcomPic 博客' : 'EcomPic Blog'}</h1>
              <p className="text-slate-500">{lang === 'zh' ? 'AI 产品摄影指南与电商图片运营技巧' : 'AI Product Photography Guides & Tips'}</p>
            </div>
            <button onClick={() => { const next = lang === 'zh' ? 'en' : 'zh'; setLang(next); localStorage.setItem('lang', next); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:border-brand-400">{lang === 'zh' ? 'EN' : '中文'}</button>
          </div>
          <div className="grid gap-6">
            {viewPosts.map(p => (
              <a key={p.slug} href={`/blog/${p.slug}`} className="block bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:border-brand-400 transition">
                <span className="text-xs text-brand-500 font-medium">{p.viewCategory}</span>
                <h2 className="text-lg font-semibold text-slate-800 mt-1">{p.viewTitle}</h2>
                <p className="text-sm text-slate-500 mt-2">{p.viewDescription}</p>
                <span className="text-xs text-slate-400 mt-3 block">{p.date}</span>
              </a>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const dir = path.join(process.cwd(), 'content', 'blog');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const posts: Post[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const fm = raw.match(/^---\n([\s\S]+?)\n---/)?.[1];
    if (!fm) continue;
    const meta: any = {};
    fm.split('\n').forEach(line => {
      const m = line.match(/^(\w+):\s*(.+)/);
      if (m) meta[m[1]] = m[2].trim();
    });
    const body = raw.split('---').slice(2).join('---').trim();
    if (meta.slug && meta.title) {
      const zh = getBlogZh(meta.slug);
      posts.push({ slug: meta.slug, title: meta.title, date: meta.date || '', category: meta.category || 'Guide', description: meta.description || meta.excerpt || fallbackDescription(meta.title, body), titleZh: zh?.title || null, categoryZh: zh?.category || null, descriptionZh: zh?.description || null });
    }
  }
  posts.sort((a, b) => b.date.localeCompare(a.date));
  return { props: { posts } };
};
