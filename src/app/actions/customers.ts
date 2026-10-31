'use server';

import { db } from "@/lib/firebase";
import {
    collection,
    getDocs,
    addDoc,
    writeBatch,
    query,
    where,
    orderBy,
    limit,
} from "firebase/firestore";
import { z } from "zod";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { parseISO, compareAsc, differenceInDays } from "date-fns";
import { timeToMinutes, getServiceDetails } from "@/lib/data";
import { getServicesFromDB } from "@/app/actions/services";

export type CustomerAppointment = {
    name: string;
    email: string;
    phone?: string;
    service: string;
    date: string;
    time: string;
    endTime?: string;
    status: string;
    barberId: string;
    type: 'appointment' | 'blocked';
    cost: number;
    serviceNames: string;
    createdAt: string;
};

export type CustomerAnalytics = {
    id: string; // email
    name: string;
    email: string;
    phone?: string;
    totalVisits: number;
    lastVisitDate: Date | null;
    lastVisitTime: string | null;
    status: 'new' | 'stable' | 'irregular' | 'at_risk';
    totalSpent: number;
    appointments: CustomerAppointment[];
};

const customerSchema = z.object({
    name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
    email: z.string().email({ message: "Por favor, introduce un correo electrónico válido." }),
    phone: z.string().optional(),
});

function parseSafeDate(rawDate: any): Date {
    if (!rawDate) return new Date();
    if (typeof rawDate?.toDate === 'function') {
        try {
            const d = rawDate.toDate();
            if (d instanceof Date && !isNaN(d.getTime())) return d;
        } catch {
            // fallback
        }
    }
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
        return rawDate;
    }
    if (typeof rawDate === 'string' || typeof rawDate === 'number') {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) return d;
    }
    return new Date();
}

function convertTimeTo24Hour(time: string): string {
    if (!time) return "00:00";
    const min = timeToMinutes(time);
    if (min === -1) return "00:00";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export async function addCustomer(prevState: any, formData: FormData) {
    const validatedFields = customerSchema.safeParse({
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
    });

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Por favor, corrige los errores en el formulario.",
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    try {
        const { name, email, phone } = validatedFields.data;

        const customerQuery = query(collection(db, "customers"), where("email", "==", email));
        const querySnapshot = await getDocs(customerQuery);

        if (!querySnapshot.empty) {
            return { success: false, message: `El cliente con el email '${email}' ya existe.` };
        }

        const customerData = {
            name,
            email,
            phone: phone || null,
            createdAt: new Date(),
        };

        await addDoc(collection(db, "customers"), customerData);

        try {
            revalidateTag('customers-cache');
            revalidatePath('/admin/cash-flow');
        } catch {}

        return { success: true, message: `Cliente '${name}' añadido con éxito.` };
    } catch (error) {
        console.error("Error adding customer:", error);
        return {
            success: false,
            message: "Ocurrió un error al añadir el cliente."
        };
    }
}

export async function deleteCustomers(customerEmails: string[]): Promise<{ success: boolean, message: string }> {
    if (!customerEmails || customerEmails.length === 0) {
        return { success: false, message: "No se seleccionaron clientes para eliminar." };
    }

    try {
        const batch = writeBatch(db);

        const q = query(collection(db, "customers"), where("email", "in", customerEmails));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return { success: false, message: "No se encontraron los clientes para eliminar." };
        }

        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        try {
            revalidateTag('customers-cache');
            revalidatePath('/admin/cash-flow');
        } catch {}

        return { success: true, message: `${querySnapshot.size} cliente(s) eliminado(s) con éxito.` };

    } catch (error) {
        console.error("Error deleting customers:", error);
        return { success: false, message: "Ocurrió un error al eliminar los clientes." };
    }
}

