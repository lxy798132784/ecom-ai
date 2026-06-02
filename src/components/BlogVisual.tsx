import Link from 'next/link';

type BlogVisualProps = { title: string; category?: string; slug?: string; size?: 'card' | 'hero' | 'inline' };

function hashHue(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) % 360;
  return hash;
}

export function BlogVisual({ title, category = 'Guide', slug = title, size = 'card' }: BlogVisualProps) {
  const hue = hashHue(slug);
  const height = size === 'hero' ? 'h-72 md:h-96' : size === 'inline' ? 'h-56' : 'h-44';
  const compact = size === 'card';
  return (
    <div
      className={`relative overflow-hidden rounded-3xl ${height} border border-white/30 shadow-sm blog-visual`}
      style={{
        background: `radial-gradient(circle at 18% 22%, hsl(${hue} 92% 74% / .95), transparent 32%), radial-gradient(circle at 82% 18%, hsl(${(hue + 70) % 360} 92% 68% / .8), transparent 30%), linear-gradient(135deg, hsl(${hue} 80% 52%), hsl(${(hue + 42) % 360} 88% 42%))`,
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.25),rgba(255,255,255,0)_45%),radial-gradient(circle_at_50%_100%,rgba(15,23,42,.36),transparent_58%)]" />
      <div className="absolute -right-16 -bottom-16 h-56 w-56 rounded-full bg-white/20 blur-2xl" />
      <div className="absolute left-6 top-6 rounded-2xl bg-white/18 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">{category}</div>
      <div className="absolute inset-x-6 bottom-6">
        <div className="mb-4 grid grid-cols-3 gap-2 max-w-sm">
          <div className="rounded-2xl bg-white/24 p-3 backdrop-blur-md"><div className="h-10 rounded-xl bg-white/70" /><div className="mt-2 h-2 w-14 rounded bg-white/55" /></div>
          <div className="rounded-2xl bg-white/18 p-3 backdrop-blur-md"><div className="h-10 rounded-xl bg-white/55" /><div className="mt-2 h-2 w-12 rounded bg-white/45" /></div>
          <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-md"><div className="h-10 rounded-xl bg-white/45" /><div className="mt-2 h-2 w-10 rounded bg-white/35" /></div>
        </div>
        <p className={`${compact ? 'text-base' : 'text-2xl md:text-4xl'} font-black leading-tight text-white drop-shadow max-w-3xl`}>{title}</p>
        {!compact && <p className="mt-3 max-w-2xl text-sm md:text-base text-white/85">Upload → choose intent → generate → compare → export marketplace-ready images.</p>}
      </div>
    </div>
  );
}

export function BlogCta({ lang = 'zh' }: { lang?: 'zh' | 'en' }) {
  return (
    <div className="my-10 rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 to-blue-50 p-6 md:p-8 text-center dark-cta">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-600">EcomPic AI</p>
      <h3 className="mt-2 text-2xl font-black text-slate-900">{lang === 'zh' ? '别再只读教程了，直接把产品图做出来' : 'Stop only reading guides — create the product image now'}</h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600">
        {lang === 'zh'
          ? '上传商品图，先用低积分测试白底、场景、社媒构图，满意后再导出高质量版本。'
          : 'Upload a product image, test white-background, lifestyle, and social layouts with low points, then export the winning version in high quality.'}
      </p>
      <Link href="/" className="mt-5 inline-flex rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700">
        {lang === 'zh' ? '开始免费生成' : 'Start creating for free'}
      </Link>
    </div>
  );
}
