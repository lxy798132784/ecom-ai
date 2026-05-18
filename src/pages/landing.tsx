import Head from 'next/head';
import Link from 'next/link';

export default function Landing() {
  return (
    <>
      <Head><title>EcomPic AI - 跨境电商 AI 美工 | 5分钟出专业产品图</title></Head>
      <main className="min-h-screen bg-white">
        {/* Hero */}
        <section className="bg-gradient-to-br from-slate-900 via-brand-700 to-slate-800 text-white py-24 px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            5 分钟出专业产品图
          </h1>
          <p className="text-xl text-blue-100 mb-2">不用等设计师，不用租影棚</p>
          <p className="text-lg text-blue-200/80 mb-8">上传产品图 → AI 自动出图 → 直接上架</p>
          <div className="flex justify-center gap-4">
            <Link href="/" className="bg-white text-brand-700 px-8 py-3 rounded-xl font-bold text-lg hover:bg-blue-50 transition shadow-lg">🪄 免费试用</Link>
            <a href="#pricing" className="border-2 border-white/30 text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-white/10 transition">查看定价</a>
          </div>
          <p className="text-blue-200/60 text-sm mt-4">免费 5 次 · 无需信用卡</p>
        </section>

        {/* Before / After */}
        <section className="max-w-6xl mx-auto px-4 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">AI 帮你做图，效果看得见</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: '一键白底图', desc: '杂乱背景 → 纯白底，亚马逊主图标准', icon: '🪄' },
              { title: '场景图生成', desc: '产品放进厨房/客厅/户外，买家更想买', icon: '🏠' },
              { title: '自由编辑', desc: '换颜色、加效果、改风格，一句话搞定', icon: '✏️' },
            ].map((f, i) => (
              <div key={i} className="text-center p-8 bg-slate-50 rounded-2xl hover:shadow-lg transition">
                <p className="text-4xl mb-4">{f.icon}</p>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="bg-slate-50 py-20">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">为什么卖家选 EcomPic</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { t: '⚡ 秒级出图', d: '拖拽上传，AI 5-15 秒生成，比等设计师快 100 倍' },
                { t: '💰 省 90% 成本', d: '美工一张图 $10，AI 只要 $0.04，月付 $19 无限用' },
                { t: '🌐 中英双语', d: '自动生成英文 Listing 文案，出海无障碍' },
                { t: '🔄 场景百变', d: '8 种场景一键切换，厨房/客厅/办公桌/户外' },
                { t: '📐 多平台适配', d: 'Amazon / eBay / Shopify / Temu 尺寸自动裁' },
                { t: '☁️ 云端保存', d: '历史图片自动存云，换设备也能找回来' },
              ].map((f, i) => (
                <div key={i} className="bg-white p-6 rounded-xl shadow-sm">
                  <h3 className="font-bold mb-1">{f.t}</h3>
                  <p className="text-slate-500 text-sm">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="max-w-6xl mx-auto px-4 py-20">
          <h2 className="text-3xl font-bold text-center mb-4">简单透明的定价</h2>
          <p className="text-slate-500 text-center mb-12">先免费试用，满意再升级</p>
          <div className="grid md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { name: '免费', price: '$0', desc: '5 次/月', features: ['5 次生成', '全部功能', '云端历史'], cta: '免费开始', href: '/', primary: false },
              { name: '5 次包', price: '$2', desc: '一次性', features: ['5 次生成', '永远有效', '即买即用'], cta: '购买', href: '#', primary: false },
              { name: '20 次包 🔥', price: '$5', desc: '一次性', features: ['20 次生成', '省 30%', '热卖推荐'], cta: '购买', href: '#', primary: true },
              { name: 'PRO', price: '$19', desc: '/月', features: ['500 次/月', '全部功能', '优先支持', '未来新功能'], cta: '升级 PRO', href: '#', primary: false },
            ].map((p, i) => (
              <div key={i} className={`rounded-2xl p-6 text-center ${p.primary ? 'bg-brand-600 text-white ring-4 ring-brand-200 scale-105' : 'bg-white border border-slate-200'}`}>
                <h3 className={`font-bold text-lg mb-1 ${p.primary ? 'text-white' : 'text-slate-800'}`}>{p.name}</h3>
                <p className="text-3xl font-bold mb-1">{p.price}<span className="text-sm font-normal opacity-70">{p.desc}</span></p>
                <ul className={`text-sm space-y-1 mb-6 ${p.primary ? 'text-blue-100' : 'text-slate-500'}`}>
                  {p.features.map((f, j) => <li key={j}>✅ {f}</li>)}
                </ul>
                <Link href={p.href} className={`block py-2.5 rounded-xl font-medium text-sm transition ${p.primary ? 'bg-white text-brand-600 hover:bg-blue-50' : 'bg-slate-800 text-white hover:bg-slate-900'}`}>{p.cta}</Link>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-slate-50 py-20">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">常见问题</h2>
            <div className="space-y-4">
              {[
                { q: '生成的图片可以商用吗？', a: '可以。AI 生成的图片版权归你所有，直接用于亚马逊/eBay/Shopify 等平台。' },
                { q: '支持什么格式的图片？', a: '支持 PNG / JPG / WebP 格式，上传自动压缩优化。' },
                { q: '生成一张图要多久？', a: '通常 5-15 秒。取决于图片复杂度和 AI 处理队列。' },
                { q: '可以退款吗？', a: 'PRO 月付随时取消，未使用天数按比例退。一次性套餐购买后不退。' },
                { q: '中文提示词能用吗？', a: '可以，中英文都支持。英文提示词通常效果更精准。' },
              ].map((faq, i) => (
                <details key={i} className="bg-white rounded-xl p-5 shadow-sm group">
                  <summary className="font-bold cursor-pointer">{faq.q}</summary>
                  <p className="text-slate-500 text-sm mt-3">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 text-center bg-gradient-to-br from-brand-600 to-brand-700 text-white px-4">
          <h2 className="text-3xl font-bold mb-4">准备好让你的产品图脱颖而出？</h2>
          <p className="text-lg text-blue-100 mb-8">免费试用 5 次，不用绑定信用卡</p>
          <Link href="/" className="bg-white text-brand-700 px-10 py-4 rounded-xl font-bold text-xl hover:bg-blue-50 transition shadow-lg inline-block">🪄 开始免费试用</Link>
        </section>

        <footer className="text-center py-8 text-slate-400 text-sm">
          © 2026 EcomPic AI · 跨境电商 AI 美工
        </footer>
      </main>
    </>
  );
}
