/**
 * Mapping of style image keys to CDN image paths.
 * 10 distinct trending male haircut variants (2025/2026) verified with 100% real male photos.
 */

export type StyleImageKey =
    | 'capas-largo'
    | 'buzz-cut-militar'
    | 'french-crop'
    | 'mullet-moderno'
    | 'pompadour-clasico'
    | 'taper-fade-barba'
    | 'skin-fade-clasico'
    | 'faux-hawk'
    | 'ondulado-taper'
    | 'diseno-rayas'
    // Legacy / Aliases for backward compatibility
    | 'corte-militar'
    | 'degradado-natural'
    | 'texturizado'
    | 'bob'
    | 'shaggy'
    | 'coloracion'
    | 'diseno-rapado';

export const styleImages: Record<string, { path: string; label: string }> = {
    'capas-largo': {
        path: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop&q=80',
        label: 'Media Melena y Capas Masculinas',
    },
    'buzz-cut-militar': {
        path: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=800&auto=format&fit=crop&q=80',
        label: 'Corte Militar (Buzz Cut)',
    },
    'french-crop': {
        path: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&auto=format&fit=crop&q=80',
        label: 'French Crop Urbano',
    },
    'mullet-moderno': {
        path: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&auto=format&fit=crop&q=80',
        label: 'Mullet Moderno Urbano',
    },
    'pompadour-clasico': {
        path: 'https://images.unsplash.com/photo-1562004760-aceed7bb0fe3?w=800&auto=format&fit=crop&q=80',
        label: 'Pompadour / Raya Clásica Caballero',
    },
    'taper-fade-barba': {
        path: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&auto=format&fit=crop&q=80',
        label: 'Taper Fade con Barba Perfilada',
    },
    'skin-fade-clasico': {
        path: 'https://images.unsplash.com/photo-1605497787865-e6d4762b386f?w=800&auto=format&fit=crop&q=80',
        label: 'Skin Fade / Degradado a Cero',
    },
    'faux-hawk': {
        path: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&auto=format&fit=crop&q=80',
        label: 'Faux Hawk / Cresta Moderna',
    },
    'ondulado-taper': {
        path: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80',
        label: 'Texturizado Ondulado / Rizos con Taper',
    },
    'diseno-rayas': {
        path: 'https://images.unsplash.com/photo-1622288432450-277d0fef5ed6?w=800&auto=format&fit=crop&q=80',
        label: 'Diseño Urbano a Navaja (Hair Tattoo)',
    },
};

// Map legacy and alternate keys to one of the 10 canonical trending male styles
const keyAliases: Record<string, string> = {
    'corte-militar': 'buzz-cut-militar',
    'buzz': 'buzz-cut-militar',
    'buzz-cut': 'buzz-cut-militar',
    'degradado-natural': 'skin-fade-clasico',
    'skin-fade': 'skin-fade-clasico',
    'fade': 'skin-fade-clasico',
    'texturizado': 'french-crop',
    'bob': 'pompadour-clasico',
    'pompadour': 'pompadour-clasico',
    'clasico': 'pompadour-clasico',
    'shaggy': 'ondulado-taper',
    'ondas-taper': 'ondulado-taper',
    'ondulado': 'ondulado-taper',
    'coloracion': 'skin-fade-clasico',
    'diseno-rapado': 'diseno-rayas',
    'diseno': 'diseno-rayas',
    'capas': 'capas-largo',
    'largo': 'capas-largo',
    'barba': 'taper-fade-barba',
    'taper': 'taper-fade-barba',
    'taper-fade': 'taper-fade-barba',
    'mullet': 'mullet-moderno',
};

export function normalizeStyleKey(key: string | null | undefined): StyleImageKey {
    if (!key) return 'skin-fade-clasico';
    const clean = key.toLowerCase().trim();
    if (styleImages[clean]) return clean as StyleImageKey;
    if (keyAliases[clean]) return keyAliases[clean] as StyleImageKey;

    for (const canonicalKey of Object.keys(styleImages)) {
        if (clean.includes(canonicalKey) || canonicalKey.includes(clean)) {
            return canonicalKey as StyleImageKey;
        }
    }
    return 'skin-fade-clasico';
}

export function getStyleImage(key: string | null | undefined): { path: string; label: string } | null {
    if (!key) return null;
    const normalized = normalizeStyleKey(key);
    return styleImages[normalized] ?? styleImages['skin-fade-clasico'];
}
