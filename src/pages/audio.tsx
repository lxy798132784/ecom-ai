import { MediaGeneratorPage } from '../components/MediaGeneratorPage';

export default function AudioPage() {
  return <MediaGeneratorPage
    kind="audio"
    emoji="🎙️"
    title={{ zh: 'AI 生语音', en: 'AI Voice' }}
    subtitle={{ zh: '把商品卖点转成广告旁白、介绍音频或短视频配音，用声音增强信任感和购买欲。', en: 'Turn product selling points into ad voiceovers, intro audio, or short-video narration to build trust and desire.' }}
    promptPlaceholder={{ zh: '例如：为一款无线耳机生成 15 秒广告旁白，语气温暖专业，强调降噪、佩戴舒适、通勤使用场景。', en: 'Example: generate a 15-second ad voiceover for wireless earbuds in a warm professional tone, highlighting noise cancellation, comfort, and commuting use.' }}
    templatePrompt="Generate a warm premium ecommerce voiceover. Make the product feel useful, trustworthy, and worth buying. Use a natural confident tone, highlight the main benefit, and end with a concise call to action."
    fields={[
      { name: { zh: '生成文案', en: 'Voiceover copy' }, control: 'prompt', description: { zh: '输入要朗读或改写成语音广告的内容。', en: 'Enter the content to read or rewrite into an audio ad.' } },
      { name: { zh: '风格', en: 'Style' }, control: 'style', description: { zh: '控制声音情绪，例如温暖、专业、活泼、科技感。', en: 'Control the voice mood, such as warm, professional, energetic, or tech-like.' } },
      { name: { zh: '时长', en: 'Duration' }, control: 'duration', description: { zh: '控制目标音频长度，短广告建议 10-20 秒。', en: 'Control the target audio length. Short ads of 10–20 seconds are recommended.' } },
    ]}
  />;
}
