import { MediaGeneratorPage } from '../components/MediaGeneratorPage';

export default function VoiceClonePage() {
  return <MediaGeneratorPage
    kind="voice-clone"
    emoji="🗣️"
    title={{ zh: '音色克隆', en: 'Voice Clone' }}
    subtitle={{ zh: '上传参考音频，把商品文案生成接近参考音色的朗读结果，用于品牌统一配音。', en: 'Upload reference audio and generate product copy in a similar voice for consistent brand narration.' }}
    promptPlaceholder={{ zh: '例如：请用参考音色朗读这段广告文案：这款便携咖啡杯适合通勤和旅行，保温持久，轻松放进包里。', en: 'Example: read this ad copy using the reference voice: this portable coffee cup is great for commuting and travel, keeps drinks warm, and fits easily in a bag.' }}
    templatePrompt="Clone the reference voice and read this ecommerce ad copy naturally. Keep the delivery warm, confident, clear, and persuasive without sounding exaggerated."
    fields={[
      { name: { zh: '生成文案', en: 'Voiceover copy' }, control: 'prompt', description: { zh: '输入希望用克隆音色朗读的商品文案。', en: 'Enter the product copy to read with the cloned voice.' } },
      { name: { zh: '参考音频', en: 'Reference audio' }, control: 'voiceSample', description: { zh: '上传清晰人声样本，避免背景音乐和噪声。', en: 'Upload a clear voice sample and avoid background music or noise.' } },
      { name: { zh: '风格', en: 'Style' }, control: 'style', description: { zh: '控制朗读语气，例如自然、亲和、坚定、轻松。', en: 'Control the delivery tone, such as natural, friendly, firm, or relaxed.' } },
    ]}
  />;
}
