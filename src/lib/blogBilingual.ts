export type BlogLang = 'zh' | 'en';

export const BLOG_ZH: Record<string, { title: string; category: string; description: string; content: string }> = {
  'product-photos-without-studio': {
    title: '不用影棚也能拍出专业产品图：2026 完整指南',
    category: '产品摄影',
    description: '教跨境卖家用手机基础图 + AI 快速生成白底图、场景图和平台尺寸图，降低拍摄成本。',
    content: `# 不用影棚也能拍出专业产品图

你不一定需要昂贵相机、专业灯光和独立影棚。对大多数电商卖家来说，真正重要的是：产品主体清楚、背景干净、尺寸符合平台要求，并且图片能帮助买家理解使用场景。

## 传统方式 vs AI 工作流

传统拍摄通常要租场地、找摄影师、等待修图，还要反复沟通。AI 工作流更适合中小卖家：先用手机拍一张清晰的基础产品图，再用 AI 生成白底图、生活场景图和不同平台尺寸。

## 第一步：拍一张可用的基础图

把产品放在干净桌面或纯色背景前，尽量靠近窗户使用自然光。手机保持稳定，多拍几个角度。基础图不需要完美，但产品边缘、形状和主要细节要清楚。

## 第二步：用 AI 生成电商图片

上传基础图后，可以一键生成亚马逊主图常用的白底图，也可以把产品放进厨房、客厅、办公室、户外等场景。需要换颜色、加效果或改变风格时，直接用一句话描述即可。

## 第三步：导出平台尺寸

Amazon、eBay、Shopify、Temu 等平台对图片尺寸和比例要求不同。用 AI 工具生成后，再按平台导出尺寸，可以减少重复修图时间。

## 成本差异

摄影师拍摄适合高预算品牌大片，但如果你有大量 SKU，AI 更适合日常上新、测试图和场景图迭代。它不能替代所有商业摄影，但能显著降低基础产品图制作成本。

## 开始使用

先用免费积分测试几张图，确认产品识别、白底效果和场景效果符合预期，再决定是否升级。`
  },
  'amazon-product-photography-requirements': {
    title: '亚马逊产品图片要求：卖家完整指南',
    category: '亚马逊运营',
    description: '整理亚马逊主图、辅图、尺寸、背景、禁止元素和实操检查清单。',
    content: `# 亚马逊产品图片要求

亚马逊图片直接影响点击率、转化率和合规风险。主图要遵守平台规则，辅图则负责展示卖点、尺寸、细节和使用场景。

## 主图核心规则

主图通常需要纯白背景，产品占画面主体，不要添加水印、边框、文字、徽章或夸张装饰。产品本身要清晰完整，不能让买家误解包装内容。

## 尺寸和清晰度

建议至少使用 1000×1000 像素以上图片，以便开启缩放功能。更高分辨率可以保留更多细节，但要避免过度压缩导致模糊。

## 辅图怎么做

辅图可以展示细节、使用场景、尺寸对比、安装步骤、包装内容和核心卖点。好的辅图不是简单堆文字，而是让买家快速理解“这件商品是否适合我”。

## AI 如何帮忙

AI 可以快速生成白底图、场景图和不同风格的辅图草案。最终上架前仍要检查是否夸大功能、是否出现错误文字、是否违反平台规则。

## 上架前检查

检查背景、尺寸、产品完整性、是否有多余文字、是否与实际商品一致。主图求合规，辅图求转化。`
  },
  'ai-product-photography-guide': {
    title: 'AI 产品摄影完整指南：电商卖家如何高效出图',
    category: 'AI 工具',
    description: '解释 AI 产品摄影的适用场景、流程、优缺点和电商落地方式。',
    content: `# AI 产品摄影完整指南

AI 产品摄影不是简单“生成漂亮图片”，而是把产品主体、背景、灯光、场景和平台尺寸组合成可销售的电商素材。

## 适合哪些卖家

它适合跨境电商、独立站、亚马逊、Etsy、Shopify 和社媒卖家，尤其适合 SKU 多、上新快、预算有限或需要大量场景图测试的团队。

## 基本流程

先上传清晰产品图，再选择白底、场景、自由编辑或文字生图。然后根据平台选择分辨率和质量，最后下载用于商品页、广告或社交媒体。

## 优点

速度快、成本低、可批量生成，并且方便测试不同风格。对新产品、季节活动和广告素材尤其有价值。

## 限制

AI 可能误改产品细节、生成不准确文字或出现不真实结构。重要商品图需要人工检查，不能盲目发布。

## 最佳实践

用真实产品图作为基础，提示词写清楚场景、光线、角度和用途。主图保持简洁合规，辅图和广告图再追求氛围。`
  },
  'best-ai-image-generators-ecommerce': {
    title: '2026 年电商 AI 图片生成器对比',
    category: 'AI 工具',
    description: '从电商实用角度比较 AI 图片工具：白底、场景、批量、尺寸和成本。',
    content: `# 电商 AI 图片生成器怎么选

电商卖家选择 AI 图片工具，不应该只看“画得漂不漂亮”，而要看它能不能稳定产出可上架、可投放、可复用的产品图片。

## 核心评估维度

第一是产品一致性，不能把商品结构改错。第二是白底和背景处理能力。第三是场景图质量。第四是尺寸导出、批量处理和历史管理。最后是价格是否适合长期使用。

## 通用生图工具 vs 电商专用工具

通用工具适合创意探索，但经常需要很多提示词调试。电商专用工具更应该围绕白底图、平台尺寸、商品主体保护和运营效率设计。

## 成本怎么看

如果按积分计费，低质量小图成本低，高质量大图成本高，更符合真实成本。卖家可以先用低成本规格测试方向，再用高规格导出最终图。

## 建议

不要只追求最高画质。对日常上新，稳定、快速、可控比单张惊艳更重要。`
  },
  'product-photography-budget': {
    title: '低预算电商产品摄影：从 0 美元到专业效果',
    category: '产品摄影',
    description: '介绍低预算卖家如何用手机、自然光和 AI 工具制作可用产品图。',
    content: `# 低预算电商产品摄影

预算有限不代表图片质量一定差。只要保证产品清楚、光线干净、背景不干扰，再配合 AI 后期，就能做出足够专业的电商图片。

## 0 成本方案

用手机、窗边自然光、白纸或干净桌面拍摄。避免强阴影和杂乱背景，多拍几张备用。

## 小预算升级

可以购买小三脚架、补光灯、白色背景纸和反光板。这些工具成本低，但能明显提升基础图质量。

## AI 后期

用 AI 去背景、换白底、生成场景图和统一风格。这样可以把简单照片转化为更适合上架的图片。

## 钱花在哪里最值

优先保证产品主体真实清晰，其次是平台尺寸和主图合规，最后再优化风格和氛围。`
  },
  'ai-background-removal-ecommerce': {
    title: '电商 AI 去背景如何工作：2026 指南',
    category: 'AI 工具',
    description: '解释 AI 去背景在白底图、主图制作和批量处理中的作用与注意事项。',
    content: `# 电商 AI 去背景如何工作

AI 去背景会识别产品主体和背景边界，把不需要的环境移除，再替换成纯白、透明或新的场景背景。

## 为什么重要

白底图是很多平台主图的基础要求。干净背景能减少干扰，让买家注意力集中在产品本身。

## 常见难点

透明材质、反光金属、毛绒边缘、复杂阴影和细小配件都可能影响识别。处理后要检查边缘是否被削掉或背景是否残留。

## AI 的优势

AI 可以批量处理图片，比手动抠图更快，也更适合中小卖家高频上新。

## 使用建议

基础图尽量背景简单、产品完整、光线均匀。AI 结果出来后，再检查边缘、阴影和颜色是否自然。`
  },
  'shopify-product-photography-ai': {
    title: 'Shopify 产品摄影指南：2026 AI 实用技巧',
    category: '平台指南',
    description: '面向 Shopify 独立站卖家的产品图、场景图、广告图和品牌一致性建议。',
    content: `# Shopify 产品摄影指南

Shopify 独立站图片不只要展示产品，还要体现品牌风格。相比平台型电商，独立站更需要统一视觉和故事感。

## 商品页图片

主图要清晰展示产品，辅图展示细节、尺寸、包装和使用方式。图片风格要和网站整体设计一致。

## 场景图

场景图能帮助买家想象使用产品的情境。家居、服饰、美妆、食品等品类尤其适合用生活化图片提升转化。

## AI 的作用

AI 可以快速生成不同背景、光线和场景，用于测试首页 Banner、商品页和广告素材。

## 注意事项

不要让 AI 改变商品真实结构和颜色。品牌调性要统一，不能每张图都像来自不同店铺。`
  },
  'ai-vs-traditional-product-photography-cost': {
    title: 'AI 与传统产品摄影成本对比：2026 版',
    category: '成本与 ROI',
    description: '比较传统拍摄和 AI 出图在成本、速度、质量控制和适用场景上的差异。',
    content: `# AI 与传统产品摄影成本对比

传统摄影和 AI 出图不是绝对替代关系。传统摄影适合高预算品牌大片，AI 更适合日常上新、批量 SKU 和快速测试。

## 成本结构

传统摄影包含摄影师、场地、道具、物流、修图和沟通成本。AI 主要消耗平台积分和少量人工审核时间。

## 时间差异

传统拍摄可能需要数天到数周，AI 通常几秒到几十秒即可出图，适合快速迭代。

## 质量差异

传统摄影真实性更强，AI 的灵活性更高。对需要严格还原材质和尺寸的商品，仍要谨慎审核。

## 最佳组合

核心品牌图可以用传统拍摄，日常辅图、场景图、广告测试图可以用 AI。`
  },
  'amazon-product-photography-requirements-2026': {
    title: '亚马逊产品摄影要求：2026 完整指南',
    category: '平台指南',
    description: '更新版亚马逊产品图合规与转化建议，覆盖主图、辅图、尺寸和检查清单。',
    content: `# 亚马逊产品摄影要求 2026

亚马逊产品图既要合规，也要帮助转化。主图负责让商品通过平台规则并获得点击，辅图负责解释卖点和减少疑虑。

## 主图重点

纯白背景、产品清晰、无水印、无多余文字、无不相关道具，是主图的基本原则。

## 辅图重点

展示尺寸、材质、功能、安装、包装和使用场景。辅图可以更有设计感，但要避免夸大和误导。

## AI 工作流

AI 可以快速产出白底图和场景图，但上架前要人工检查产品细节、文字和合规性。

## 检查清单

确认图片清晰、尺寸足够、主体完整、颜色真实、没有违规元素，并且与实际发货商品一致。`
  },
  'best-ai-image-generators-ecommerce-2026': {
    title: '2026 年最佳电商 AI 图片生成器：对比指南',
    category: 'AI 工具',
    description: '面向电商场景比较 AI 图片生成器的产品一致性、批量能力、成本和工作流。',
    content: `# 2026 年最佳电商 AI 图片生成器

电商 AI 图片工具要解决的是运营问题：更快上新、更低成本、更稳定的商品图片，而不是单纯生成艺术图。

## 选择标准

看产品主体是否稳定、背景是否干净、是否支持场景图、是否支持批量、是否能导出平台尺寸、价格是否可控。

## 积分计费更合理

不同质量和分辨率消耗不同成本。积分体系比“按张数”更公平，也方便卖家控制预算。

## 实操建议

先用低规格测试风格，再用高规格输出最终图。保留历史图和收藏图，方便复用成功风格。`
  },
  'etsy-product-photography-ai-guide': {
    title: 'Etsy 产品摄影技巧：手工卖家的 AI 指南',
    category: '平台指南',
    description: '帮助 Etsy 手工卖家用 AI 提升图片氛围、细节展示和品牌一致性。',
    content: `# Etsy 产品摄影技巧

Etsy 买家重视手工感、材质、细节和故事。图片不仅要清楚，还要传达“独特”和“可信”。

## 展示真实细节

手工商品要突出纹理、尺寸、使用方式和制作感。不要让 AI 抹掉手工细节。

## 场景氛围

温暖自然光、木质桌面、生活化背景通常更适合 Etsy。场景要衬托商品，而不是抢走注意力。

## AI 的使用方式

用 AI 生成辅助场景图、节日图和社媒图。主图仍要保持商品真实准确。

## 建议

把 AI 当作摄影助理，而不是完全替代真实商品展示。`
  },
  'ecommerce-image-seo-guide': {
    title: '电商图片 SEO：如何让产品图在 Google Images 获得曝光',
    category: 'SEO 与流量',
    description: '讲解文件名、alt 文本、结构化数据、速度和图片质量对搜索曝光的影响。',
    content: `# 电商图片 SEO

产品图片不仅影响转化，也可能带来自然搜索流量。Google Images、Pinterest 和社媒分享都会受图片质量和元信息影响。

## 文件名和 Alt 文本

使用描述性文件名和准确 alt 文本，包含产品类型、颜色、材质或用途，但不要堆砌关键词。

## 图片速度

图片太大会拖慢页面。需要在清晰度和加载速度之间平衡，使用合适格式和压缩。

## 内容相关性

图片应和页面标题、产品描述、结构化数据一致。搜索引擎更容易理解图片内容。

## AI 图片注意事项

AI 图要准确反映实际商品，避免生成不存在的功能或错误外观。`
  },
  'social-media-product-images-convert': {
    title: '能转化的社媒产品图：Instagram、Pinterest 与 TikTok 指南',
    category: '营销',
    description: '介绍社媒产品图片如何在不同平台吸引注意力并推动购买。',
    content: `# 能转化的社媒产品图

社媒图片和商品页图片目标不同。商品页强调清楚和可信，社媒图片首先要吸引注意力。

## Instagram

适合统一风格、生活化场景和品牌调性。图片要美观，但产品不能被背景淹没。

## Pinterest

更适合垂直构图、教程感、灵感图和场景搭配。标题和视觉层次很重要。

## TikTok 封面

要简洁、有冲击力，能让用户一眼知道产品和卖点。

## AI 的价值

快速生成多种场景和构图，用于广告测试和内容排期。`
  },
  'reduce-ecommerce-returns-product-images': {
    title: '如何用更好的产品图降低电商退货率',
    category: '转化与退货',
    description: '解释图片如何减少尺寸、材质、颜色和使用预期不一致导致的退货。',
    content: `# 用产品图降低退货率

很多退货来自预期不一致：尺寸误解、颜色偏差、材质不清楚、使用场景想错。更好的图片可以提前解决这些问题。

## 展示尺寸

加入尺寸对比、手持图或使用环境，帮助买家判断真实大小。

## 展示材质和细节

近景图能减少买家对质感的误解。布料、金属、玻璃、食品等品类尤其重要。

## 展示使用方式

场景图能告诉买家产品适合在哪里、如何使用、和什么搭配。

## AI 注意事项

不要让 AI 美化到和实物不一致。降低退货的关键是真实而清楚。`
  },
  'food-photography-restaurants-delivery-ai': {
    title: '餐厅和外卖食品摄影：AI 实用指南',
    category: '行业指南',
    description: '面向餐厅、外卖和食品电商，说明如何用 AI 提升菜单图和营销图。',
    content: `# 餐厅和外卖食品摄影

食品图片直接影响下单欲望。好的食品图要看起来新鲜、真实、有食欲，同时不能和实际出餐差距太大。

## 基础拍摄

使用自然光或柔光，避免油腻反光。构图要突出主菜，背景保持干净。

## AI 场景增强

AI 可以优化背景、桌面、餐具和光线，让普通菜单图更适合宣传。

## 外卖平台注意事项

图片要真实反映份量、配料和包装，避免过度美化造成差评。

## 营销图

节日套餐、新品海报和社媒图可以用 AI 快速生成多个版本。`
  },
  'seasonal-product-photography-strategy': {
    title: '季节性产品摄影策略：不重拍也能刷新图片',
    category: '营销',
    description: '讲解如何用 AI 快速制作节日、季节和活动主题产品图。',
    content: `# 季节性产品摄影策略

电商活动和节日很多，如果每次都重新拍摄，成本和时间都很高。AI 可以在保留产品主体的基础上快速刷新背景和氛围。

## 适用场景

圣诞、黑五、情人节、返校季、夏季促销和新品活动，都适合做季节性图片。

## 保持产品一致

节日元素应该服务产品，而不是遮挡产品。主体颜色、形状和关键细节要保持真实。

## 批量测试

可以生成多种背景、配色和构图，用广告数据筛选最有效版本。

## 建议

提前准备季节素材，不要等活动开始才临时出图。`
  }
};

