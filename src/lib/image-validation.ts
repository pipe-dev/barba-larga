
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

export function getSafeImageUrl(url: string | null | undefined, fallback: string = 'https://i.ibb.co/qYQksJHS/cita-confirmada-100-opacidad.png'): string {
  if (!url || !isValidImageUrl(url)) {
    return fallback;
  }
  return url;
}
