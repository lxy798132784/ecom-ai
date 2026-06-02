import { GetStaticProps } from 'next';
import fs from 'fs';
import path from 'path';
import Head from 'next/head';

interface Post {
  slug: string; title: string; date: string; category: string; description: string;
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
  return (
    <>
      <Head>
        <title>EcomPic Blog - AI Product Photography Guides</title>
        <meta name="description" content="Expert guides on AI product photography, ecommerce image optimization, marketplace image requirements, and product photo workflows." />
        <link rel="canonical" href={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-pixel.online'}/blog`} />
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">📝 EcomPic Blog</h1>
          <p className="text-slate-500 mb-8">AI Product Photography Guides & Tips</p>
          <div className="grid gap-6">
            {posts.map(p => (
              <a key={p.slug} href={`/blog/${p.slug}`} className="block bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:border-brand-400 transition">
                <span className="text-xs text-brand-500 font-medium">{p.category}</span>
                <h2 className="text-lg font-semibold text-slate-800 mt-1">{p.title}</h2>
                <p className="text-sm text-slate-500 mt-2">{p.description}</p>
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
    if (meta.slug && meta.title) posts.push({ slug: meta.slug, title: meta.title, date: meta.date || '', category: meta.category || 'Guide', description: meta.description || meta.excerpt || fallbackDescription(meta.title, body) });
  }
  posts.sort((a, b) => b.date.localeCompare(a.date));
  return { props: { posts } };
};
