import { MediaGeneratorPage } from '../components/MediaGeneratorPage';

export default function VideoPage() {
  return <MediaGeneratorPage
    kind="video"
    emoji="🎬"
    title={{ zh: 'AI 生视频', en: 'AI Video' }}
    subtitle={{ zh: '把商品图、场景描述和卖点转成短视频，用于广告测试、社媒封面和商品展示。', en: 'Turn product images, scene prompts, and selling points into short videos for ad tests, social covers, and product displays.' }}
    promptPlaceholder={{ zh: '例如：把这张护肤品商品图生成 5 秒高级广告短视频，镜头缓慢推进，水光质感，背景干净，突出高端和安心感。', en: 'Example: turn this skincare product photo into a 5-second premium ad video with a slow camera push-in, glossy texture, clean background, and a high-end trustworthy feel.' }}
    templatePrompt="Create a premium ecommerce product video. Use a slow camera push-in, clean background, soft studio lighting, subtle motion, and make the product feel trustworthy, desirable, and ready to buy."
    fields={[
      { name: { zh: '生成描述', en: 'Generation prompt' }, control: 'prompt', description: { zh: '说明商品、镜头、场景、情绪和投放用途。', en: 'Describe the product, camera movement, scene, mood, and ad placement use.' } },
      { name: { zh: '参考图片', en: 'Reference image' }, control: 'image', description: { zh: '上传商品图作为视频主体参考。', en: 'Upload a product image as the main visual reference.' } },
      { name: { zh: '风格', en: 'Style' }, control: 'style', description: { zh: '控制视觉气质，例如高级、温暖、科技、自然。', en: 'Control the visual feel, such as premium, warm, tech, or natural.' } },
      { name: { zh: '时长', en: 'Duration' }, control: 'duration', description: { zh: '短广告建议 3-8 秒，适合快速测试。', en: 'Short ads of 3–8 seconds are recommended for quick tests.' } },
      { name: { zh: '画面比例', en: 'Aspect ratio' }, control: 'aspectRatio', description: { zh: '16:9 适合横版广告，9:16 适合短视频，1:1 适合信息流。', en: '16:9 for horizontal ads, 9:16 for short videos, and 1:1 for feeds.' } },
    ]}
  />;
}
