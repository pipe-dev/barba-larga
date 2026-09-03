/**
 * Mapping of style image keys to local image paths.
 * Used by the AI Style Advisor to show reference photos of recommended hairstyles.
 */

export type StyleImageKey =
    | 'french-crop'
    | 'degradado-natural'
    | 'texturizado'
    | 'mullet-moderno'
    | 'faux-hawk'
    | 'corte-militar'
    | 'bob'
    | 'shaggy'
    | 'coloracion'
    | 'diseno-rapado';

export const styleImages: Record<StyleImageKey, { path: string; label: string }> = {
    'french-crop': {
        path: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&auto=format&fit=crop&q=80',
        label: 'French Crop',
    },
    'degradado-natural': {
        path: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&auto=format&fit=crop&q=80',
        label: 'Degradado Natural (Fade)',
    },
    'texturizado': {
        path: 'https://images.unsplash.com/photo-1504703395950-b89145a5425b?w=800&auto=format&fit=crop&q=80',
        label: 'Corte Texturizado',
    },
    'mullet-moderno': {
        path: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&auto=format&fit=crop&q=80',
        label: 'Mullet Moderno',
    },
    'faux-hawk': {
        path: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&auto=format&fit=crop&q=80',
        label: 'Faux Hawk / Mohawk',
    },
    'corte-militar': {
        path: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=800&auto=format&fit=crop&q=80',
        label: 'Corte Militar (Buzz Cut)',
    },
    'bob': {
        path: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=800&auto=format&fit=crop&q=80',
        label: 'Bob Clásico',
    },
    'shaggy': {
        path: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?w=800&auto=format&fit=crop&q=80',
        label: 'Shaggy con Capas',
    },
    'coloracion': {
        path: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=800&auto=format&fit=crop&q=80',
        label: 'Coloración Estratégica',
    },
    'diseno-rapado': {
        path: 'https://images.unsplash.com/photo-1622288432450-277d0fef5ed6?w=800&auto=format&fit=crop&q=80',
        label: 'Diseño Rapado (Hair Tattoo)',
    },
};

export function getStyleImage(key: string | null | undefined): { path: string; label: string } | null {
    if (!key) return null;
    return styleImages[key as StyleImageKey] ?? null;
}
