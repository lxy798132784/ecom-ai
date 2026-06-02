import { MediaGeneratorPage } from '../components/MediaGeneratorPage';

export default function AudioPage() {
  return <MediaGeneratorPage
    kind="audio"
    emoji="🎙️"
    title="AI 生语音"
    subtitle="把商品卖点转成广告旁白、介绍音频或短视频配音，用声音增强信任感和购买欲。"
    promptPlaceholder="例如：为一款无线耳机生成 15 秒广告旁白，语气温暖专业，强调降噪、佩戴舒适、通勤使用场景。"
    templatePrompt="Generate a warm premium ecommerce voiceover. Make the product feel useful, trustworthy, and worth buying. Use a natural confident tone, highlight the main benefit, and end with a concise call to action."
    fields={[
      { name: '生成文案', control: 'prompt', description: '输入要朗读或改写成语音广告的内容。' },
      { name: '风格', control: 'style', description: '控制声音情绪，例如温暖、专业、活泼、科技感。' },
      { name: '时长', control: 'duration', description: '控制目标音频长度，短广告建议 10-20 秒。' },
    ]}
  />;
}
