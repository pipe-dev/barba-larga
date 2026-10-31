'use server';

import * as appointmentsActions from './actions/appointments';
import * as blocksActions from './actions/blocks';
import * as customersActions from './actions/customers';
import * as cashFlowActions from './actions/cash-flow';
import * as teamActions from './actions/team';
import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
} from "firebase/firestore";
import { z } from "zod";
import { revalidateTag, unstable_cache } from "next/cache";
import { requireAdminSession, setAuthCookie, clearAuthCookie, getServerSession } from "@/lib/auth";
import { logSystemEvent, type SystemLog } from "@/lib/telemetry";

// --- Type Re-exports (100% Backwards Compatible) ---
export type { SystemLog } from "@/lib/telemetry";
export type { Appointment } from "./actions/appointments";
export type { TeamMember } from "./actions/team";
export type { CustomerAnalytics, CustomerAppointment } from "./actions/customers";
export type { Transaction, FinancialSummary, Product } from "./actions/cash-flow";

export type Notification = {
    id: string;
    title: string;
    description: string;
    createdAt: Date;
};

// ==========================================
// 1. APPOINTMENTS (Delegated)
// ==========================================
export async function bookAppointment(...args: Parameters<typeof appointmentsActions.bookAppointment>) {
    return appointmentsActions.bookAppointment(...args);
}

export async function getAllAppointments(...args: Parameters<typeof appointmentsActions.getAllAppointments>) {
    return appointmentsActions.getAllAppointments(...args);
}

export async function getAvailableTimesForDate(...args: Parameters<typeof appointmentsActions.getAvailableTimesForDate>) {
    return appointmentsActions.getAvailableTimesForDate(...args);
}

export async function deleteAppointment(...args: Parameters<typeof appointmentsActions.deleteAppointment>) {
    return appointmentsActions.deleteAppointment(...args);
}

export async function reactivateAppointment(...args: Parameters<typeof appointmentsActions.reactivateAppointment>) {
    return appointmentsActions.reactivateAppointment(...args);
}

// ==========================================
// 2. SCHEDULE BLOCKS (Delegated)
// ==========================================
export async function blockTimeSlot(...args: Parameters<typeof blocksActions.blockTimeSlot>) {
    return blocksActions.blockTimeSlot(...args);
}

export async function deleteBlockedSlot(...args: Parameters<typeof blocksActions.deleteBlockedSlot>) {
    return blocksActions.deleteBlockedSlot(...args);
}

export async function deleteAllBlockedSlots(...args: Parameters<typeof blocksActions.deleteAllBlockedSlots>) {
    return blocksActions.deleteAllBlockedSlots(...args);
}

// ==========================================
// 3. CUSTOMER CRM & ANALYTICS (Delegated)
// ==========================================
export async function addCustomer(...args: Parameters<typeof customersActions.addCustomer>) {
    return customersActions.addCustomer(...args);
}

export async function deleteCustomers(...args: Parameters<typeof customersActions.deleteCustomers>) {
    return customersActions.deleteCustomers(...args);
}

export async function getCustomerAnalytics(...args: Parameters<typeof customersActions.getCustomerAnalytics>) {
    return customersActions.getCustomerAnalytics(...args);
}

// ==========================================
// 4. CASH FLOW, POS & INVENTORY (Delegated)
// ==========================================
export async function confirmAppointmentAsSale(...args: Parameters<typeof cashFlowActions.confirmAppointmentAsSale>) {
    return cashFlowActions.confirmAppointmentAsSale(...args);
}

export async function addTransaction(...args: Parameters<typeof cashFlowActions.addTransaction>) {
    return cashFlowActions.addTransaction(...args);
}

export async function deleteTransaction(...args: Parameters<typeof cashFlowActions.deleteTransaction>) {
    return cashFlowActions.deleteTransaction(...args);
}

export async function getRecentTransactions(...args: Parameters<typeof cashFlowActions.getRecentTransactions>) {
    return cashFlowActions.getRecentTransactions(...args);
}

export async function getFinancialSummary(...args: Parameters<typeof cashFlowActions.getFinancialSummary>) {
    return cashFlowActions.getFinancialSummary(...args);
}

export async function addProduct(...args: Parameters<typeof cashFlowActions.addProduct>) {
    return cashFlowActions.addProduct(...args);
}

export async function updateProduct(...args: Parameters<typeof cashFlowActions.updateProduct>) {
    return cashFlowActions.updateProduct(...args);
}

export async function deleteProduct(...args: Parameters<typeof cashFlowActions.deleteProduct>) {
    return cashFlowActions.deleteProduct(...args);
}

