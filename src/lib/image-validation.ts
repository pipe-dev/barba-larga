export function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  // Accept local static paths (e.g. /multimedia/image.jpg)
  if (url.startsWith('/')) return true;
  // Reject file:/// and other non-http protocols
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (e) {
    return false;
  }
}

// Known expired or broken ImgBB IDs that return the "service unavailable" image
const brokenImgBBPatterns = [
  '1YCyX60S', // haircut-eyebrows
  'PGKgQDLH', // corte-diseno-cejas
  'Nn1CHS1H', // Jose Samudio expired photo
  '4gKfqfnt', // Ubicacion expired photo
  'service-unavailable',
];

export function isBrokenImageUrl(url?: string | null): boolean {
  if (!url) return true;
  return brokenImgBBPatterns.some(pattern => url.includes(pattern));
}

export const officialServiceLocalImages: Record<string, string> = {
  "haircut": "/multimedia/corte-autoridad.jpg",
  "haircut-eyebrows": "/multimedia/haircut-eyebrows.png",
  "haircut-beard": "/multimedia/experiencia-dominante.jpg",
  "haircut-design": "/multimedia/corte-diseno-cejas.jpg",
  "haircut-facial-mask": "/multimedia/rostro-impecable.jpg",
  "beard-combo": "/multimedia/barba.jpg",
  "eyebrows": "/multimedia/haircut-eyebrows.png",
};

export function getSafeImageUrl(
  url: string | null | undefined,
  fallback: string = '/multimedia/logo-barber.jpg'
): string {
  if (!url || !isValidImageUrl(url) || isBrokenImageUrl(url)) {
    return fallback;
  }
  return url;
}
