import { MediaGeneratorPage } from '../components/MediaGeneratorPage';

export default function VoiceClonePage() {
  return <MediaGeneratorPage
    kind="voice-clone"
    emoji="🗣️"
    title="音色克隆"
    subtitle="上传参考音频，把商品文案生成接近参考音色的朗读结果，用于品牌统一配音。"
    promptPlaceholder="例如：请用参考音色朗读这段广告文案：这款便携咖啡杯适合通勤和旅行，保温持久，轻松放进包里。"
    templatePrompt="Clone the reference voice and read this ecommerce ad copy naturally. Keep the delivery warm, confident, clear, and persuasive without sounding exaggerated."
    fields={[
      { name: '生成文案', control: 'prompt', description: '输入希望用克隆音色朗读的商品文案。' },
      { name: '参考音频', control: 'voiceSample', description: '上传清晰人声样本，避免背景音乐和噪声。' },
      { name: '风格', control: 'style', description: '控制朗读语气，例如自然、亲和、坚定、轻松。' },
    ]}
  />;
}
