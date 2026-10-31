'use server';

import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    query,
} from "firebase/firestore";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";
import { requireAdminSession } from "@/lib/auth";

export type TeamMember = {
    id: string;
    name: string;
    email: string | null;
    role: string;
    description: string;
    imageUrl: string;
    isAvailable: boolean;
    color?: string;
    whatsapp?: string;
    order?: number;
};

const createTeamMemberId = (name: string) => {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

const newTeamMemberSchema = z.object({
    name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
    email: z.string().email({ message: "Por favor, introduce un correo electrónico válido." }).nullable().optional(),
    role: z.string().min(3, { message: "El rol es requerido." }),
    description: z.string().min(10, { message: "La descripción debe tener al menos 10 caracteres." }),
    imageUrl: z.string().min(1, { message: "Por favor, introduce una ruta de imagen válida." }),
    isAvailable: z.boolean().default(true),
    whatsapp: z.string().optional().or(z.literal("")),
});

export async function addTeamMember(prevState: any, formData: FormData) {
    try {
        await requireAdminSession();
    } catch {
        return { success: false, message: "No autorizado. Requiere permisos de administrador." };
    }

    const validatedFields = newTeamMemberSchema.safeParse({
        name: formData.get("name"),
        email: formData.get("email") || null,
        role: formData.get("role"),
        description: formData.get("description"),
        imageUrl: formData.get("imageUrl"),
        isAvailable: formData.get("isAvailable") === 'on',
        whatsapp: (formData.get("whatsapp") as string || "").replace(/[^0-9]/g, ''),
    });

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Por favor, corrige los errores.",
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    const { name, ...memberData } = validatedFields.data;
    const memberId = createTeamMemberId(name);

    try {
        const memberRef = doc(db, "team", memberId);
        const docSnap = await getDoc(memberRef);
        if (docSnap.exists()) {
            return { success: false, message: `Un colaborador con el nombre '${name}' ya existe.` };
        }

        // Assign a random color from palette
        const palette = [
            "#e11d48", // Rose
            "#db2777", // Pink
            "#9333ea", // Purple
            "#7c3aed", // Violet
            "#4f46e5", // Indigo
            "#2563eb", // Blue (Alan)
            "#0284c7", // Sky
            "#0891b2", // Cyan
            "#0d9488", // Teal
            "#10b981", // Emerald
            "#16a34a", // Green
            "#65a30d", // Lime
            "#ca8a04", // Yellow
            "#d97706", // Amber
            "#ea580c", // Orange
            "#dc2626", // Red
        ];
        const randomColor = palette[Math.floor(Math.random() * palette.length)];

        // Assign default order as last
        const teamCol = collection(db, "team");
        const teamSnap = await getDocs(query(teamCol));
        const maxOrder = teamSnap.empty ? 0 : Math.max(0, ...teamSnap.docs.map(d => d.data().order ?? 0));

        await setDoc(memberRef, {
            name,
            ...memberData,
            color: randomColor,
            order: maxOrder + 1
        });
        revalidateTag('team');
        return { success: true, message: `Colaborador '${name}' añadido con éxito.` };
    } catch (error) {
        console.error("Error adding team member:", error);
        return { success: false, message: "No se pudo añadir el colaborador." };
    }
}

const teamMemberSchema = z.object({
    id: z.string(),
    name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
    email: z.string().email({ message: "Email inválido." }).nullable().optional().or(z.literal("")),
    description: z.string().min(10, { message: "La descripción debe tener al menos 10 caracteres." }),
    imageUrl: z.string().url({ message: "Por favor, introduce una URL de imagen válida." }),
    isAvailable: z.boolean().default(true),
    role: z.string(),
    whatsapp: z.string().optional().or(z.literal("")),
});

async function fetchTeamFromFirestore(): Promise<TeamMember[]> {
    try {
        const teamCol = collection(db, "team");
        const querySnapshot = await getDocs(query(teamCol));

        const team = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name,
                email: data.email || null,
                role: data.role,
                description: data.description,
                imageUrl: data.imageUrl,
                isAvailable: data.isAvailable ?? true,
                color: data.color || '#2563eb',
                whatsapp: data.whatsapp || "",
                order: data.order ?? 999,
            } as TeamMember;
        });
        return team.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

    } catch (error) {
        console.error('Error fetching team from Firestore:', error);
        return [];
    }
}

