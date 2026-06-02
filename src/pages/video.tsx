import { MediaGeneratorPage } from '../components/MediaGeneratorPage';

export default function VideoPage() {
  return <MediaGeneratorPage
    kind="video"
    emoji="🎬"
    title="AI 生视频"
    subtitle="把商品图、场景描述和卖点转成短视频，用于广告测试、社媒封面和商品展示。"
    promptPlaceholder="例如：把这张护肤品商品图生成 5 秒高级广告短视频，镜头缓慢推进，水光质感，背景干净，突出高端和安心感。"
    templatePrompt="Create a premium ecommerce product video. Use a slow camera push-in, clean background, soft studio lighting, subtle motion, and make the product feel trustworthy, desirable, and ready to buy."
    fields={[
      { name: '生成描述', control: 'prompt', description: '说明商品、镜头、场景、情绪和投放用途。' },
      { name: '参考图片', control: 'image', description: '上传商品图作为视频主体参考。' },
      { name: '风格', control: 'style', description: '控制视觉气质，例如高级、温暖、科技、自然。' },
      { name: '时长', control: 'duration', description: '短广告建议 3-8 秒，适合快速测试。' },
      { name: '画面比例', control: 'aspectRatio', description: '16:9 适合横版广告，9:16 适合短视频，1:1 适合信息流。' },
    ]}
  />;
}