export async function getProducts(...args: Parameters<typeof cashFlowActions.getProducts>) {
    return cashFlowActions.getProducts(...args);
}

// ==========================================
// 5. TEAM & COLLABORATORS (Delegated)
// ==========================================
export async function getTeam(...args: Parameters<typeof teamActions.getTeam>) {
    return teamActions.getTeam(...args);
}

export async function addTeamMember(...args: Parameters<typeof teamActions.addTeamMember>) {
    return teamActions.addTeamMember(...args);
}

export async function updateTeamMember(...args: Parameters<typeof teamActions.updateTeamMember>) {
    return teamActions.updateTeamMember(...args);
}

export async function toggleTeamMemberAvailability(...args: Parameters<typeof teamActions.toggleTeamMemberAvailability>) {
    return teamActions.toggleTeamMemberAvailability(...args);
}

export async function updateTeamOrder(...args: Parameters<typeof teamActions.updateTeamOrder>) {
    return teamActions.updateTeamOrder(...args);
}

export async function deleteTeamMember(...args: Parameters<typeof teamActions.deleteTeamMember>) {
    return teamActions.deleteTeamMember(...args);
}

// ==========================================
// 6. ADMIN AUTHENTICATION
// ==========================================
export async function verifyAdminPassword(password: string): Promise<{ success: boolean, role?: 'admin' | 'barber' }> {
    const adminPassword = process.env.ADMIN_PASSWORD || 'Ergo-ñia!';
    const barberPassword = 'barbersclvb69';

    if (password === adminPassword) {
        await setAuthCookie('admin');
        return { success: true, role: 'admin' };
    }
    if (password === barberPassword) {
        await setAuthCookie('barber');
        return { success: true, role: 'barber' };
    }
    return { success: false };
}

export async function logoutAdmin(): Promise<{ success: boolean }> {
    await clearAuthCookie();
    return { success: true };
}

export async function checkAdminSession(): Promise<{ isAuthenticated: boolean; role?: 'admin' | 'barber' }> {
    return await getServerSession();
}

// ==========================================
// 7. NOTIFICATIONS
// ==========================================
const notificationSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(5, { message: "El título debe tener al menos 5 caracteres." }),
    description: z.string().min(10, { message: "La descripción debe tener al menos 10 caracteres." }),
});

async function fetchNotificationsFromFirestore(): Promise<Omit<Notification, 'createdAt'>[]> {
    try {
        const notificationsCol = collection(db, "notifications");
        const q = query(notificationsCol, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title,
            description: doc.data().description,
        }));

    } catch (error) {
        console.error('Error fetching notifications from Firestore:', error);
        return [];
    }
}

const cachedNotifications = unstable_cache(
    async () => fetchNotificationsFromFirestore(),
    ['notifications-cache'],
    { tags: ['notifications'], revalidate: 86400 }
);

export async function getNotifications(): Promise<Omit<Notification, 'createdAt'>[]> {
    try {
        return await cachedNotifications();
    } catch {
        return await fetchNotificationsFromFirestore();
    }
}

export async function addNotification(prevState: any, formData: FormData) {
    const validatedFields = notificationSchema.safeParse({
        title: formData.get("title"),
        description: formData.get("description"),
    });

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Por favor, corrige los errores en el formulario.",
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    try {
        const { title, description } = validatedFields.data;
        await addDoc(collection(db, "notifications"), {
            title,
            description,
            createdAt: new Date(),
        });
        revalidateTag('notifications');
        return { success: true, message: "Notificación añadida con éxito." };
    } catch (error) {
        console.error("Error adding notification:", error);
        return { success: false, message: "Ocurrió un error al añadir la notificación." };
    }
}

export async function updateNotification(prevState: any, formData: FormData) {
    const validatedFields = notificationSchema.safeParse({
        id: formData.get("id"),
        title: formData.get("title"),
        description: formData.get("description"),
    });

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Por favor, corrige los errores.",
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }
    const { id, ...notificationData } = validatedFields.data;

    if (!id) {
        return { success: false, message: "ID de la notificación no encontrado." };
    }

    try {
        const notificationRef = doc(db, "notifications", id);
        await updateDoc(notificationRef, {
            title: notificationData.title,
            description: notificationData.description,
        });
        revalidateTag('notifications');
        return { success: true, message: "Notificación actualizada con éxito." };
    } catch (error) {
        console.error("Error updating notification:", error);
        return { success: false, message: "No se pudo actualizar la notificación." };
    }
}

