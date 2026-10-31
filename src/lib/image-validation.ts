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

// Known expired or broken ImgBB patterns and IDs
const brokenImgBBPatterns = [
  '1YCyX60S', // haircut-eyebrows
  'PGKgQDLH', // corte-diseno-cejas
  'Nn1CHS1H', // Jose Samudio expired photo
  '4gKfqfnt', // Ubicacion expired photo
  'service-unavailable',
];

// Direct mapping of all historical ImgBB assets to local high-speed static assets in /multimedia
const imgbbToLocalMap: [RegExp, string][] = [
  [/1YCyX60S|haircut-eyebrows/i, '/multimedia/haircut-eyebrows.png'],
  [/PGKgQDLH|corte-dise/i, '/multimedia/corte-diseno-cejas.jpg'],
  [/Ps2YzTHZ|corte-autoridad/i, '/multimedia/corte-autoridad.jpg'],
  [/21fHYQfG|barba/i, '/multimedia/barba.jpg'],
  [/j9zYsTHH|experiencia-dominante/i, '/multimedia/experiencia-dominante.jpg'],
  [/TD9mLsWr|rostro-impecable/i, '/multimedia/rostro-impecable.jpg'],
  [/j9F0N33y|servicio-premium/i, '/multimedia/servicio-premium.jpg'],
  [/qFnrJHvb|sobre-nosotros/i, '/multimedia/sobre-nosotros.jpg'],
  [/4gKfqfnt|ubicaci/i, '/multimedia/ubicacion.png'],
  [/XxNc72wT|qYQksJHS|cita-confirmada/i, '/multimedia/cita-confirmada.png'],
  [/XZHYyLFY|alan/i, '/multimedia/nuestro-equipo-alan.jpg'],
  [/tPx3XwsM|stiven/i, '/multimedia/nuestro-equipo-stiven.png'],
  [/k2TL19sp|logo-barber/i, '/multimedia/logo-barber.jpg'],
  [/Nn1CHS1H|samudio/i, '/multimedia/logo-barber.jpg'],
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
  if (!url || !isValidImageUrl(url)) {
    return fallback;
  }

  // Intercept known ImgBB paths and serve locally
  for (const [regex, localPath] of imgbbToLocalMap) {
    if (regex.test(url)) {
      return localPath;
    }
  }

  if (isBrokenImageUrl(url)) {
    return fallback;
  }

  return url;
}
