'use server';

import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { services as initialServices, Service } from '@/lib/data';

// Helper to sanitize service object for Firestore
const sanitizeService = (service: Service) => {
    // Firestore doesn't support custom objects like Lucide icons directly. 
    // We need to store the icon name as a string if it's not already.
    // In our data.ts, 'icon' can be a component or string 'BeardIcon'.
    // For simplicity in DB, we'll just store the string identifier if possible, 
    // or we might need a mapping in the frontend. 
    // For now, let's assume we store a string identifier for the icon.

    let iconName = 'Scissors'; // Default
    if (typeof service.icon === 'string') {
        iconName = service.icon;
    } else if ((service.icon as any).displayName) {
        iconName = (service.icon as any).displayName;
    }

    return {
        ...service,
        icon: iconName,
        // Ensure price is string as per interface, though number might be better for DB. 
        // Interface says string, so we keep string.
        price: service.price.toString(),
    };
};

export async function seedServices() {
    try {
        const batch = writeBatch(db);
        const servicesRef = collection(db, "services");

        // Check if services already exist to avoid overwriting edits
        const snapshot = await getDocs(servicesRef);
        if (!snapshot.empty) {
            return { success: false, message: "Services already seeded." };
        }

        initialServices.forEach(service => {
            const docRef = doc(servicesRef, service.id);
            batch.set(docRef, sanitizeService(service));
        });

        await batch.commit();
        return { success: true, message: "Services seeded successfully." };
    } catch (error) {
        console.error("Error seeding services:", error);
        return { success: false, message: "Failed to seed services." };
    }
}

export async function getServicesFromDB(): Promise<Service[]> {
    try {
        const servicesRef = collection(db, "services");
        const snapshot = await getDocs(servicesRef);

        if (snapshot.empty) {
            // Fallback or auto-seed? Let's return empty and handle in UI
            return [];
        }

        const services = snapshot.docs.map(doc => {
            const data = doc.data();
            // We need to map the icon string back to a component in the Frontend, 
            // but here we just return the data. 
            // The frontend will handle the icon mapping.
            return data as Service;
        });

        return services;
    } catch (error) {
        console.error("Error fetching services:", error);
        return [];
    }
}

export async function updateService(id: string, data: { price?: string, duration?: number, name?: string, description?: string }) {
    try {
        const serviceRef = doc(db, "services", id);
        await updateDoc(serviceRef, data);
        return { success: true, message: "Servicio actualizado correctamente." };
    } catch (error) {
        console.error("Error updating service:", error);
        return { success: false, message: "Error al actualizar el servicio." };
    }
}