const cachedTeam = unstable_cache(
    async () => fetchTeamFromFirestore(),
    ['team-list-cache'],
    { tags: ['team'], revalidate: 86400 }
);

export async function getTeam(): Promise<TeamMember[]> {
    try {
        return await cachedTeam();
    } catch {
        return await fetchTeamFromFirestore();
    }
}

export async function updateTeamMember(prevState: any, formData: FormData) {
    try {
        await requireAdminSession();
    } catch {
        return { success: false, message: "No autorizado. Requiere permisos de administrador." };
    }

    const dataToValidate = {
        id: formData.get("id"),
        name: formData.get("name"),
        email: formData.get("email"),
        description: formData.get("description"),
        imageUrl: formData.get("imageUrl"),
        isAvailable: formData.get("isAvailable") === 'on',
        role: formData.get("role"),
        whatsapp: (formData.get("whatsapp") as string || "").replace(/[^0-9]/g, ''),
    };

    const validatedFields = teamMemberSchema.safeParse(dataToValidate);

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Por favor, corrige los errores.",
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    const { id, ...memberData } = validatedFields.data;

    if (!id) {
        return { success: false, message: "ID del miembro del equipo no encontrado." };
    }

    try {
        const memberRef = doc(db, "team", id);
        await updateDoc(memberRef, {
            name: memberData.name,
            email: memberData.email || null,
            description: memberData.description,
            imageUrl: memberData.imageUrl,
            isAvailable: memberData.isAvailable,
            role: memberData.role,
            whatsapp: memberData.whatsapp || "",
        });
        revalidateTag('team');
        return { success: true, message: "Colaborador actualizado con éxito." };
    } catch (error) {
        console.error("Error updating team member:", error);
        return { success: false, message: "No se pudo actualizar el colaborador." };
    }
}

export async function toggleTeamMemberAvailability(id: string, isAvailable: boolean): Promise<{ success: boolean, message: string }> {
    try {
        await requireAdminSession();
    } catch {
        return { success: false, message: "No autorizado. Requiere permisos de administrador." };
    }

    if (!id) {
        return { success: false, message: "ID del colaborador no es válido." };
    }
    try {
        const memberRef = doc(db, "team", id);
        await updateDoc(memberRef, { isAvailable });
        revalidateTag('team');
        return { success: true, message: `Disponibilidad actualizada.` };
    } catch (error) {
        console.error("Error updating availability:", error);
        return { success: false, message: "No se pudo actualizar la disponibilidad." };
    }
}

export async function updateTeamOrder(orders: { id: string, order: number }[]) {
    try {
        await requireAdminSession();
    } catch {
        return { success: false, message: "No autorizado. Requiere permisos de administrador." };
    }

    try {
        const batch = writeBatch(db);
        orders.forEach(item => {
            const memberRef = doc(db, "team", item.id);
            batch.update(memberRef, { order: item.order });
        });
        await batch.commit();
        revalidateTag('team');
        return { success: true, message: "Orden actualizado exitosamente." };
    } catch (error) {
        console.error("Error updating team order:", error);
        return { success: false, message: "No se pudo actualizar el orden." };
    }
}

export async function deleteTeamMember(memberId: string): Promise<{ success: boolean; message: string }> {
    try {
        await requireAdminSession();
    } catch {
        return { success: false, message: "No autorizado. Requiere permisos de administrador." };
    }

    if (!memberId) {
        return { success: false, message: "ID del colaborador no es válido." };
    }
    // Prevent deletion of the main brand card
    if (memberId === 'barba-larga-brand') {
        return { success: false, message: "No se puede eliminar la tarjeta de la marca." };
    }
    try {
        await deleteDoc(doc(db, "team", memberId));
        revalidateTag('team');
        return { success: true, message: "Colaborador eliminado con éxito." };
    } catch (error) {
        console.error("Error deleting team member:", error);
        return { success: false, message: "No se pudo eliminar el colaborador." };
    }
}
