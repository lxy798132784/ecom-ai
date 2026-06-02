import { GetServerSideProps } from 'next';
import fs from 'fs';
import path from 'path';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ai-pixel.online';

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const dir = path.join(process.cwd(), 'content', 'blog');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const blogUrls = files.map(file => {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const slug = raw.match(/^slug:\s*(.+)/m)?.[1]?.trim();
    const date = raw.match(/^date:\s*(.+)/m)?.[1]?.trim();
    if (!slug) return '';
    return `  <url><loc>${escapeXml(`${SITE_URL}/blog/${slug}`)}</loc>${date ? `<lastmod>${escapeXml(date)}</lastmod>` : ''}<changefreq>monthly</changefreq><priority>0.8</priority></url>`;
  }).filter(Boolean);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${escapeXml(SITE_URL)}</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${escapeXml(`${SITE_URL}/blog`)}</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
${blogUrls.join('\n')}
</urlset>`;
  res.setHeader('Content-Type', 'application/xml');
  res.write(xml);
  res.end();
  return { props: {} };
};

export default function Sitemap() { return null; }