async function fetchCustomerAnalyticsFromFirestore(): Promise<CustomerAnalytics[]> {
    try {
        const dbServices = await getServicesFromDB();
        const activeServices = dbServices || [];

        const appointmentsCol = collection(db, "appointments");
        const customersCol = collection(db, "customers");

        const appointmentsQuery = query(appointmentsCol, orderBy("date", "desc"), limit(250));
        const manualCustomersQuery = query(customersCol, limit(250));

        const [appointmentsSnapshot, manualCustomersSnapshot] = await Promise.all([
            getDocs(appointmentsQuery),
            getDocs(manualCustomersQuery)
        ]);

        if (appointmentsSnapshot.empty && manualCustomersSnapshot.empty) {
            return [];
        }

        type CustomerData = {
            name: string;
            email: string;
            phone?: string;
            appointments: CustomerAppointment[];
        };

        const customersData: Record<string, CustomerData> = {};

        // Process customers from manual entries first
        manualCustomersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const email = data.email.toLowerCase();
            if (!customersData[email]) {
                customersData[email] = {
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    appointments: [],
                };
            }
        });

        // Process customers from appointments
        appointmentsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.type === 'appointment' && data.email) {
                const email = data.email.toLowerCase();
                if (!customersData[email]) {
                    customersData[email] = {
                        name: data.name,
                        email: data.email,
                        phone: data.phone,
                        appointments: [],
                    };
                } else {
                    // Update name and phone from most recent appointment if it's different
                    customersData[email].name = data.name;
                    customersData[email].phone = data.phone || customersData[email].phone;
                }

                const { names, totalPrice: price } = getServiceDetails(data.service, activeServices);
                const createdAtDate = parseSafeDate(data.createdAt);

                customersData[email].appointments.push({
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    service: data.service,
                    date: data.date,
                    time: data.time,
                    endTime: data.endTime,
                    status: data.status,
                    barberId: data.barberId,
                    type: data.type,
                    cost: price,
                    serviceNames: names,
                    createdAt: createdAtDate.toISOString(),
                });
            }
        });

        const analytics: CustomerAnalytics[] = [];
        const today = new Date();

        for (const email in customersData) {
            const customer = customersData[email];
            const sortedAppointments = customer.appointments.sort((a, b) => {
                const dateA = parseISO(`${a.date}T${convertTimeTo24Hour(a.time)}`);
                const dateB = parseISO(`${b.date}T${convertTimeTo24Hour(b.time)}`);
                return compareAsc(dateB, dateA);
            });

            const completedAppointments = sortedAppointments.filter(app => app.status === 'completed');

            const totalVisits = completedAppointments.length;
            const totalSpent = completedAppointments.reduce((acc, app) => acc + (app.cost || 0), 0);

            let lastVisitDate: Date | null = null;
            let lastVisitTime: string | null = null;

            if (completedAppointments.length > 0) {
                lastVisitDate = parseISO(completedAppointments[0].date);
                lastVisitTime = completedAppointments[0].time;
            }

            const daysSinceLastVisit = lastVisitDate ? differenceInDays(today, lastVisitDate) : Infinity;

            let status: CustomerAnalytics['status'] = 'new';
            if (totalVisits >= 3) {
                if (daysSinceLastVisit <= 90) status = 'stable';
                else if (daysSinceLastVisit <= 180) status = 'irregular';
                else status = 'at_risk';
            } else if (totalVisits > 0) {
                if (daysSinceLastVisit <= 90) status = 'new';
                else if (daysSinceLastVisit <= 180) status = 'irregular';
                else status = 'at_risk';
            }

            analytics.push({
                id: email,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                totalVisits,
                lastVisitDate,
                lastVisitTime,
                status,
                totalSpent,
                appointments: sortedAppointments,
            });
        }

        analytics.sort((a, b) => {
            const lastVisitA = a.appointments[0]?.date ? parseISO(a.appointments[0].date) : null;
            const lastVisitB = b.appointments[0]?.date ? parseISO(b.appointments[0].date) : null;

            if (!lastVisitA) return 1;
            if (!lastVisitB) return -1;
            return compareAsc(lastVisitB, lastVisitA);
        });

        return analytics;

    } catch (error) {
        console.error('Error fetching customer analytics:', error);
        return [];
    }
}

const cachedCustomerAnalytics = unstable_cache(
    async () => fetchCustomerAnalyticsFromFirestore(),
    ['customer-analytics-cache'],
    {
        tags: ['customers-cache', 'appointments-cache'],
        revalidate: 600, // 10 minutos de cache
    }
);

export async function getCustomerAnalytics(): Promise<CustomerAnalytics[]> {
    try {
        return await cachedCustomerAnalytics();
    } catch {
        return await fetchCustomerAnalyticsFromFirestore();
    }
}
