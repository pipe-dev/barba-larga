'use server';

import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDocs,
    runTransaction,
    query,
    where,
} from "firebase/firestore";
import { z } from "zod";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { headers } from "next/headers";
import {
    parse,
    format,
    addDays,
    subDays,
    parseISO,
    compareAsc,
} from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import {
    timeToMinutes,
    minutesToTimeStr,
    doIntervalsOverlap,
    getServiceDuration,
    getServiceDetails,
    MIN_GAP_MINUTES,
} from "@/lib/data";
import { getServicesFromDB } from "@/app/actions/services";
import { getTeam } from "@/app/actions/team";
import { acquireLock, releaseLock } from "@/lib/redis";
import { sendAppointmentConfirmationEmail } from "@/lib/server/mailer";

export type Appointment = {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    service: string;
    date: string;
    time: string;
    endTime?: string;
    status: 'pending' | 'completed';
    createdAt: string;
    barberId: string;
    barberEmail?: string | null;
    type: 'appointment' | 'blocked';
};

const staticBarberEmails: Record<string, string> = {
    "alan": "stuntpk123@gmail.com",
    "alan-martinez": "stuntpk123@gmail.com",
    "jose-samudio": "Jjoseadrian261103@gmail.com",
    "juan-pablo-castillo": "juancastillo723777@gmail.com",
};

const phoneValidationSchema = z.string({ required_error: "El número de teléfono es obligatorio." })
    .trim()
    .min(7, { message: "El número de teléfono es muy corto." })
    .max(25, { message: "El número de teléfono es muy largo." })
    .regex(/^[+]?[\d\s().-]{7,25}$/, { message: "El formato de teléfono solo puede contener números, espacios y prefijos como +57." })
    .refine((val) => {
        const digits = val.replace(/\D/g, '');
        return digits.length >= 7 && digits.length <= 15;
    }, {
        message: "El número de teléfono debe contener entre 7 y 15 dígitos numéricos.",
    });

const bookingSchema = z.object({
    id: z.string().optional(),
    barberId: z.string().min(1, { message: "Por favor, selecciona un barbero." }),
    name: z.string()
        .min(2, { message: "El nombre debe tener al menos 2 caracteres." })
        .regex(/^[a-zA-Z\u00C0-\u017F\s'-]+$/, { message: "El nombre solo puede contener letras, espacios y guiones." }),
    email: z.string({ required_error: "El correo electrónico es obligatorio." })
        .trim()
        .email({ message: "Por favor, introduce un correo electrónico válido." }),
    phone: phoneValidationSchema,
    service: z.string().min(1, { message: "Por favor, selecciona al menos un servicio." }),
    date: z.string({ required_error: "Por favor, selecciona una fecha." }),
    time: z.string({ required_error: "Por favor, selecciona una hora." }),
});

const ipRequestStore: Map<string, number[]> = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_REQUESTS_PER_WINDOW = 20;

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const requests = ipRequestStore.get(ip) || [];
    const recentRequests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);

    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }

    recentRequests.push(now);
    ipRequestStore.set(ip, recentRequests);
    return true;
}

function sanitizeInput(str: any): string {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>?/gm, '').trim();
}

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