export async function deleteNotification(notificationId: string): Promise<{ success: boolean; message: string }> {
    if (!notificationId) {
        return { success: false, message: "ID de la notificación no es válido." };
    }
    try {
        await deleteDoc(doc(db, "notifications", notificationId));
        revalidateTag('notifications');
        return { success: true, message: "Notificación eliminada con éxito." };
    } catch (error) {
        console.error("Error deleting notification:", error);
        return { success: false, message: "Ocurrió un error al eliminar la notificación." };
    }
}

// ==========================================
// 8. TELEMETRY & SYSTEM LOGS (Admin PIN Protected)
// ==========================================
export async function verifyMasterLogsPin(pin: string): Promise<{ success: boolean; message?: string }> {
    try {
        await requireAdminSession();
    } catch {
        return { success: false, message: 'Acceso no autorizado.' };
    }

    const MASTER_PIN = process.env.MASTER_LOGS_PIN || '5214';
    if (pin.trim() === MASTER_PIN) {
        return { success: true };
    }
    return { success: false, message: 'PIN maestro incorrecto.' };
}

export async function getSystemLogs(): Promise<SystemLog[]> {
    try {
        await requireAdminSession();
    } catch {
        return [];
    }

    try {
        const logsRef = collection(db, 'system_logs');
        const q = query(logsRef, orderBy('createdAt', 'desc'), limit(200));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            let dateObj = new Date();
            if (data.createdAt instanceof Timestamp) {
                dateObj = data.createdAt.toDate();
            } else if (data.createdAt?.toDate) {
                dateObj = data.createdAt.toDate();
            } else if (data.createdAt) {
                dateObj = new Date(data.createdAt);
            }

            return {
                id: docSnap.id,
                level: data.level || 'error',
                source: data.source || 'backend',
                action: data.action || 'unknown',
                message: data.message || '',
                stackTrace: data.stackTrace || undefined,
                metadata: data.metadata || {},
                userAgent: data.userAgent || 'Server',
                ip: data.ip || '127.0.0.1',
                version: data.version || 'v2.2',
                commit: data.commit || 'c3c3603',
                createdAt: dateObj,
                resolved: Boolean(data.resolved),
            } as SystemLog;
        });
    } catch (error) {
        console.error('Error fetching system logs:', error);
        return [];
    }
}

export async function resolveSystemLog(logId: string): Promise<{ success: boolean; message: string }> {
    try {
        await requireAdminSession();
    } catch {
        return { success: false, message: 'No autorizado.' };
    }

    if (!logId) return { success: false, message: 'ID de log no válido.' };
    try {
        const logRef = doc(db, 'system_logs', logId);
        await updateDoc(logRef, { resolved: true });
        return { success: true, message: 'Log marcado como solucionado.' };
    } catch (error) {
        return { success: false, message: 'Error al actualizar el estado del log.' };
    }
}

export async function deleteSystemLog(logId: string): Promise<{ success: boolean; message: string }> {
    try {
        await requireAdminSession();
    } catch {
        return { success: false, message: 'No autorizado.' };
    }

    if (!logId) return { success: false, message: 'ID de log no válido.' };
    try {
        const logRef = doc(db, 'system_logs', logId);
        await deleteDoc(logRef);
        return { success: true, message: 'Registro de error eliminado.' };
    } catch (error) {
        return { success: false, message: 'Error al eliminar el log.' };
    }
}

export async function clearResolvedLogs(): Promise<{ success: boolean; count: number; message: string }> {
    try {
        await requireAdminSession();
    } catch {
        return { success: false, count: 0, message: 'No autorizado.' };
    }

    try {
        const logsRef = collection(db, 'system_logs');
        const q = query(logsRef, where('resolved', '==', true));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return { success: true, count: 0, message: 'No hay logs solucionados para eliminar.' };
        }

        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnap => {
            batch.delete(docSnap.ref);
        });
        await batch.commit();

        return { success: true, count: snapshot.size, message: `${snapshot.size} logs solucionados eliminados.` };
    } catch (error) {
        return { success: false, count: 0, message: 'Error al limpiar logs solucionados.' };
    }
}

export async function createTestSystemLog(): Promise<{ success: boolean; message: string }> {
    try {
        await requireAdminSession();
        const logId = await logSystemEvent({
            level: 'info',
            source: 'backend',
            action: 'testTelemetryLog',
            message: 'Registro de prueba generado manualmente desde el panel de diagnóstico.',
            metadata: {
                testTriggeredBy: 'admin',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development'
            }
        });
        return { success: true, message: `Log de prueba generado con ID: ${logId}` };
    } catch (error) {
        return { success: false, message: 'Error al generar log de prueba.' };
    }
}
