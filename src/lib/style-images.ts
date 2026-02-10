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
        path: '/multimedia/styles/french-crop.jpg',
        label: 'French Crop',
    },
    'degradado-natural': {
        path: '/multimedia/styles/degradado-natural.jpg',
        label: 'Degradado Natural',
    },
    'texturizado': {
        path: '/multimedia/styles/texturizado.jpg',
        label: 'Corte Texturizado',
    },
    'mullet-moderno': {
        path: '/multimedia/styles/mullet-moderno.jpg',
        label: 'Mullet Moderno',
    },
    'faux-hawk': {
        path: '/multimedia/styles/faux-hawk.jpg',
        label: 'Faux Hawk / Mohawk',
    },
    'corte-militar': {
        path: '/multimedia/styles/corte-militar.jpg',
        label: 'Corte Militar',
    },
    'bob': {
        path: '/multimedia/styles/bob.jpg',
        label: 'Bob Clásico',
    },
    'shaggy': {
        path: '/multimedia/styles/shaggy.jpg',
        label: 'Shaggy con Capas',
    },
    'coloracion': {
        path: '/multimedia/styles/coloracion.jpg',
        label: 'Coloración Estratégica',
    },
    'diseno-rapado': {
        path: '/multimedia/styles/diseno-rapado.jpg',
        label: 'Diseño Rapado',
    },
};

export function getStyleImage(key: string | null | undefined): { path: string; label: string } | null {
    if (!key) return null;
    return styleImages[key as StyleImageKey] ?? null;
}