const convertTimeTo24Hour = (time: string): string => {
    if (!time) return "00:00";
    const min = timeToMinutes(time);
    if (min === -1) return "00:00";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export async function bookAppointment(prevState: any, formData: FormData) {
    let ip = '127.0.0.1';
    try {
        const headersList = await headers();
        const rawIp = headersList.get('x-forwarded-for')?.split(',')[0] || headersList.get('x-real-ip') || '127.0.0.1';
        ip = rawIp.trim();
    } catch {
        ip = '127.0.0.1';
    }

    if (!checkRateLimit(ip)) {
        return {
            success: false,
            message: 'Has realizado demasiados intentos de reserva. Por favor, inténtalo de nuevo más tarde.',
        };
    }

    const data = {
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        service: formData.get("service"),
        date: formData.get("date"),
        time: formData.get("time"),
        barberId: formData.get("barberId"),
    };

    const validatedFields = bookingSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Por favor, corrige los errores en el formulario.",
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    const { name: rawName, email: rawClientEmail, phone: rawPhone, service: serviceIds, date, time, barberId } = validatedFields.data;
    const name = sanitizeInput(rawName);
    const clientEmail = sanitizeInput(rawClientEmail);
    const phone = sanitizeInput(rawPhone);

    const slotLockKey = `lock:slot:${barberId}:${date}:${time}`;
    const lockResult = await acquireLock(slotLockKey, 120);
    if (!lockResult.success) {
        return {
            success: false,
            message: "Este horario acaba de ser seleccionado por otro cliente en este instante. Por favor, selecciona otro turno.",
        };
    }

    const newAppointmentRef = doc(collection(db, "appointments"));
    try {
        const dbServices = await getServicesFromDB();
        const activeServices = dbServices || [];

        await runTransaction(db, async (transaction) => {
            const team = await getTeam();
            const barber = team.find(b => b.id === barberId);

            if (!barber) {
                throw new Error("El barbero seleccionado no es válido.");
            }

            const totalDuration = getServiceDuration(serviceIds, activeServices);

            const newStart = timeToMinutes(time);
            if (newStart === -1) {
                throw new Error("El formato de hora de la cita no es válido.");
            }

            const newEnd = newStart + totalDuration;
            const endTime = minutesToTimeStr(newEnd);

            if (newStart < 480) {
                throw new Error("La cita es anterior al horario de apertura (8:00 AM).");
            }
            if (newEnd > 1260) {
                throw new Error("La cita excede el horario de cierre (9:00 PM). Por favor elige un horario más temprano.");
            }

            const bogotaDateStr = formatInTimeZone(new Date(), "America/Bogota", "yyyy-MM-dd");
            const bogotaTimeStr = new Date().toLocaleTimeString("en-US", { timeZone: "America/Bogota", hour12: false });
            const [bH, bM] = bogotaTimeStr.split(":").map(Number);
            const bogotaCurrentMinutes = (bH || 0) * 60 + (bM || 0);

            if (date < bogotaDateStr) {
                throw new Error("No puedes agendar citas en fechas pasadas.");
            }
            if (date === bogotaDateStr && newStart <= bogotaCurrentMinutes) {
                throw new Error("No puedes agendar una cita en un horario que ya ha pasado.");
            }

            const lockRef = doc(db, "appointments", `lock_${barberId}_${date}`);
            await transaction.get(lockRef);

            const dayAppointmentsQuery = query(
                collection(db, "appointments"),
                where("barberId", "==", barberId),
                where("date", "==", date)
            );

            const existingAppointmentsSnapshot = await getDocs(dayAppointmentsQuery);

            let isOverlapping = false;

            existingAppointmentsSnapshot.docs.forEach(docSnap => {
                if (docSnap.id.startsWith('lock_')) return;
                const apt = docSnap.data();
                if (apt.type === 'lock') return;
                if (apt.status === 'cancelled') return;
                if (!apt.time) return;

                const aptStart = timeToMinutes(apt.time);
                if (aptStart === -1) return;

                let aptEnd = apt.endTime ? timeToMinutes(apt.endTime) : -1;
                if (aptEnd === -1 || aptEnd <= aptStart) {
                    aptEnd = aptStart + getServiceDuration(apt.service || '', activeServices);
                }

                if (doIntervalsOverlap(newStart, newEnd, aptStart, aptEnd)) {
                    isOverlapping = true;
                }
            });

            if (isOverlapping) {
                throw new Error("Este horario o parte de su duración ya está reservado. Por favor, elige otro.");
            }

            const barberEmail = barber.email || staticBarberEmails[barberId] || null;

            const appointmentPayload: any = {
                name,
                date,
                barberId,
                status: 'pending',
                createdAt: new Date(),
                type: 'appointment',
                email: clientEmail,
                phone: phone,
                service: serviceIds,
                barberEmail: barberEmail,
                time: time,
                endTime: endTime,
            };

            transaction.set(newAppointmentRef, appointmentPayload);
            transaction.set(lockRef, { 
                type: 'lock', 
                lastUpdated: new Date() 
            }, { merge: true });

            if (clientEmail) {
                const customerQuery = query(collection(db, "customers"), where("email", "==", clientEmail));
                const customerSnapshot = await getDocs(customerQuery);

                if (customerSnapshot.empty) {
                    const newCustomerRef = doc(collection(db, "customers"));
                    transaction.set(newCustomerRef, {
                        name,
                        email: clientEmail,
                        phone: phone || null,
                        createdAt: new Date(),
                    });
                } else {
                    const customerDoc = customerSnapshot.docs[0];
                    const customerData = customerDoc.data();
                    const updates: any = {};
                    if (customerData.name !== name) updates.name = name;
                    if (phone && customerData.phone !== phone) updates.phone = phone;

                    if (Object.keys(updates).length > 0) {
                        transaction.update(customerDoc.ref, updates);
                    }
                }
            }
        });

        // --- WhatsApp and Email preparation ---
        const team = await getTeam();
        const barber = team.find(b => b.id === barberId);
        if (!barber) throw new Error("Barber not found.");

        const { names: serviceNames, totalPrice, totalDuration } = getServiceDetails(serviceIds!, activeServices);
        const formattedDate = format(parse(date, "yyyy-MM-dd", new Date()), "EEEE, d 'de' LLLL 'de' yyyy", { locale: es });
        const barbershopAddress = "Calle 22N #6A-30 Ciudad Jardín, Popayán, Cauca, Colombia";
        const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(barbershopAddress)}`;
        
        let whatsappUrl: string | undefined = undefined;
        if (barber.whatsapp) {
            let cleanNumber = barber.whatsapp.replace(/\D/g, '');
            if (cleanNumber.length === 10) {
                cleanNumber = '57' + cleanNumber;
            }
            const formattedPrice = totalPrice.toLocaleString('es-CO');
            const waMessage = `¡Hola ${barber.name}! Acabo de agendar una cita contigo en Barba Larga.\n\n*Detalles de la cita:*\n👤 *Cliente:* ${name}\n📅 *Fecha:* ${date}\n⏰ *Hora:* ${time}\n✂️ *Servicios:* ${serviceNames}\n⏱ *Duración estimada:* ${totalDuration} min\n💰 *Total:* $${formattedPrice}\n\n¡Nos vemos pronto!`;
            whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(waMessage)}`;
        } else {
            whatsappUrl = "https://wa.link/rxl87s";
        }

        // Send Email via mailer module (failure isolated and silent)
        await sendAppointmentConfirmationEmail({
            name,
            clientEmail,
            phone,
            barber,
            barberId,
            date,
            formattedDate,
            time,
            serviceNames,
            totalDuration,
            totalPrice,
            barbershopAddress,
            directionsUrl,
            whatsappUrl,
            newAppointmentRef,
        });

        const successMessage = `¡Reserva confirmada! Tu cita para el ${date} a las ${time} ha sido agendada.`;

        try {
            revalidateTag('appointments-cache');
            revalidatePath('/admin');
            revalidatePath('/');
        } catch {}

        return {
            success: true,
            message: successMessage,
            whatsappUrl: whatsappUrl,
        };

    } catch (error) {
        console.error("Booking transaction failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error inesperado al procesar la reserva.";
        return {
            success: false,
            message: errorMessage,
        };
    } finally {
        await releaseLock(slotLockKey, lockResult.token);
    }
}

