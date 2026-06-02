import Head from 'next/head';
import { GetStaticProps, GetStaticPaths } from 'next';
import fs from 'fs';
import path from 'path';
import { useEffect, useMemo, useState } from 'react';
import { BlogCta, BlogVisual } from '../../components/BlogVisual';
import { getBlogZh, BlogLang, expandBlogContent } from '../../lib/blogBilingual';

interface PostData { slug: string; title: string; date: string; category: string; description: string; content: string; titleZh?: string | null; categoryZh?: string | null; descriptionZh?: string | null; contentZh?: string | null; headings: string[]; headingsZh?: string[]; }

function fallbackDescription(title?: string, content?: string): string {
  const plain = (content || '').replace(/^#+\s+/gm, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/\[[^\]]+\]\([^\)]+\)/g, '').replace(/\s+/g, ' ').trim();
  return (plain || title || 'AI ecommerce product photography guide').slice(0, 160);
}
function extractHeadings(md: string) { return Array.from(md.matchAll(/^##\s+(.+)$/gm)).map(m => m[1]).slice(0, 8); }
function slugify(s: string) { return s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-').replace(/^-|-$/g, ''); }
function mdToHtml(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, (_, t) => `<h3 id="${slugify(t)}" class="text-xl font-semibold mt-8 mb-3">${t}</h3>`)
    .replace(/^## (.+)$/gm, (_, t) => `<h2 id="${slugify(t)}" class="text-2xl font-bold mt-10 mb-4">${t}</h2>`)
    .replace(/^# (.+)$/gm, (_, t) => `<h1 class="text-3xl font-bold mt-10 mb-4">${t}</h1>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-brand-300 pl-4 italic text-slate-500 my-4">$1</blockquote>')
    .replace(/\n\n/g, '</p><p class="mb-4 leading-relaxed text-slate-700">');
  return '<p class="mb-4 leading-relaxed text-slate-700">' + html.replace(/^<p class="mb-4 leading-relaxed text-slate-700">/, '') + '</p>';
}
function enhanceContent(html: string, lang: BlogLang, title: string, category: string) {
  const blocks = html.split(/(<h2[^>]*>.*?<\/h2>)/);
  let seen = 0;
  return blocks.map((b, i) => {
    if (b.startsWith('<h2')) seen++;
    if (seen === 2 && b.startsWith('<h2')) {
      return `<div class="my-8 rounded-3xl border border-slate-200 bg-slate-50 p-4"><div class="text-xs font-semibold text-slate-500 mb-2">${lang === 'zh' ? '实操示意图' : 'Workflow visual'}</div><div class="aspect-video rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-slate-900 p-6 text-white"><div class="text-sm opacity-80">${category}</div><div class="mt-3 text-2xl font-bold">${title}</div><div class="mt-6 grid grid-cols-3 gap-3 text-xs"><div class="rounded-xl bg-white/20 p-3">1. Upload</div><div class="rounded-xl bg-white/20 p-3">2. AI Edit</div><div class="rounded-xl bg-white/20 p-3">3. Export</div></div></div></div>` + b;
    }
    return b;
  }).join('');
}

export default function BlogPost({ post }: { post: PostData }) {
  const [lang, setLang] = useState<BlogLang>('zh');
  useEffect(() => { setLang((localStorage.getItem('lang') as BlogLang) || 'zh'); }, []);
  const view = useMemo(() => ({
    title: lang === 'zh' ? (post?.titleZh || post?.title) : post?.title,
    category: lang === 'zh' ? (post?.categoryZh || post?.category) : post?.category,
    description: lang === 'zh' ? (post?.descriptionZh || post?.description) : post?.description,
    content: lang === 'zh' ? (post?.contentZh || post?.content) : post?.content,
    headings: lang === 'zh' ? (post?.headingsZh?.length ? post.headingsZh : post.headings) : post?.headings,
  }), [post, lang]);
  if (!post) return <div className="text-center py-20 text-slate-500">Post not found</div>;
  const enhanced = enhanceContent(view.content || '', lang, view.title || '', view.category || 'Guide');
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-pixel.online';
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Article', headline: view.title, description: view.description, mainEntityOfPage: `${site}/blog/${post.slug}`, image: `${site}/api/og?slug=${post.slug}`, datePublished: post.date, author: { '@type': 'Organization', name: 'EcomPic AI' } };
  return <>
    <Head>
      <title>{view.title} - EcomPic Blog</title>
      <meta name="description" content={view.description || ''} />
      <link rel="canonical" href={`${site}/blog/${post.slug}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </Head>
    <main className="min-h-screen bg-white py-10 px-4">
      <article className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-5">
          <a href="/blog" className="text-sm text-brand-500 hover:underline">← {lang === 'zh' ? '返回博客' : 'Back to Blog'}</a>
          <button onClick={() => { const next = lang === 'zh' ? 'en' : 'zh'; setLang(next); localStorage.setItem('lang', next); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:border-brand-400">{lang === 'zh' ? 'EN' : '中文'}</button>
        </div>
        <BlogVisual title={view.title || ''} category={view.category || ''} slug={post.slug} />
        <div className="mt-8 grid lg:grid-cols-[220px_1fr] gap-8">
          <aside className="hidden lg:block"><div className="sticky top-6 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500 mb-3">{lang === 'zh' ? '目录' : 'Contents'}</p>{(view.headings || []).map(h => <a key={h} href={`#${slugify(h)}`} className="block py-1 text-xs text-slate-500 hover:text-brand-600">{h}</a>)}</div></aside>
          <div>
            <span className="text-xs text-brand-500 font-medium">{view.category}</span>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mt-2 mb-2">{view.title}</h1>
            <p className="text-sm text-slate-400 mb-6">{post.date} · {lang === 'zh' ? '约 6 分钟阅读' : '6 min read'}</p>
            <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: enhanced }} />
            <BlogCta lang={lang} />
            <section className="mt-10 rounded-2xl border border-slate-200 p-5">
              <h2 className="text-xl font-bold mb-3">{lang === 'zh' ? '常见问题' : 'FAQ'}</h2>
              <details className="py-2"><summary className="font-semibold cursor-pointer">{lang === 'zh' ? 'AI 生成的产品图可以商用吗？' : 'Can AI product images be used commercially?'}</summary><p className="text-sm text-slate-600 mt-2">{lang === 'zh' ? '通常可以用于商品页和营销素材，但上架前要确认图片没有错误展示产品功能、结构或品牌元素。' : 'Usually yes for listings and marketing, but review every output for inaccurate product details, claims, or brand elements.'}</p></details>
              <details className="py-2"><summary className="font-semibold cursor-pointer">{lang === 'zh' ? '应该用什么质量和分辨率？' : 'Which quality and resolution should I use?'}</summary><p className="text-sm text-slate-600 mt-2">{lang === 'zh' ? '先用低/中质量测试构图和风格，最终上架图再用高质量和目标平台尺寸。' : 'Test composition with low or medium quality first, then export final listing images at high quality and platform-ready dimensions.'}</p></details>
            </section>
          </div>
        </div>
      </article>
    </main>
  </>;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const dir = path.join(process.cwd(), 'content', 'blog');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const paths: any[] = [];
  for (const file of files) { const raw = fs.readFileSync(path.join(dir, file), 'utf-8'); const m = raw.match(/^slug:\s*(.+)/m); if (m) paths.push({ params: { slug: m[1].trim() } }); }
  return { paths, fallback: false };
};
export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = params?.slug as string;
  const dir = path.join(process.cwd(), 'content', 'blog');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    if (!raw.includes(`slug: ${slug}`)) continue;
    const fmMatch = raw.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)/); if (!fmMatch) continue;
    const meta: any = {}; fmMatch[1].split('\n').forEach(line => { const m = line.match(/^(\w+):\s*(.+)/); if (m) meta[m[1]] = m[2].trim(); });
    const rawBody = fmMatch[2].trim(); const body = expandBlogContent(slug, rawBody); const description = meta.description || meta.excerpt || fallbackDescription(meta.title, body); const zh = getBlogZh(slug);
    return { props: { post: { slug, title: meta.title || slug, date: meta.date || '', category: meta.category || 'Blog', description, content: mdToHtml(body), headings: extractHeadings(body), titleZh: zh?.title || null, categoryZh: zh?.category || null, descriptionZh: zh?.description || null, contentZh: zh ? mdToHtml(zh.content) : null, headingsZh: zh ? extractHeadings(zh.content) : [] } } };
  }
  return { props: { post: null } };
};
