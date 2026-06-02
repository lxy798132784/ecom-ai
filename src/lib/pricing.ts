export type ImageQuality = 'low' | 'medium' | 'high';
export type ImageSizeKey = '1024x1024' | '1920x1080' | '2560x1440' | '3840x2160';

export const QUALITY_MULTIPLIER: Record<ImageQuality, number> = {
  low: 1,
  medium: 2,
  high: 4,
};

export const SIZE_MULTIPLIER: Record<ImageSizeKey, number> = {
  '1024x1024': 1,
  '1920x1080': 2,
  '2560x1440': 3,
  '3840x2160': 5,
};

export const BASE_IMAGE_POINTS = 1;
export const FREE_MONTHLY_POINTS = 10;
export const PRO_MONTHLY_POINTS = 2000;

export function normalizeQuality(input: any): ImageQuality {
  return input === 'low' || input === 'high' ? input : 'medium';
}

export function normalizeSize(input: any): ImageSizeKey {
  return input === '1920x1080' || input === '2560x1440' || input === '3840x2160' ? input : '1024x1024';
}

export function calcImagePoints(qualityInput: any, sizeInput: any): number {
  const quality = normalizeQuality(qualityInput);
  const size = normalizeSize(sizeInput);
  return BASE_IMAGE_POINTS * QUALITY_MULTIPLIER[quality] * SIZE_MULTIPLIER[size];
}
