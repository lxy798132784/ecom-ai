import Head from 'next/head';
import Link from 'next/link';

type BlogVisualProps = { title: string; category?: string; slug?: string; size?: 'card' | 'hero' | 'inline' };

function hashHue(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) % 360;
  return h;
}

export function BlogVisual({ title, category = 'Guide', slug = '', size = 'hero' }: BlogVisualProps) {
  const hue = hashHue(slug || title);
  const height = size === 'card' ? 'h-44' : size === 'inline' ? 'h-56' : 'h-72';
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${height}`} role="img" aria-label={`${title} illustration`}>
      <svg viewBox="0 0 1200 520" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`g-${hue}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor={`hsl(${hue}, 80%, 58%)`} />
            <stop offset="0.55" stopColor={`hsl(${(hue + 55) % 360}, 80%, 48%)`} />
            <stop offset="1" stopColor={`hsl(${(hue + 210) % 360}, 75%, 40%)`} />
          </linearGradient>
          <radialGradient id={`r-${hue}`} cx="70%" cy="25%" r="65%">
            <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>
        <rect width="1200" height="520" fill={`url(#g-${hue})`} />
        <rect width="1200" height="520" fill={`url(#r-${hue})`} />
        <circle cx="1020" cy="90" r="180" fill="rgba(255,255,255,0.18)" />
        <circle cx="150" cy="455" r="230" fill="rgba(15,23,42,0.18)" />
        <g transform="translate(710 145)">
          <rect x="0" y="0" width="285" height="245" rx="26" fill="rgba(255,255,255,0.92)" />
          <rect x="32" y="34" width="221" height="116" rx="18" fill="rgba(226,232,240,0.95)" />
          <circle cx="80" cy="92" r="32" fill={`hsl(${(hue + 30) % 360}, 75%, 58%)`} />
          <path d="M118 140 L170 78 L246 150 Z" fill={`hsl(${(hue + 130) % 360}, 70%, 48%)`} opacity="0.78" />
          <rect x="32" y="174" width="130" height="16" rx="8" fill="rgba(100,116,139,0.35)" />
          <rect x="32" y="202" width="200" height="12" rx="6" fill="rgba(100,116,139,0.22)" />
        </g>
        <g transform="translate(120 120)" fill="rgba(255,255,255,0.88)">
          <rect x="0" y="0" width="96" height="96" rx="22" opacity="0.95" />
          <path d="M28 60 L45 37 L57 51 L66 39 L78 60 Z" fill={`hsl(${hue}, 78%, 50%)`} />
          <circle cx="35" cy="32" r="8" fill={`hsl(${(hue + 45) % 360}, 78%, 55%)`} />
        </g>
        <g transform="translate(120 255)" fill="rgba(255,255,255,0.22)">
          <rect width="440" height="22" rx="11" />
          <rect y="45" width="340" height="18" rx="9" />
          <rect y="83" width="390" height="18" rx="9" />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent p-6 text-white">
        <span className="mb-2 inline-flex w-fit rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">{category}</span>
        <p className={`${size === 'card' ? 'text-lg' : 'text-2xl md:text-3xl'} max-w-2xl font-bold leading-tight drop-shadow`}>{title}</p>
      </div>
    </div>
  );
}

export function BlogCta({ lang = 'zh' }: { lang?: 'zh' | 'en' }) {
  return (
    <div className="my-10 rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 to-blue-50 p-6 text-center">
      <p className="text-3xl mb-2">🪄</p>
      <h3 className="text-xl font-bold text-slate-800">{lang === 'zh' ? '把文章里的方法直接用到你的产品图' : 'Turn these tips into product images now'}</h3>
      <p className="mt-2 text-sm text-slate-600">{lang === 'zh' ? '上传一张基础产品图，选择白底、场景、质量和分辨率，马上生成可用于电商的图片。' : 'Upload one product photo, choose background, scene, quality, and resolution, then generate ecommerce-ready images.'}</p>
      <Link href="/" className="mt-4 inline-flex rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700">
        {lang === 'zh' ? '开始免费生成' : 'Start generating'}
      </Link>
    </div>
  );
}