export async function deleteAppointment(appointmentId: string): Promise<{ success: boolean, message: string }> {
    if (!appointmentId) {
        return { success: false, message: "ID de la cita no es válido." };
    }
    try {
        await runTransaction(db, async (transaction) => {
            const appointmentRef = doc(db, "appointments", appointmentId);

            // Find and delete all associated transactions if any exist
            const transactionsQuery = query(collection(db, "transactions"), where("appointmentId", "==", appointmentId));
            const transactionsSnapshot = await getDocs(transactionsQuery);
            transactionsSnapshot.docs.forEach(tDoc => {
                transaction.delete(tDoc.ref);
            });

            // Delete the appointment
            transaction.delete(appointmentRef);
        });

        try {
            revalidateTag('appointments-cache');
            revalidatePath('/admin');
            revalidatePath('/');
        } catch {}

        return { success: true, message: "Cita y venta asociada eliminadas con éxito." };

    } catch (error) {
        console.error("Error deleting appointment and associated sale:", error);
        return { success: false, message: "Ocurrió un error al cancelar la cita." };
    }
}

export async function reactivateAppointment(appointmentId: string): Promise<{ success: boolean; message: string }> {
    if (!appointmentId) {
        return { success: false, message: "ID de la cita no es válido." };
    }

    try {
        await runTransaction(db, async (transaction) => {
            const appointmentRef = doc(db, "appointments", appointmentId);
            const appointmentDoc = await transaction.get(appointmentRef);

            if (!appointmentDoc.exists() || appointmentDoc.data().status !== 'completed') {
                throw new Error("Solo se pueden reactivar citas completadas.");
            }

            const transactionsQuery = query(collection(db, "transactions"), where("appointmentId", "==", appointmentId));
            const transactionsSnapshot = await getDocs(transactionsQuery);
            transactionsSnapshot.docs.forEach(tDoc => {
                transaction.delete(tDoc.ref);
            });

            transaction.update(appointmentRef, { status: 'pending' });
        });

        try {
            revalidateTag('appointments-cache');
            revalidatePath('/admin');
            revalidatePath('/');
        } catch {}

        return { success: true, message: "Cita reactivada. La venta asociada ha sido eliminada." };

    } catch (error) {
        console.error("Error reactivating appointment:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
        return { success: false, message: `Error al reactivar la cita: ${errorMessage}` };
    }
}

export async function getAvailableTimesForDate(dateString: string, barberId: string): Promise<{ 
    blocked: string[]; 
    gaps: string[]; 
    intervals: { startMin: number; endMin: number }[] 
}> {
    if (!dateString || !barberId) return { blocked: [], gaps: [], intervals: [] };

    try {
        const appointmentsCol = collection(db, 'appointments');
        const q = query(
            appointmentsCol,
            where('date', '==', dateString),
            where('barberId', '==', barberId)
        );

        const querySnapshot = await getDocs(q);
        const blockedMinutes = new Set<number>();
        const appointments: { startMin: number; endMin: number }[] = [];

        const dbServices = await getServicesFromDB();
        const activeServices = dbServices || [];

        querySnapshot.docs.forEach((docSnap) => {
            if (docSnap.id.startsWith('lock_')) return;
            const data = docSnap.data();
            if (data.type === 'lock') return;
            if (data.status === 'cancelled') return;

            if (data.time) {
                const startMin = timeToMinutes(data.time);
                if (startMin === -1) return;

                let endMin: number;
                if (data.endTime) {
                    endMin = timeToMinutes(data.endTime);
                    if (endMin === -1 || endMin <= startMin) {
                        endMin = startMin + getServiceDuration(data.service || '', activeServices);
                    }
                } else {
                    endMin = startMin + getServiceDuration(data.service || '', activeServices);
                }

                appointments.push({ startMin, endMin });

                const firstBlocked = Math.floor(startMin / 10) * 10;
                const lastBlocked = Math.ceil(endMin / 10) * 10;

                for (let t = firstBlocked; t < lastBlocked; t += 10) {
                    blockedMinutes.add(t);
                }
            }
        });

        const blocked: string[] = [];
        blockedMinutes.forEach(m => {
            if (m >= 8 * 60 && m <= 20 * 60 + 50) {
                blocked.push(minutesToTimeStr(m));
            }
        });

        const gapSet = new Set<string>();
        const MIN_GAP = MIN_GAP_MINUTES || 20;

        for (const apt of appointments) {
            const gapStart = apt.endMin;
            if (gapStart >= 8 * 60 && gapStart <= 20 * 60 + 50) {
                const isOverlapping = appointments.some(other => gapStart >= other.startMin && gapStart < other.endMin);
                if (!isOverlapping) {
                    const laterApts = appointments.filter(a => a.startMin > gapStart).sort((a, b) => a.startMin - b.startMin);
                    const nextBoundary = laterApts.length > 0 ? laterApts[0].startMin : 1260;
                    if (nextBoundary - gapStart >= MIN_GAP) {
                        gapSet.add(minutesToTimeStr(gapStart));
                    }
                }
            }
        }

        return { 
            blocked, 
            gaps: Array.from(gapSet), 
            intervals: appointments 
        };

    } catch (error) {
        console.error('Error fetching booked times from Firestore:', error);
        return { blocked: [], gaps: [], intervals: [] };
    }
}

async function fetchAppointmentsFromFirestore(): Promise<Appointment[]> {
    try {
        const today = new Date();
        const startDateString = format(subDays(today, 15), "yyyy-MM-dd");
        const endDateString = format(addDays(today, 30), "yyyy-MM-dd");

        const appointmentsCol = collection(db, "appointments");

        const q = query(
            appointmentsCol,
            where("date", ">=", startDateString),
            where("date", "<=", endDateString)
        );

        const querySnapshot = await getDocs(q);

        const appointments = querySnapshot.docs
            .filter(doc => !doc.id.startsWith('lock_') && doc.data().type !== 'lock' && !!doc.data().date && !!doc.data().time)
            .map(doc => {
            const data = doc.data();
            const createdAtDate = parseSafeDate(data.createdAt);
            return {
                id: doc.id,
                name: data.name || '',
                email: data.email || '',
                phone: data.phone || '',
                service: data.service || '',
                date: data.date,
                time: data.time,
                endTime: data.endTime,
                status: data.status || 'pending',
                createdAt: createdAtDate.toISOString(),
                barberId: data.barberId || 'alan-martinez',
                barberEmail: data.barberEmail || null,
                type: data.type || 'appointment',
            } as Appointment;
        });

        appointments.sort((a, b) => {
            const dateA = parseISO(a.date);
            const dateB = parseISO(b.date);
            const dateComparison = compareAsc(dateB, dateA);

            if (dateComparison !== 0) {
                return dateComparison;
            }

            const timeA = convertTimeTo24Hour(a.time);
            const timeB = convertTimeTo24Hour(b.time);
            return timeA.localeCompare(timeB);
        });

        return appointments;

    } catch (error) {
        console.error('Error fetching all appointments:', error);
        return [];
    }
}

const cachedAppointments = unstable_cache(
    async () => fetchAppointmentsFromFirestore(),
    ['admin-appointments-window'],
    {
        tags: ['appointments-cache'],
        revalidate: 300,
    }
);

export async function getAllAppointments(): Promise<Appointment[]> {
    try {
        return await cachedAppointments();
    } catch {
        return await fetchAppointmentsFromFirestore();
    }
}
