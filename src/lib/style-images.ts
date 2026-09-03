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
        label: 'French Crop Masculino',
    },
    'degradado-natural': {
        path: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&auto=format&fit=crop&q=80',
        label: 'Degradado Natural (Skin Fade)',
    },
    'texturizado': {
        path: 'https://images.unsplash.com/photo-1629189784191-9afdcbcb0398?w=800&auto=format&fit=crop&q=80',
        label: 'Corte Texturizado Masculino',
    },
    'mullet-moderno': {
        path: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&auto=format&fit=crop&q=80',
        label: 'Mullet Moderno Urbano',
    },
    'faux-hawk': {
        path: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=800&auto=format&fit=crop&q=80',
        label: 'Faux Hawk / Taper Fade',
    },
    'corte-militar': {
        path: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=800&auto=format&fit=crop&q=80',
        label: 'Corte Militar (Buzz Cut)',
    },
    'bob': {
        path: 'https://images.unsplash.com/photo-1562004760-aceed7bb0fe3?w=800&auto=format&fit=crop&q=80',
        label: 'Corte Clásico Caballero / Pompadour',
    },
    'shaggy': {
        path: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&fit=crop&q=80',
        label: 'Texturizado Medio Ondulado',
    },
    'coloracion': {
        path: 'https://images.unsplash.com/photo-1605497787865-e6d4762b386f?w=800&auto=format&fit=crop&q=80',
        label: 'Coloración y Matizado Masculino',
    },
    'diseno-rapado': {
        path: 'https://images.unsplash.com/photo-1622288432450-277d0fef5ed6?w=800&auto=format&fit=crop&q=80',
        label: 'Diseño Rapado a Navaja (Hair Tattoo)',
    },
};

export function getStyleImage(key: string | null | undefined): { path: string; label: string } | null {
    if (!key) return null;
    return styleImages[key as StyleImageKey] ?? null;
}
