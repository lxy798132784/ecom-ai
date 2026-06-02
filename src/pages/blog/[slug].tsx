import { GetStaticProps, GetStaticPaths } from 'next';
import fs from 'fs';
import path from 'path';
import Head from 'next/head';

interface PostData { slug: string; title: string; date: string; category: string; description: string; content: string; }

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

export default function BlogPost({ post }: { post: PostData }) {
  if (!post) return <div className="text-center py-20 text-slate-500">Post not found</div>;
  return (
    <>
      <Head>
        <title>{post.title} - EcomPic Blog</title>
        <meta name="description" content={post.description} />
        <link rel="canonical" href={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-pixel.online'}/blog/${post.slug}`} />
      </Head>
      <main className="min-h-screen bg-white py-12 px-4">
        <article className="max-w-3xl mx-auto">
          <a href="/blog" className="text-sm text-brand-500 hover:underline mb-4 block">← Back to Blog</a>
          <span className="text-xs text-brand-500 font-medium">{post.category}</span>
          <h1 className="text-3xl font-bold text-slate-800 mt-2 mb-2">{post.title}</h1>
          <p className="text-sm text-slate-400 mb-8">{post.date}</p>
          <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: post.content }} />
        </article>
      </main>
    </>
  );
}

function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mt-8 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-10 mb-4">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mt-10 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-brand-300 pl-4 italic text-slate-500 my-4">$1</blockquote>')
    .replace(/\n\n/g, '</p><p class="mb-4 leading-relaxed text-slate-700">')
    .replace(/^(.+)$/gm, '$1');
}

export const getStaticPaths: GetStaticPaths = async () => {
  const dir = path.join(process.cwd(), 'content', 'blog');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const paths: any[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const m = raw.match(/^slug:\s*(.+)/m);
    if (m) paths.push({ params: { slug: m[1].trim() } });
  }
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = params?.slug as string;
  const dir = path.join(process.cwd(), 'content', 'blog');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    if (!raw.includes(`slug: ${slug}`)) continue;
    const fmMatch = raw.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)/);
    if (!fmMatch) continue;
    const meta: any = {};
    fmMatch[1].split('\n').forEach(line => {
      const m = line.match(/^(\w+):\s*(.+)/);
      if (m) meta[m[1]] = m[2].trim();
    });
    const body = fmMatch[2].trim();
    const description = meta.description || meta.excerpt || fallbackDescription(meta.title, body);
    return { props: { post: { slug, title: meta.title || slug, date: meta.date || '', category: meta.category || 'Blog', description, content: '<p class="mb-4 leading-relaxed text-slate-700">' + mdToHtml(body).replace(/^<p class="mb-4 leading-relaxed text-slate-700">/, '') + '</p>' } } };
  }
  return { props: { post: null } };
};