const SEO_EXPANSIONS_ZH: Record<string, string> = {
  'product-photos-without-studio': `
## 可执行拍摄清单

- 主体完整：不要裁掉边缘、配件或包装重点。
- 光线均匀：避免强烈阴影压住产品细节。
- 背景简单：AI 更容易识别产品轮廓。
- 多角度备份：正面、45 度、细节和包装各拍一张。

## 推荐 AI 提示词模板

“保持产品主体不变，生成干净专业的电商产品图，柔和自然光，背景简洁，适合 Amazon/Shopify 商品页。”

## 常见错误

很多卖家直接上传昏暗、模糊或被遮挡的照片，然后期待 AI 完全修好。更好的做法是先保证基础图清楚，再让 AI 负责背景、光线和场景。

## 发布前检查

确认颜色、结构、尺寸比例和包装内容与真实商品一致。AI 图越漂亮，越要检查是否过度美化。`,
  'amazon-product-photography-requirements': `
## 主图与辅图的分工

主图负责合规和点击，辅图负责解释卖点。主图不要堆卖点文字，辅图可以展示尺寸、细节、安装方式和生活场景。

## 图片组建议

一套完整 Listing 可以包含：白底主图、尺寸图、细节图、材质图、使用场景图、包装内容图和对比图。这样能减少买家疑问，提高转化。

## AI 出图审核重点

审核是否出现不存在的配件、错误 Logo、变形结构、错误文字和夸大功能。亚马逊图片不是越炫越好，而是越清楚、越可信越好。

## SEO 提示

图片文件名和 alt 文本可以包含产品类型、颜色、材质和核心用途，但不要关键词堆砌。`,
  'ai-product-photography-guide': `
## 推荐工作流

1. 上传真实产品图，优先选择边缘清楚的照片。
2. 用低规格测试背景和构图，降低试错成本。
3. 确定方向后，用高质量和目标分辨率导出。
4. 收藏表现好的图片风格，作为后续 SKU 模板。

## 适合 AI 的图片类型

白底主图、生活场景图、广告素材、节日海报、社媒封面和 A/B 测试图都适合 AI 快速生成。

## 不适合完全交给 AI 的场景

需要精确展示尺寸、认证标签、成分表、说明文字或医学/安全功能的图片，必须人工核对。

## 运营建议

把 AI 图片当成增长工具：先大量低成本测试，再把表现好的方向升级为高质量素材。`,
  'best-ai-image-generators-ecommerce-2026': `
## 评分表怎么做

可以按 1-5 分评估：产品一致性、白底质量、场景真实感、批量效率、分辨率支持、价格透明度、历史/收藏管理和团队协作。

## 为什么电商工具要有积分体系

1024 小图和 4K 高质量图成本不同。积分倍率能让卖家自己选择成本和效果，不会用一刀切的“张数”误导用户。

## 购买前测试

用同一个产品图测试 3-5 个工具，观察是否改错商品结构、是否能稳定去背景、是否能生成符合品牌调性的场景。`,
  'product-photography-budget': `
## 预算优先级

第一优先级是清晰基础图；第二是稳定光线；第三是平台合规尺寸；第四才是高级道具和复杂场景。

## 低成本器材建议

手机、窗边自然光、白色卡纸、小三脚架和简单补光灯足够完成大多数基础拍摄。

## 用 AI 节省的部分

AI 可以减少抠图、换背景、尺寸导出和场景搭建成本，但不能替代真实产品信息审核。

## 什么时候该找摄影师

品牌主视觉、复杂材质、模特穿戴和高客单价产品，仍然值得投入专业摄影。`,
  'ai-background-removal-ecommerce': `
## 去背景前怎么拍

产品和背景颜色尽量拉开，避免透明玻璃贴近白色背景，毛绒和细线产品要多拍几张。

## 去背景后怎么检查

放大检查边缘、阴影、透明区域和反光部分。如果边缘被削掉，重新换一张基础图通常比反复修更快。

## 白底图不是唯一选择

主图用白底，辅图可以用生活场景、渐变背景或品牌色背景。不同图片承担不同转化任务。

## 批量处理建议

同一批 SKU 使用一致光线和角度，AI 后期更容易统一风格。`,
  'shopify-product-photography-ai': `
## 独立站图片结构

首页需要品牌氛围图，商品页需要主图、细节图和场景图，购物车和推荐模块需要清晰缩略图。

## 品牌一致性

统一背景色、光线、阴影和构图，比单张图片好看更重要。买家进入网站后应该感觉所有图片来自同一个品牌。

## AI 用在广告测试

可以快速生成不同背景、角度和文案风格，用于 Facebook、Instagram 和 TikTok 广告 A/B 测试。

## 注意真实感

Shopify 是品牌自有阵地，过度 AI 感会伤害信任。图片要高级，但不能虚假。`,
  'ai-vs-traditional-product-photography-cost': `
## 成本对比要看全流程

传统拍摄不只是摄影费，还包含物流、沟通、修图、延期和重拍成本。AI 成本则主要来自积分、人工审核和少量基础拍摄。

## 速度带来的价值

新品测试和广告素材最怕慢。AI 可以让运营当天完成多个版本，快速进入数据验证。

## 混合策略

主品牌图用传统摄影保证质感，日常 SKU、活动图和广告测试用 AI 扩展产能。

## ROI 计算方式

不要只算单张图片成本，还要看转化率、退货率、上新速度和广告测试周期。`,
  'amazon-product-photography-requirements-2026': `
## 2026 卖家图片策略

合规只是底线，真正拉开差距的是辅图结构：尺寸、材质、场景、卖点和风险消除。

## 常见违规风险

主图出现文字、边框、道具、促销徽章、过度合成或与实物不符，都可能带来下架风险。

## AI 生成图怎么用于亚马逊

优先用于白底清理、场景辅图和广告图。含文字、Logo、证书和参数的图建议人工制作或严格复核。

## 上传前清单

检查主图白底、产品占比、尺寸、清晰度、颜色、包装内容和辅图逻辑顺序。`,
  'etsy-product-photography-ai-guide': `
## Etsy 图片要有“人味”

手工商品不能拍得像无菌工厂图。自然光、纹理、手作细节和生活氛围更容易建立信任。

## AI 的正确用法

让 AI 帮你换背景、补充节日氛围、做社媒图，而不是抹掉手工痕迹。

## 买家最关心什么

尺寸、材质、颜色、使用方式、包装和送礼效果。图片应该主动回答这些问题。

## 避免过度美化

如果 AI 图和实物差距太大，短期可能提高点击，长期会增加差评和退货。`,
  'ecommerce-image-seo-guide': `
## 图片 SEO 检查清单

- 文件名描述产品，不用随机数字。
- alt 文本说明图片内容，不堆砌关键词。
- 图片尺寸合适，避免拖慢页面。
- 商品页标题、描述和图片语义一致。

## Alt 文本模板

“[颜色/材质] [产品类型] 在 [使用场景] 中的产品图片”。例如：“黑色皮革手提包在办公桌上的产品图片”。

## 速度与清晰度平衡

高分辨率适合缩放和细节展示，但页面加载速度同样影响 SEO。最终要压缩到合理体积。

## AI 图片风险

搜索引擎和买家都需要真实信息。AI 生成图不能展示商品不存在的功能或配件。`,
  'social-media-product-images-convert': `
## 社媒图片和商品页图片不同

商品页强调信息完整，社媒强调第一眼吸引。社媒图可以更有情绪、更强构图，但仍要让产品清楚。

## 平台差异

Instagram 重视觉统一，Pinterest 重灵感和垂直构图，TikTok 封面重冲击力和卖点识别。

## AI 测试方法

同一产品生成 5-10 个背景和构图，用广告或自然互动数据筛选，不要只凭主观审美决定。

## 转化关键

图片要回答“这是什么、适合谁、为什么现在要买”。`,
  'reduce-ecommerce-returns-product-images': `
## 退货通常来自预期落差

买家以为尺寸更大、颜色更亮、材质更厚、配件更多，收到货后就容易退货。图片要提前消除误解。

## 必备图片

尺寸对比图、材质近景图、使用场景图、包装内容图和限制说明图，都能降低误判。

## AI 使用边界

AI 可以让图片更清楚，但不能把商品变得比实物更高级。降低退货的核心是真实和透明。

## 数据反馈

观察退货原因，把高频误解点补进图片组。`,
  'food-photography-restaurants-delivery-ai': `
## 食品图的核心

食品要看起来新鲜、有食欲，但不能和实际出餐差距过大。真实感比过度精修更重要。

## 拍摄建议

柔光、干净桌面、主菜突出、配料清楚。避免油光、脏背景和过度复杂道具。

## AI 可以做什么

改善背景、补充餐桌氛围、制作节日菜单图、生成社媒宣传图。

## 外卖平台风险

如果图片份量、配料和包装与实际不一致，会直接影响评分和复购。`,
  'seasonal-product-photography-strategy': `
## 季节图为什么重要

节日和活动期间，用户更容易被符合氛围的图片吸引。季节图能提升广告点击和页面新鲜感。

## 不重拍的做法

保留产品主体，替换背景、道具、色彩和光线。AI 适合快速生成多个节日版本。

## 计划节奏

提前 2-4 周准备素材，先测试广告图，再把表现好的视觉用于商品页和首页。

## 一致性原则

节日元素不能遮挡产品，也不能改变产品颜色和结构。`
};

