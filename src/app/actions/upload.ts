'use server';

export async function uploadImageToImgBB(formData: FormData): Promise<{ success: boolean; url?: string; message: string }> {
    try {
        const file = formData.get('image') as File | null;
        if (!file || file.size === 0) {
            return { success: false, message: 'No se ha seleccionado ninguna imagen.' };
        }

        if (!file.type.startsWith('image/')) {
            return { success: false, message: 'El archivo seleccionado debe ser una imagen (JPG, PNG, WEBP, GIF).' };
        }

        if (file.size > 32 * 1024 * 1024) {
            return { success: false, message: 'La imagen excede el límite permitido de 32MB.' };
        }

        const apiKey = process.env.IMGBB_API_KEY || process.env.NEXT_PUBLIC_IMGBB_API_KEY || 'ee478f85a2e97387a2e9a62d2b984e48';

        const buffer = await file.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');

        const imgbbFormData = new URLSearchParams();
        imgbbFormData.append('key', apiKey);
        imgbbFormData.append('image', base64Image);
        imgbbFormData.append('name', (file.name || 'barba-larga').replace(/\.[^/.]+$/, ''));

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: imgbbFormData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const result = await response.json();

        if (result.success && result.data?.url) {
            return {
                success: true,
                url: result.data.url,
                message: 'Imagen cargada y optimizada con éxito.',
            };
        } else {
            console.error('ImgBB API error response:', result);
            return {
                success: false,
                message: result.error?.message || 'No se pudo subir la imagen al servidor de alojamiento.',
            };
        }
    } catch (error: any) {
        console.error('Error in uploadImageToImgBB:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Error desconocido al subir la imagen.',
        };
    }
}
