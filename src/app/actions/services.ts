'use server';

import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { Service } from '@/lib/data';
import { requireAdminSession } from '@/lib/auth';
import { unstable_cache, revalidateTag } from 'next/cache';

async function fetchServicesFromFirestore(): Promise<Service[]> {
    try {
        const servicesRef = collection(db, "services");
        const snapshot = await getDocs(servicesRef);

        if (snapshot.empty) {
            return [];
        }

        const services: Service[] = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            services.push({
                id: data.id || docSnap.id,
                name: data.name,
                price: data.price?.toString() || "0",
                duration: Number(data.duration) || 60,
                description: data.description || '',
                icon: data.icon || 'Scissors',
                mediaUrl: data.mediaUrl || 'https://i.ibb.co/Ps2YzTHZ/corte-autoridad.webp',
                mediaType: data.mediaType || 'image',
                imageHint: data.imageHint || data.name || '',
                popular: data.popular || false,
                isSignature: data.isSignature || false,
                rating: data.rating || 5.0,
                reviewsCount: data.reviewsCount || 0,
                accentColor: data.accentColor || '#39FF14',
                included: data.included || [],
            } as Service);
        });

        return services;
    } catch (error) {
        console.error("Error fetching services from Firestore:", error);
        return [];
    }
}

const cachedServices = unstable_cache(
    async () => fetchServicesFromFirestore(),
    ['services-catalog-cache'],
    { tags: ['services'], revalidate: 86400 }
);

export async function getServicesFromDB(): Promise<Service[]> {
    try {
        return await cachedServices();
    } catch {
        return await fetchServicesFromFirestore();
    }
}

export async function createService(data: { name: string; price: string; duration: number; description?: string; mediaUrl?: string }) {
    try {
        await requireAdminSession();
        if (!data.name || !data.price || !data.duration) {
            return { success: false, message: "Nombre, precio y duración son obligatorios." };
        }
        const cleanSlug = data.name.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        const id = cleanSlug ? `${cleanSlug}-${Date.now().toString().slice(-4)}` : `service-${Date.now()}`;

        const serviceRef = doc(db, "services", id);
        const newService = {
            id,
            name: data.name.trim(),
            price: data.price.toString().replace(/\D/g, ''),
            duration: Number(data.duration) || 60,
            description: data.description?.trim() || '',
            icon: 'Scissors',
            mediaUrl: data.mediaUrl?.trim() || 'https://i.ibb.co/Ps2YzTHZ/corte-autoridad.webp',
            mediaType: 'image',
            imageHint: data.name.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await setDoc(serviceRef, newService);
        revalidateTag('services');
        return { success: true, message: `Servicio '${data.name}' creado con éxito.` };
    } catch (error: any) {
        console.error("Error creating service:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Error al crear el servicio: ${errorMsg}` };
    }
}

export async function deleteService(id: string) {
    try {
        await requireAdminSession();
        if (!id) return { success: false, message: "ID de servicio no válido." };
        await deleteDoc(doc(db, "services", id));
        revalidateTag('services');
        return { success: true, message: "Servicio eliminado con éxito." };
    } catch (error: any) {
        console.error("Error deleting service:", error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        return { success: false, message: `Error al eliminar el servicio: ${errorMsg}` };
    }
}

export async function updateService(id: string, data: { price?: string, duration?: number, name?: string, description?: string, mediaUrl?: string }) {
    try {
        await requireAdminSession();
        const serviceRef = doc(db, "services", id);

        await setDoc(serviceRef, {
            ...data,
            id,
            updatedAt: new Date(),
        }, { merge: true });
        revalidateTag('services');

        return { success: true, message: "Servicio actualizado correctamente." };
    } catch (error: any) {
        console.error("Error updating service:", error);
        const errorMsg = error instanceof Error ? error.message : (error?.message || String(error));
        return { success: false, message: `Error al actualizar el servicio: ${errorMsg}` };
    }
}
