'use server';

import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDocs,
    deleteDoc,
    writeBatch,
    query,
    where,
} from "firebase/firestore";
import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { parse, format, addDays, endOfMonth, getDay } from "date-fns";
import { timeToMinutes, doIntervalsOverlap } from "@/lib/data";
import { getTeam } from "@/app/actions/team";

const blockTimeSchema = z.object({
    barberId: z.string().min(1, { message: "Por favor, selecciona un barbero." }),
    date: z.string({ required_error: "Por favor, selecciona una fecha." }),
    time: z.string({ required_error: "Por favor, selecciona una hora de inicio." }),
    endTime: z.string({ required_error: "Por favor, selecciona una hora de fin." }),
    name: z.string().min(2, { message: "La descripción es muy corta." }),
    recurrence: z.enum(["none", "weekly", "yearly", "daily"]).default("none"),
}).refine(data => {
    const start = timeToMinutes(data.time);
    const end = timeToMinutes(data.endTime);
    return start !== -1 && end !== -1 && end > start;
}, {
    message: "La hora de fin debe ser posterior a la hora de inicio.",
    path: ["endTime"],
});

export async function blockTimeSlot(prevState: any, formData: FormData) {
    const data = {
        name: formData.get("name"),
        date: formData.get("date"),
        time: formData.get("time"),
        endTime: formData.get("endTime"),
        barberId: formData.get("barberId"),
        recurrence: formData.get("recurrence"),
    };

    const validatedFields = blockTimeSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Por favor, corrige los errores en el formulario.",
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    const { name, date, time, endTime, barberId, recurrence } = validatedFields.data;

    const team = await getTeam();
    const barber = team.find(b => b.id === barberId);
    if (!barber) {
        return { success: false, message: "El barbero seleccionado no es válido." };
    }

    try {
        // Validate that blocking does not collide with existing client appointments
        const startMin = timeToMinutes(time);
        const endMin = timeToMinutes(endTime);

        const dayAppointmentsQuery = query(
            collection(db, "appointments"),
            where("barberId", "==", barberId),
            where("date", "==", date)
        );
        const existingSnapshot = await getDocs(dayAppointmentsQuery);
        const hasConflict = existingSnapshot.docs.some(docSnap => {
            if (docSnap.id.startsWith('lock_')) return false;
            const apt = docSnap.data();
            if (apt.type === 'lock' || apt.status === 'cancelled') return false;
            if (!apt.time) return false;
            const aptStart = timeToMinutes(apt.time);
            if (aptStart === -1) return false;
            let aptEnd = apt.endTime ? timeToMinutes(apt.endTime) : aptStart + 60;
            return doIntervalsOverlap(startMin, endMin, aptStart, aptEnd);
        });

        if (hasConflict && recurrence === 'none') {
            return {
                success: false,
                message: "No puedes bloquear este horario porque ya existe una cita programada con un cliente en este intervalo."
            };
        }

        const batch = writeBatch(db);
        // Fix: Use parse instead of parseISO to treat "yyyy-MM-dd" as local time, 
        // preventing UTC offset from shifting the date to previous day.
        const startDate = parse(date, "yyyy-MM-dd", new Date());

        const getBlockedSlotPayload = (currentDate: Date) => ({
            name,
            date: format(currentDate, "yyyy-MM-dd"),
            time,
            endTime,
            barberId,
            type: 'blocked',
            service: '',
            status: 'pending', // Blocked slots don't need a complex status
            createdAt: new Date(),
        });

        if (recurrence === 'none') {
            const newDocRef = doc(collection(db, "appointments"));
            batch.set(newDocRef, getBlockedSlotPayload(startDate));
        } else if (recurrence === 'yearly') {
            // Repeat on the same day of the week for 8 consecutive weeks (protects Firestore quota)
            let currentDate = startDate;
            for (let week = 0; week < 8; week++) {
                const newDocRef = doc(collection(db, "appointments"));
                batch.set(newDocRef, getBlockedSlotPayload(currentDate));
                currentDate = addDays(currentDate, 7);
            }
        } else {
            const monthEnd = endOfMonth(startDate);
            let currentDate = startDate;

            if (recurrence === 'daily') {
                while (currentDate <= monthEnd) {
                    const newDocRef = doc(collection(db, "appointments"));
                    batch.set(newDocRef, getBlockedSlotPayload(currentDate));
                    currentDate = addDays(currentDate, 1);
                }
            } else if (recurrence === 'weekly') {
                const targetDayOfWeek = getDay(startDate);
                while (currentDate <= monthEnd) {
                    if (getDay(currentDate) === targetDayOfWeek) {
                        const newDocRef = doc(collection(db, "appointments"));
                        batch.set(newDocRef, getBlockedSlotPayload(currentDate));
                    }
                    currentDate = addDays(currentDate, 1);
                }
            }
        }

        await batch.commit();

        try {
            revalidateTag('appointments-cache');
            revalidatePath('/admin');
            revalidatePath('/');
        } catch {}

        return {
            success: true,
            message: `Horario bloqueado con éxito para ${barber.name}.`
        };

    } catch (error) {
        console.error("Error blocking time slot:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
        return {
            success: false,
            message: `Ocurrió un error al procesar la solicitud. ${errorMessage}`
        };
    }
}

export async function deleteBlockedSlot(slotId: string): Promise<{ success: boolean; message: string }> {
    if (!slotId) {
        return { success: false, message: "ID del bloqueo no es válido." };
    }
    try {
        await deleteDoc(doc(db, "appointments", slotId));
        try {
            revalidateTag('appointments-cache');
            revalidatePath('/admin');
            revalidatePath('/');
        } catch {}
        return { success: true, message: "Bloqueo de tiempo eliminado con éxito." };
    } catch (error) {
        console.error("Error deleting blocked slot:", error);
        return { success: false, message: "Ocurrió un error al eliminar el bloqueo." };
    }
}

export async function deleteAllBlockedSlots(barberId: string): Promise<{ success: boolean; message: string }> {
    if (!barberId) {
        return { success: false, message: "ID del barbero no proporcionado." };
    }
    try {
        const q = query(
            collection(db, "appointments"),
            where("type", "==", "blocked"),
            where("barberId", "==", barberId)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return { success: true, message: "No se encontraron horarios bloqueados para este barbero." };
        }

        const batch = writeBatch(db);
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        try {
            revalidateTag('appointments-cache');
            revalidatePath('/admin');
            revalidatePath('/');
        } catch {}

        return { success: true, message: `${querySnapshot.size} horario(s) bloqueado(s) para este barbero ha(n) sido eliminado(s) con éxito.` };

    } catch (error) {
        console.error("Error deleting all blocked slots:", error);
        return { success: false, message: "Ocurrió un error al eliminar los horarios bloqueados." };
    }
}
