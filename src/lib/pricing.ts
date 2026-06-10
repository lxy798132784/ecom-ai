export type ImageQuality = 'auto' | 'low' | 'medium' | 'high';
export type ImageSizeKey = string;

export const QUALITY_MULTIPLIER: Record<ImageQuality, number> = {
  auto: 2,
  low: 1,
  medium: 2,
  high: 4,
};

export const BASE_IMAGE_POINTS = 1;
export const FREE_MONTHLY_POINTS = 10;
export const PRO_MONTHLY_POINTS = 2500;

export function normalizeQuality(input: any): ImageQuality {
  return input === 'low' || input === 'medium' || input === 'high' ? input : 'auto';
}

function normalizeDimension(value: number) {
  return Math.max(16, Math.round(value / 16) * 16);
}

export function normalizeSize(input: any): ImageSizeKey {
  const raw = String(input || '').trim();
  if (!raw || raw === 'auto') return 'auto';
  const m = raw.match(/^(\d+)\s*[xX×]\s*(\d+)$/);
  if (!m) return 'auto';
  let width = normalizeDimension(Number(m[1]));
  let height = normalizeDimension(Number(m[2]));
  const fit = (scale: number) => { width = Math.max(16, Math.floor(width * scale / 16) * 16); height = Math.max(16, Math.floor(height * scale / 16) * 16); };
  const fill = (scale: number) => { width = Math.max(16, Math.ceil(width * scale / 16) * 16); height = Math.max(16, Math.ceil(height * scale / 16) * 16); };
  for (let i = 0; i < 4; i++) {
    const maxEdge = Math.max(width, height);
    if (maxEdge > 3840) fit(3840 / maxEdge);
    if (width / height > 3) width = Math.max(16, Math.floor(height * 3 / 16) * 16);
    else if (height / width > 3) height = Math.max(16, Math.floor(width * 3 / 16) * 16);
    const pixels = width * height;
    if (pixels > 8294400) fit(Math.sqrt(8294400 / pixels));
    else if (pixels < 655360) fill(Math.sqrt(655360 / pixels));
  }
  return `${width}x${height}`;
}

export function calcImagePoints(qualityInput: any, sizeInput: any): number {
  const quality = normalizeQuality(qualityInput);
  const size = normalizeSize(sizeInput);
  const q = QUALITY_MULTIPLIER[quality];
  if (size === 'auto') return BASE_IMAGE_POINTS * q;
  const [w, h] = size.split('x').map(Number);
  const mp = (w * h) / (1024 * 1024);
  const sm = mp > 7 ? 5 : mp > 3 ? 3 : mp > 1.5 ? 2 : 1;
  return BASE_IMAGE_POINTS * q * sm;
}