const PERSUASIVE_ZH = `
## 为什么买家会被一张图说服

买家点进商品页时，脑子里其实只有三个问题：这个东西是不是我想要的？质量看起来靠谱吗？买了以后会不会后悔？产品图片要做的不是“装饰页面”，而是在几秒钟内回答这些问题。文字描述可以慢慢解释，但第一眼建立信任的通常是图片。

很多卖家以为图片只是展示产品，真正优秀的电商图片会制造一种心理画面：买家已经把产品放进自己的厨房、办公室、包里、客厅或礼物盒里。只要这个画面足够清楚，购买欲望就会被提前点燃。

## 一张高转化产品图要制造的 4 个感觉

1. **安全感**：图片清楚、边缘干净、颜色真实，买家不会担心收到货和页面不一样。
2. **拥有感**：场景图让买家想象“我买了以后怎么用”。
3. **价值感**：光线、构图和背景让产品看起来更专业、更值得这个价格。
4. **紧迫感**：节日、活动、礼物、上新和限时场景会让用户更愿意现在下单。

如果图片只能说明“这是一个产品”，它只是合格；如果图片能让用户产生“我需要它”的感觉，它才真正有转化力。

## 用 AI 做图，不是为了省一张摄影费

真正的价值是让卖家可以快速测试视觉方向。传统拍摄一次只能得到有限版本，而 AI 可以在同一天测试白底、浅色场景、深色高级感场景、节日场景、社媒广告构图和不同分辨率。你不需要一开始就猜哪个最好，而是用更低成本把多个方向都试出来。

一个更实用的流程是：先用低积分规格生成 5-10 个方向，挑出最有购买欲的 2 个，再用高质量和目标分辨率输出最终图。这样既省钱，也更接近真实运营。

## 可以直接复制的提示词

**白底主图：** 保持产品主体完全不变，生成干净专业的电商白底图，柔和阴影，产品居中，适合 Amazon 和 Shopify 主图，不添加文字和多余道具。

**生活场景图：** 保持产品外观、颜色和结构不变，把产品放在真实自然的使用场景中，光线柔和，背景高级但不抢主体，让买家能想象自己正在使用它。

**社媒广告图：** 保持产品清晰可见，生成更有视觉冲击力的社媒广告构图，背景有氛围，突出产品价值感，适合 Instagram、Pinterest 或 TikTok 封面。

## 发布前最后检查

在下载和发布前，把图片放大看 30 秒：产品有没有变形？颜色是否真实？有没有多出不存在的配件？文字、Logo 或包装是否错误？如果这张图会让买家误解，那它再漂亮也不应该直接上线。

好的 AI 产品图不是“骗买家”，而是更清楚、更有吸引力地展示真实商品。做到这一点，图片才会同时提升点击、转化和信任。`;

