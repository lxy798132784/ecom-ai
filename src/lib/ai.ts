export async function generateProductImageZhipu(prompt: string): Promise<string> {
  try {
    const resp = await fetch('https://open.bigmodel.cn/api/paas/v4/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'cogview-3',
        prompt: `Professional e-commerce product photography, ${prompt}, studio lighting, high resolution, commercial quality`,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error?.message || 'Zhipu API error');
    return data.data?.[0]?.url || '';
  } catch (e: any) {
    console.error('Zhipu generation failed:', e.message);
    return '';
  }
}