const PERSUASIVE_EN = `
## Why a product image creates desire before the copy does

When a shopper lands on a product page, they are not calmly reading every word. They are asking fast, emotional questions: Is this what I need? Does it look trustworthy? Can I imagine owning it? Will I regret buying it? A strong product image answers those questions before the description has a chance to work.

The goal is not simply to show the product. The goal is to help the shopper picture the product in their own kitchen, desk, wardrobe, bathroom, gift box, or daily routine. Once that mental picture forms, the product becomes easier to want.

## The four feelings a high-converting product image should create

1. **Trust**: clean edges, honest color, sharp details, and no confusing visual clutter.
2. **Ownership**: lifestyle context that makes the shopper think, “I can see myself using this.”
3. **Value**: lighting, composition, and background that make the product feel worth the price.
4. **Urgency**: seasonal, gifting, launch, or campaign visuals that make the product feel relevant now.

If an image only says “this is the item,” it is functional. If it makes the shopper think “I want this in my life,” it becomes a conversion asset.

## AI is not just a cheaper photoshoot

The real advantage is faster creative testing. A traditional shoot gives you a limited set of images. An AI workflow lets you test a white background, premium lifestyle scene, social ad layout, holiday version, and multiple resolutions in the same session.

A practical workflow is to generate 5-10 low-cost drafts first, choose the strongest two directions, then export the winners in high quality and the right marketplace dimensions. That gives you speed without wasting budget on the wrong creative direction.

## Prompt templates you can reuse

**White background listing image:** Keep the product exactly the same. Create a clean professional ecommerce product image on a pure white background with soft natural shadow, centered composition, no text, no extra props, suitable for Amazon and Shopify.

**Lifestyle scene:** Keep the product appearance, color, and structure unchanged. Place it in a realistic premium lifestyle setting with soft light and a background that supports the product without distracting from it.

**Social ad image:** Keep the product clear and recognizable. Create a more eye-catching social media ad composition with strong visual hierarchy, premium lighting, and a background that communicates the product benefit.

## Final publishing check

Before publishing, zoom in for 30 seconds. Did the product shape change? Are the colors honest? Did AI invent accessories, labels, text, or packaging details? If the image could mislead a buyer, it should be fixed before going live.

The best AI product images do not trick shoppers. They make the real product clearer, more desirable, and easier to trust.`;

export function expandBlogContent(slug: string, content: string, lang: BlogLang = 'zh') {
  if (lang === 'en') return `${content}
${PERSUASIVE_EN}`;
  const extra = SEO_EXPANSIONS_ZH[slug] || (slug === 'ecommerce-product-photography-budget' ? SEO_EXPANSIONS_ZH['product-photography-budget'] : '');
  return `${content}
${extra}
${PERSUASIVE_ZH}`;
}

export function getBlogZh(slug: string) {
  const entry = slug === 'ecommerce-product-photography-budget' ? BLOG_ZH['product-photography-budget'] : BLOG_ZH[slug];
  return entry ? { ...entry, content: expandBlogContent(slug, entry.content) } : entry;
}

export function bilingualLabel(lang: BlogLang, zh: string, en: string) {
  return lang === 'zh' ? zh : en;
}
