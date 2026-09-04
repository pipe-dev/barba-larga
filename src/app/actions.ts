

"use server";

import 'dotenv/config';
import { z } from "zod";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, getDoc, updateDoc, deleteDoc, query, where, getDocs, orderBy, limit, Timestamp, runTransaction, setDoc, writeBatch } from "firebase/firestore";
import { format, parse, parseISO, compareAsc, addHours, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isToday as isTodayDateFns, isWithinInterval, differenceInDays, subMonths, getDay, addDays, lastDayOfMonth } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { getServiceDetails, timeToMinutes, minutesToTimeStr, doIntervalsOverlap, getServiceDuration, MIN_GAP_MINUTES } from '@/lib/data';
import { getServicesFromDB } from '@/app/actions/services';
import { es } from 'date-fns/locale';
import nodemailer from 'nodemailer';
import path from 'path';
import { headers } from 'next/headers';
import { setAuthCookie, clearAuthCookie, requireAdminSession, requireAuthSession, getServerSession } from '@/lib/auth';
import { logSystemEvent, SystemLog } from '@/lib/telemetry';
import { unstable_cache, revalidateTag, revalidatePath } from 'next/cache';
import { acquireLock, releaseLock } from '@/lib/redis';

export type { SystemLog } from '@/lib/telemetry';

const bookingSchema = z.object({
    id: z.string().optional(), // For updates
    barberId: z.string().min(1, { message: "Por favor, selecciona un barbero." }),
    name: z.string()
        .min(2, { message: "El nombre debe tener al menos 2 caracteres." })
        .regex(/^[a-zA-Z\u00C0-\u017F\s'-]+$/, { message: "El nombre solo puede contener letras, espacios y guiones." }),
    email: z.string().email({ message: "Por favor, introduce un correo electrónico válido." }).optional().or(z.literal("")),
    phone: z.string().optional(),
    service: z.string().min(1, { message: "Por favor, selecciona al menos un servicio." }),
    date: z.string({ required_error: "Por favor, selecciona una fecha." }),
    time: z.string({ required_error: "Por favor, selecciona una hora." }),
});

const blockTimeSchema = z.object({
    barberId: z.string().min(1, { message: "Por favor, selecciona un barbero." }),
    date: z.string({ required_error: "Por favor, selecciona una fecha." }),
    time: z.string({ required_error: "Por favor, selecciona una hora de inicio." }),
    endTime: z.string({ required_error: "Por favor, selecciona una hora de fin." }),
    name: z.string().min(3, { message: "La descripción es muy corta." }),
    recurrence: z.enum(["none", "weekly", "daily"]).default("none"),
}).refine(data => {
    const start = timeToMinutes(data.time);
    const end = timeToMinutes(data.endTime);
    return start !== -1 && end !== -1 && end > start;
}, {
    message: "La hora de fin debe ser posterior a la hora de inicio.",
    path: ["endTime"],
});


// Updated schema to be more flexible
const transactionSchema = z.object({
    type: z.enum(["sale", "expense"], { required_error: "Selecciona el tipo de transacción." }),
    paymentMethod: z.enum(["cash", "card", "transfer"], { required_error: "Selecciona un método de pago." }),
    // Manual entries will have these
    amount: z.coerce.number().positive({ message: "El monto debe ser un número positivo." }).optional(),
    description: z.string().min(3, { message: "La descripción debe tener al menos 3 caracteres." }).optional(),
    // Product sales will have this
    productId: z.string().optional(),
});


const productSchema = z.object({
    id: z.string().optional(), // For updates
    name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
    description: z.string().optional(),
    sellingPrice: z.coerce.number().positive({ message: "El precio de venta debe ser positivo." }),
    stock: z.coerce.number().int().min(0, { message: "El stock no puede ser negativo." }),
});

const customerSchema = z.object({
    name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
    email: z.string().email({ message: "Por favor, introduce un correo electrónico válido." }),
    phone: z.string().optional(),
});

const notificationSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(5, { message: "El título debe tener al menos 5 caracteres." }),
    description: z.string().min(10, { message: "La descripción debe tener al menos 10 caracteres." }),
});



// Static fallback for barber emails to ensure reliability
const staticBarberEmails: { [key: string]: string } = {
    "alan": "stuntpk123@gmail.com",
    "alan-martinez": "stuntpk123@gmail.com",
    "jose-samudio": "Jjoseadrian261103@gmail.com",
    "juan-pablo-castillo": "juancastillo723777@gmail.com",
};


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

// In-memory store for rate limiting
const ipRequestStore: Map<string, number[]> = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_REQUESTS_PER_WINDOW = 20; // Allow 20 attempts per hour

function parseSafeDate(rawDate: any): Date {
    if (!rawDate) return new Date();
    if (typeof rawDate?.toDate === 'function') {
        try {
            const d = rawDate.toDate();
            if (d instanceof Date && !isNaN(d.getTime())) return d;
        } catch (e) {
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

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const requests = ipRequestStore.get(ip) || [];

    // Filter out requests that are older than the window
    const recentRequests = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);

    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
        return false; // Rate limit exceeded
    }

    // Add current request timestamp and update the store
    recentRequests.push(now);
    ipRequestStore.set(ip, recentRequests);

    return true; // Request is within limits
}

function sanitizeInput(str: any): string {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>?/gm, '').trim();
}

export async function bookAppointment(prevState: any, formData: FormData) {
    let ip = '127.0.0.1';
    try {
        const headersList = await headers();
        const rawIp = headersList.get('x-forwarded-for')?.split(',')[0] || headersList.get('x-real-ip') || '127.0.0.1';
        ip = rawIp.trim();
    } catch {
        // Safe fallback when called outside request scope (e.g. tests or worker)
        ip = '127.0.0.1';
    }

    // Rate Limiting Check
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

    // Distributed concurrency lock for the requested slot
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

            // Calculate duration safely using dynamic services
            const totalDuration = getServiceDuration(serviceIds, activeServices);

            // Calculate start and end minutes
            const newStart = timeToMinutes(time);
            if (newStart === -1) {
                throw new Error("El formato de hora de la cita no es válido.");
            }

            const newEnd = newStart + totalDuration;
            const endTime = minutesToTimeStr(newEnd);

            // Validate business hours (8:00 AM = 480 min, 9:00 PM = 1260 min)
            if (newStart < 480) {
                throw new Error("La cita es anterior al horario de apertura (8:00 AM).");
            }
            if (newEnd > 1260) {
                throw new Error("La cita excede el horario de cierre (9:00 PM). Por favor elige un horario más temprano.");
            }

            // Validate that the appointment date and time is not in the past (America/Bogota timezone)
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

            // Create a lock document reference for this specific day and barber
            // Reading and writing to this lock forces Firestore to retry the transaction 
            // if another client books concurrently, solving the double-booking race condition.
            // We use the 'appointments' collection to avoid permission errors.
            const lockRef = doc(db, "appointments", `lock_${barberId}_${date}`);
            const lockDoc = await transaction.get(lockRef);

            const dayAppointmentsQuery = query(
                collection(db, "appointments"),
                where("barberId", "==", barberId),
                where("date", "==", date)
            );

            // getDocs is not isolated in Web SDK transactions, but because we modify the lockRef,
            // the transaction will retry if another booking happens at the exact same time.
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

                // Infallible interval overlap check: max(StartA, StartB) < min(EndA, EndB)
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
                endTime: endTime, // Save endTime!
            };

            transaction.set(newAppointmentRef, appointmentPayload);
            // Update the lock to trigger concurrency control
            transaction.set(lockRef, { 
                type: 'lock', 
                lastUpdated: new Date() 
            }, { merge: true });

            // Create or update customer profile
            if (clientEmail) {
                const customerQuery = query(collection(db, "customers"), where("email", "==", clientEmail));
                const customerSnapshot = await getDocs(customerQuery);

                if (customerSnapshot.empty) {
                    // New customer, create a profile
                    const newCustomerRef = doc(collection(db, "customers"));
                    transaction.set(newCustomerRef, {
                        name,
                        email: clientEmail,
                        phone: phone || null,
                        createdAt: new Date(),
                    });
                } else {
                    // Existing customer, update info if necessary
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

        // --- Shared variables for WhatsApp and Email ---
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
            whatsappUrl = "https://wa.link/rxl87s"; // Fallback if barber has no whatsapp
        }

        // --- Email Sending Logic ---
        const GMAIL_USER = process.env.GMAIL_USER || 'barbalargacitas@gmail.com';
        const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');

        if (GMAIL_USER && GMAIL_APP_PASSWORD) {
            try {
                const transporter = nodemailer.createTransport({
                    host: 'smtp.gmail.com',
                    port: 465,
                    secure: true,
                    auth: {
                        user: GMAIL_USER,
                        pass: GMAIL_APP_PASSWORD,
                    },
                    tls: {
                        rejectUnauthorized: false,
                    },
                });

                // Texto plano (obligatorio para evitar spam)
                const clientTextContent = `Cita Confirmada - Barba Larga

Hola ${name}, tu cita ha sido agendada con éxito.

Barbero: ${barber.name}
Fecha: ${formattedDate}
Hora: ${time}
Servicios: ${serviceNames}
Total: $${totalPrice.toLocaleString('es-CO')}

Dirección: ${barbershopAddress}
Maps: ${directionsUrl}
WhatsApp: ${whatsappUrl}

Barba Larga - Popayán, Colombia`;

                const clientEmailHtml = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Confirmacion de Cita</title>
            </head>
            <body style="margin:0;padding:0;background-color:#121212;font-family:Arial,sans-serif;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#121212;">
                <tr><td align="center" style="padding:20px 0;">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1e1e1e;border:1px solid #39FF14;border-radius:8px;overflow:hidden;">
                    <tr>
                        <td style="padding:30px;color:#e0e0e0;">
                            <h1 style="color:#39FF14;font-size:24px;margin:0 0 10px;text-align:center;text-transform:uppercase;letter-spacing:1px;">Cita Confirmada</h1>
                            <p style="text-align:center;font-size:16px;margin:0 0 20px;">Hola <strong>${name}</strong>, tu cita en <strong>Barba Larga</strong> con <strong>${barber.name}</strong> ha sido agendada.</p>
                            
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#2a2a2a;border-left:4px solid #39FF14;border-radius:4px;margin:20px 0;">
                                <tr><td style="padding:20px;">
                                    <p style="margin:0 0 8px;font-size:16px;color:#fff;"><span style="color:#39FF14;font-weight:bold;">Barbero:</span> ${barber.name}</p>
                                    <p style="margin:0 0 8px;font-size:16px;color:#fff;"><span style="color:#39FF14;font-weight:bold;">Fecha:</span> ${formattedDate}</p>
                                    <p style="margin:0 0 8px;font-size:16px;color:#fff;"><span style="color:#39FF14;font-weight:bold;">Hora:</span> ${time}</p>
                                    <p style="margin:0 0 8px;font-size:16px;color:#fff;"><span style="color:#39FF14;font-weight:bold;">Servicios:</span> ${serviceNames}</p>
                                    <p style="margin:0;font-size:18px;color:#39FF14;font-weight:bold;">Total: $${totalPrice.toLocaleString('es-CO')}</p>
                                </td></tr>
                            </table>

                            <table width="100%" cellpadding="0" cellspacing="0"><tr>
                                <td align="center" style="padding:10px 0;">
                                    <a href="${directionsUrl}" target="_blank" style="background-color:#39FF14;color:#121212;padding:12px 25px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">COMO LLEGAR</a>
                                </td>
                            </tr><tr>
                                <td align="center" style="padding:10px 0;">
                                    <a href="${whatsappUrl}" target="_blank" style="background-color:#25D366;color:#ffffff;padding:12px 25px;text-decoration:none;border-radius:5px;font-weight:bold;display:inline-block;">WHATSAPP</a>
                                </td>
                            </tr></table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color:#1a1a1a;color:#888;padding:15px;text-align:center;font-size:12px;">
                            Barba Larga - Popayan, Colombia
                        </td>
                    </tr>
                </table>
                </td></tr>
                </table>
            </body>
            </html>
            `;

                if (clientEmail) {
                    await transporter.sendMail({
                        from: GMAIL_USER,
                        to: clientEmail,
                        subject: `Confirmacion de Cita - Barba Larga - ${formattedDate}`,
                        text: clientTextContent,
                        html: clientEmailHtml,
                    });
                }

                const barberEmail = barber.email || staticBarberEmails[barberId] || null;
                const ADMIN_EMAIL = 'stuntpk123@gmail.com';
                const notificationRecipients = [ADMIN_EMAIL];
                if (barberEmail && barberEmail !== ADMIN_EMAIL) {
                    notificationRecipients.push(barberEmail);
                }

                const adminText = `Nueva Reserva - Barba Larga

Barbero: ${barber.name}
Cliente: ${name}
Email: ${clientEmail || 'No proporcionado'}
${phone ? `Telefono: ${phone}` : ''}
Fecha: ${formattedDate}
Hora: ${time}
Duracion: ${totalDuration} min
Servicios: ${serviceNames}
Total: $${totalPrice.toLocaleString('es-CO')}`;

                const adminHtml = `
                <div style="font-family:Arial,sans-serif;line-height:1.6;max-width:600px;">
                    <h2 style="color:#333;">Nueva Reserva Recibida</h2>
                    <p>Se ha agendado una nueva cita.</p>
                    <table style="border-collapse:collapse;width:100%;">
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Barbero</td><td style="padding:8px;border-bottom:1px solid #eee;">${barber.name}</td></tr>
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Cliente</td><td style="padding:8px;border-bottom:1px solid #eee;">${name}</td></tr>
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${clientEmail || 'No proporcionado'}</td></tr>
                        ${phone ? `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Telefono</td><td style="padding:8px;border-bottom:1px solid #eee;">${phone}</td></tr>` : ''}
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Fecha</td><td style="padding:8px;border-bottom:1px solid #eee;">${formattedDate}</td></tr>
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Hora</td><td style="padding:8px;border-bottom:1px solid #eee;">${time}</td></tr>
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Duracion</td><td style="padding:8px;border-bottom:1px solid #eee;">${totalDuration} min</td></tr>
                        <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Servicios</td><td style="padding:8px;border-bottom:1px solid #eee;">${serviceNames}</td></tr>
                        <tr><td style="padding:8px;font-weight:bold;">Total</td><td style="padding:8px;">$${totalPrice.toLocaleString('es-CO')}</td></tr>
                    </table>
                </div>`;

                await transporter.sendMail({
                    from: GMAIL_USER,
                    to: notificationRecipients,
                    subject: `Nueva Reserva: ${name} - ${formattedDate}`,
                    text: adminText,
                    html: adminHtml,
                });

                if (!barberEmail) {
                    await updateDoc(newAppointmentRef, {
                        adminNotes: `Notificacion enviada solo al administrador. El barbero ${barber.name} no tiene correo configurado.`
                    });
                }

            } catch (emailError) {
                console.error("Error sending email(s) via Nodemailer:", emailError);
                await logSystemEvent({
                    level: 'critical',
                    source: 'email',
                    action: 'sendAppointmentConfirmationEmail',
                    message: `Fallo al enviar correo de confirmación de cita a ${clientEmail || 'cliente'}`,
                    error: emailError,
                    metadata: {
                        clientName: name,
                        clientEmail,
                        barberName: barber.name,
                        date,
                        time,
                    }
                });
                if (newAppointmentRef.path) {
                    await updateDoc(newAppointmentRef, {
                        adminNotes: `Failed to send email notification. Error: ${emailError instanceof Error ? emailError.message : String(emailError)}`
                    });
                }
            }
        } else if (newAppointmentRef.path) {
            await updateDoc(newAppointmentRef, {
                adminNotes: `Email notifications not sent because GMAIL_USER or GMAIL_APP_PASSWORD are not set in environment.`
            });
        }

        const successMessage = `¡Reserva confirmada! Tu cita para el ${date} a las ${time} ha sido agendada.`;

        try {
            revalidatePath('/admin');
            revalidatePath('/');
        } catch {}

        return {
            success: true,
            message: successMessage,
            whatsappUrl
        };
    } catch (error) {
        console.error("Error booking appointment:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
        await logSystemEvent({
            level: 'error',
            source: 'backend',
            action: 'bookAppointment',
            message: `Fallo al agendar cita: ${errorMessage}`,
            error,
            metadata: {
                name,
                clientEmail,
                phone,
                date,
                time,
                barberId
            }
        });
        return {
            success: false,
            message: `Ocurrió un error al procesar la solicitud. ${errorMessage}`
        };
    } finally {
        if (lockResult?.token) {
            await releaseLock(slotLockKey, lockResult.token);
        }
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
            revalidatePath('/admin');
            revalidatePath('/');
        } catch {}

        return { success: true, message: "Cita y venta asociada eliminadas con éxito." };

    } catch (error) {
        console.error("Error deleting appointment and associated sale:", error);
        return { success: false, message: "Ocurrió un error al cancelar la cita." };
    }
}

export async function deleteBlockedSlot(slotId: string): Promise<{ success: boolean; message: string }> {
    if (!slotId) {
        return { success: false, message: "ID del bloqueo no es válido." };
    }
    try {
        await deleteDoc(doc(db, "appointments", slotId));
        try {
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
            revalidatePath('/admin');
            revalidatePath('/');
        } catch {}

        return { success: true, message: `${querySnapshot.size} horario(s) bloqueado(s) para este barbero ha(n) sido eliminado(s) con éxito.` };

    } catch (error) {
        console.error("Error deleting all blocked slots:", error);
        return { success: false, message: "Ocurrió un error al eliminar los horarios bloqueados." };
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

            // Find and delete all associated transactions
            const transactionsQuery = query(collection(db, "transactions"), where("appointmentId", "==", appointmentId));
            const transactionsSnapshot = await getDocs(transactionsQuery);
            transactionsSnapshot.docs.forEach(tDoc => {
                transaction.delete(tDoc.ref);
            });

            // Update the appointment status
            transaction.update(appointmentRef, { status: 'pending' });
        });

        try {
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

                // Block every 10-minute slot within [startMin, endMin) for basic UI helpers
                const firstBlocked = Math.floor(startMin / 10) * 10;
                const lastBlocked = Math.ceil(endMin / 10) * 10;

                for (let t = firstBlocked; t < lastBlocked; t += 10) {
                    blockedMinutes.add(t);
                }
            }
        });

        // Convert blocked minutes to formatted time strings
        const blocked: string[] = [];
        blockedMinutes.forEach(m => {
            if (m >= 8 * 60 && m <= 20 * 60 + 50) {
                blocked.push(minutesToTimeStr(m));
            }
        });

        // Compute smart gap slots against exact continuous intervals
        const gapSet = new Set<string>();
        const MIN_GAP = MIN_GAP_MINUTES || 20;

        for (const apt of appointments) {
            const gapStart = apt.endMin;
            // Only consider gaps within operating hours (8:00 AM to 8:50 PM)
            if (gapStart >= 8 * 60 && gapStart <= 20 * 60 + 50) {
                // Check that gapStart does NOT fall inside any other appointment
                const isOverlapping = appointments.some(other => gapStart >= other.startMin && gapStart < other.endMin);
                if (!isOverlapping) {
                    // Check if there is at least MIN_GAP minutes before the next appointment or closing time (9:00 PM = 1260)
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

const convertTimeTo24Hour = (time: string): string => {
    if (!time) return "00:00";
    const min = timeToMinutes(time);
    if (min === -1) return "00:00";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export async function getAllAppointments(): Promise<Appointment[]> {
    try {
        const today = new Date();
        const threeMonthsAgo = subMonths(today, 3);
        const startDateString = format(threeMonthsAgo, "yyyy-MM-dd");

        const appointmentsCol = collection(db, "appointments");

        const q = query(appointmentsCol, where("date", ">=", startDateString));

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
                barberId: data.barberId || 'alan-martinez', // Fallback for old appointments
                barberEmail: data.barberEmail || null,
                type: data.type || 'appointment',
            } as Appointment;
        });

        // Sort by date (desc) and then time (asc)
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


export async function confirmAppointmentAsSale(appointmentId: string, paymentMethod: 'cash' | 'card' | 'transfer'): Promise<{ success: boolean; message: string }> {
    if (!appointmentId || !paymentMethod) {
        return { success: false, message: "Datos inválidos." };
    }

    try {
        const dbServices = await getServicesFromDB();
        const activeServices = dbServices || [];

        await runTransaction(db, async (transaction) => {
            const appointmentRef = doc(db, "appointments", appointmentId);
            const appointmentDoc = await transaction.get(appointmentRef);

            if (!appointmentDoc.exists()) {
                throw new Error("La cita no fue encontrada.");
            }

            const appointmentData = appointmentDoc.data();

            if (appointmentData.status === 'completed') {
                throw new Error("Esta cita ya ha sido marcada como completada.");
            }

            const { names: serviceNames, totalPrice: totalAmount } = getServiceDetails(appointmentData.service, activeServices);

            if (totalAmount <= 0) {
                throw new Error("El monto del servicio es cero o inválido.");
            }

            // 1. Create the transaction document
            const saleData = {
                type: 'sale',
                amount: totalAmount,
                description: `Venta de servicios: ${serviceNames}`,
                paymentMethod,
                date: new Date(),
                appointmentId: appointmentId, // Link transaction to the appointment
            };
            const transactionRef = doc(collection(db, "transactions"));
            transaction.set(transactionRef, saleData);

            // 2. Update the appointment status
            transaction.update(appointmentRef, { status: 'completed' });
        });

        try {
            revalidatePath('/admin');
            revalidatePath('/');
        } catch {}

        return { success: true, message: "Venta confirmada y registrada con éxito." };

    } catch (error) {
        console.error("Error confirming appointment sale:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
        return { success: false, message: `Error al confirmar la venta: ${errorMessage}` };
    }
}


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


// --- Cash Flow Actions ---

export type Transaction = {
    id: string;
    type: 'sale' | 'expense';
    amount: number;
    description: string;
    paymentMethod: 'cash' | 'card' | 'transfer';
    date: Date;
    productId?: string;
    appointmentId?: string;
};

export async function addTransaction(prevState: any, formData: FormData) {
    try {
        await requireAdminSession();
    } catch {
        return { success: false, message: "No autorizado. Requiere permisos de administrador." };
    }

    const validatedFields = transactionSchema.safeParse({
        type: formData.get("type"),
        paymentMethod: formData.get("paymentMethod"),
        amount: formData.get("amount") ? Number(formData.get("amount")) : undefined,
        description: formData.get("description") as string || undefined,
        productId: formData.get("productId") as string || undefined,
    });

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Datos de formulario inválidos.",
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    const { type, paymentMethod, productId, amount, description } = validatedFields.data;

    if (type === 'sale' && !productId && !description) {
        return { success: false, message: "Para una venta manual, la descripción es obligatoria." };
    }
    if (type === 'expense' && !description) {
        return { success: false, message: "Para un gasto, la descripción es obligatoria." };
    }
    if ((type === 'expense' || (type === 'sale' && !productId)) && (!amount || amount <= 0)) {
        return { success: false, message: "El monto debe ser un número positivo para registros manuales." };
    }


    try {
        await runTransaction(db, async (transaction) => {
            let transactionData: any = {
                type,
                paymentMethod,
                date: new Date(),
            };

            if (type === 'sale' && productId && productId !== 'manual') {
                const productRef = doc(db, "products", productId);
                const productDoc = await transaction.get(productRef);

                if (!productDoc.exists()) {
                    throw new Error("El producto seleccionado no existe.");
                }

                const productData = productDoc.data();
                const currentStock = productData.stock;
                const newStock = currentStock - 1;

                if (newStock < 0) {
                    throw new Error(`No hay suficiente stock para '${productData.name}'.`);
                }

                transactionData.amount = productData.sellingPrice;
                transactionData.description = `Venta de producto: ${productData.name}`;
                transactionData.productId = productId;

                transaction.update(productRef, { stock: newStock });

            } else {
                if (!amount || !description) {
                    throw new Error("Monto y descripción son requeridos para esta transacción.");
                }
                transactionData.amount = amount;
                transactionData.description = description;
            }

            const transactionRef = doc(collection(db, "transactions"));
            transaction.set(transactionRef, transactionData);
        });

        return { success: true, message: `Transacción de '${type}' registrada con éxito.` };
    } catch (error) {
        console.error("Error adding transaction:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
        return {
            success: false,
            message: `Error al registrar la transacción: ${errorMessage}`
        };
    }
}

export async function deleteTransaction(transactionId: string): Promise<{ success: boolean, message: string }> {
    if (!transactionId) {
        return { success: false, message: "ID de la transacción no es válido." };
    }

    try {
        await runTransaction(db, async (firestoreTransaction) => {
            const transactionRef = doc(db, "transactions", transactionId);
            const transactionDoc = await firestoreTransaction.get(transactionRef);

            if (!transactionDoc.exists()) {
                throw new Error("La transacción no fue encontrada.");
            }

            const transactionData = transactionDoc.data() as Transaction;

            if (transactionData.type === 'sale' && transactionData.productId) {
                const productRef = doc(db, "products", transactionData.productId);
                const productDoc = await firestoreTransaction.get(productRef);

                if (productDoc.exists()) {
                    const currentStock = productDoc.data().stock;
                    firestoreTransaction.update(productRef, { stock: currentStock + 1 });
                } else {
                    console.warn(`Attempted to restock product ${transactionData.productId} which no longer exists.`);
                }
            }

            if (transactionData.appointmentId) {
                const appointmentRef = doc(db, "appointments", transactionData.appointmentId);
                const appointmentDoc = await firestoreTransaction.get(appointmentRef);

                if (appointmentDoc.exists() && appointmentDoc.data().status === 'completed') {
                    firestoreTransaction.update(appointmentRef, { status: 'pending' });
                } else {
                    console.warn(`Attempted to revert status for appointment ${transactionData.appointmentId} which no longer exists or wasn't completed.`);
                }
            }

            firestoreTransaction.delete(transactionRef);
        });

        return { success: true, message: "Transacción eliminada con éxito. El estado y el stock han sido ajustados si fue necesario." };

    } catch (error) {
        console.error("Error deleting transaction:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocurrió un error al eliminar la transacción.";
        return { success: false, message: `Error al eliminar la transacción: ${errorMessage}` };
    }
}


export async function getRecentTransactions(): Promise<Transaction[]> {
    try {
        const transactionsCol = collection(db, "transactions");
        const q = query(transactionsCol, orderBy("date", "desc"), limit(50));

        const querySnapshot = await getDocs(q);

        const transactions = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: parseSafeDate(data.date),
            } as Transaction;
        });

        return transactions;

    } catch (error) {
        console.error('Error fetching recent transactions:', error);
        return [];
    }
}

export type FinancialSummary = {
    todayStats: { revenue: number; salesCount: number };
    thisWeekStats: { revenue: number; salesCount: number };
    thisMonthStats: { revenue: number; salesCount: number };
    last30Days: {
        totalRevenue: number;
        totalExpenses: number;
        netProfit: number;
    };
    revenueByMethod: { method: string; total: number }[];
    chartData: { date: string; revenue: number; expenses: number }[];
};


export async function getFinancialSummary(): Promise<FinancialSummary> {
    const emptySummary: FinancialSummary = {
        todayStats: { revenue: 0, salesCount: 0 },
        thisWeekStats: { revenue: 0, salesCount: 0 },
        thisMonthStats: { revenue: 0, salesCount: 0 },
        last30Days: { totalRevenue: 0, totalExpenses: 0, netProfit: 0 },
        revenueByMethod: [],
        chartData: [],
    };

    try {
        const today = new Date();
        const thirtyDaysAgo = startOfDay(subDays(today, 29));

        const transactionsCol = collection(db, "transactions");
        const q = query(transactionsCol, where("date", ">=", thirtyDaysAgo));
        const querySnapshot = await getDocs(q);

        const transactions: Transaction[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                date: parseSafeDate(data.date),
            } as Transaction;
        });

        const todayStats = { revenue: 0, salesCount: 0 };
        const thisWeekStats = { revenue: 0, salesCount: 0 };
        const thisMonthStats = { revenue: 0, salesCount: 0 };

        let last30DaysRevenue = 0;
        let last30DaysExpenses = 0;

        const revenueByMethod: Record<string, number> = { cash: 0, card: 0, transfer: 0 };
        const dailyData: Record<string, { revenue: number, expenses: number }> = {};

        for (let i = 0; i < 30; i++) {
            const date = subDays(today, i);
            const formattedDate = format(date, "d MMM", { locale: es });
            dailyData[formattedDate] = { revenue: 0, expenses: 0 };
        }

        const weekInterval = { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) };
        const monthInterval = { start: startOfMonth(today), end: endOfMonth(today) };


        transactions.forEach(tx => {
            const amt = Number(tx.amount) || 0;
            if (tx.type === 'sale') {
                if (isTodayDateFns(tx.date)) {
                    todayStats.revenue += amt;
                    todayStats.salesCount += 1;
                }
                if (isWithinInterval(tx.date, weekInterval)) {
                    thisWeekStats.revenue += amt;
                    thisWeekStats.salesCount += 1;
                }
                if (isWithinInterval(tx.date, monthInterval)) {
                    thisMonthStats.revenue += amt;
                    thisMonthStats.salesCount += 1;
                }
            }

            if (tx.type === 'sale') {
                last30DaysRevenue += amt;
                const method = tx.paymentMethod || 'cash';
                revenueByMethod[method] = (revenueByMethod[method] || 0) + amt;
            } else {
                last30DaysExpenses += amt;
            }

            const formattedDate = format(tx.date, "d MMM", { locale: es });
            if (dailyData[formattedDate]) {
                if (tx.type === 'sale') {
                    dailyData[formattedDate].revenue += amt;
                } else {
                    dailyData[formattedDate].expenses += amt;
                }
            }
        });

        const chartData = Object.keys(dailyData).map(date => ({
            date,
            revenue: dailyData[date].revenue,
            expenses: dailyData[date].expenses,
        })).reverse();

        return {
            todayStats,
            thisWeekStats,
            thisMonthStats,
            last30Days: {
                totalRevenue: last30DaysRevenue,
                totalExpenses: last30DaysExpenses,
                netProfit: last30DaysRevenue - last30DaysExpenses,
            },
            revenueByMethod: Object.entries(revenueByMethod).map(([method, total]) => ({ method, total })),
            chartData,
        };

    } catch (error) {
        console.error('Error fetching financial summary:', error);
        return emptySummary;
    }
}


// --- Inventory Actions ---

export type Product = {
    id: string;
    name: string;
    description?: string;
    sellingPrice: number;
    stock: number;
    createdAt: Date;
};

const createSlug = (name: string) => {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};


export async function addProduct(prevState: any, formData: FormData) {
    const validatedFields = productSchema.safeParse({
        name: formData.get("name"),
        description: formData.get("description"),
        sellingPrice: formData.get("sellingPrice"),
        stock: formData.get("stock"),
    });

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Por favor, corrige los errores en el formulario.",
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    try {
        const { name, ...rest } = validatedFields.data;
        const productId = createSlug(name);

        const productRef = doc(db, "products", productId);
        const productDoc = await getDoc(productRef);

        if (productDoc.exists()) {
            return {
                success: false,
                message: `Un producto con el nombre '${name}' ya existe. Por favor, elige un nombre diferente.`
            };
        }

        const productData = {
            name,
            ...rest,
            createdAt: new Date(),
        };

        await setDoc(productRef, productData);

        return { success: true, message: `Producto '${name}' añadido con éxito.` };
    } catch (error) {
        console.error("Error adding product:", error);
        return {
            success: false,
            message: "Ocurrió un error al añadir el producto."
        };
    }
}

export async function updateProduct(prevState: any, formData: FormData) {
    const validatedFields = productSchema.safeParse({
        id: formData.get("id"),
        name: formData.get("name"),
        description: formData.get("description"),
        sellingPrice: formData.get("sellingPrice"),
        stock: formData.get("stock"),
    });

    if (!validatedFields.success) {
        return {
            success: false,
            message: "Por favor, corrige los errores.",
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }
    const { id, ...productData } = validatedFields.data;

    if (!id) {
        return { success: false, message: "ID del producto no encontrado." };
    }

    try {
        const productRef = doc(db, "products", id);
        await updateDoc(productRef, productData);
        return { success: true, message: "Producto actualizado con éxito." };
    } catch (error) {
        console.error("Error updating product:", error);
        return { success: false, message: "No se pudo actualizar el producto." };
    }
}

export async function deleteProduct(productId: string): Promise<{ success: boolean, message: string }> {
    if (!productId) {
        return { success: false, message: "ID del producto no es válido." };
    }
    try {
        await deleteDoc(doc(db, "products", productId));
        return { success: true, message: "Producto eliminado con éxito." };
    } catch (error) {
        console.error("Error deleting product:", error);
        return { success: false, message: "Ocurrió un error al eliminar el producto." };
    }
}


export async function getProducts(): Promise<Product[]> {
    try {
        const productsCol = collection(db, "products");
        const q = query(productsCol, orderBy("createdAt", "desc"));

        const querySnapshot = await getDocs(q);

        const products = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: parseSafeDate(data.createdAt),
            } as Product;
        });

        return products;

    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}


// --- Customer Analytics Actions ---

type CustomerAppointment = Omit<Appointment, 'id' | 'barberEmail' | 'createdAt'> & {
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

        return { success: true, message: `${querySnapshot.size} cliente(s) eliminado(s) con éxito.` };

    } catch (error) {
        console.error("Error deleting customers:", error);
        return { success: false, message: "Ocurrió un error al eliminar los clientes." };
    }
}


export async function getCustomerAnalytics(): Promise<CustomerAnalytics[]> {
    try {
        const dbServices = await getServicesFromDB();
        const activeServices = dbServices || [];

        const appointmentsCol = collection(db, "appointments");
        const customersCol = collection(db, "customers");

        const appointmentsQuery = query(appointmentsCol, orderBy("date", "desc"));
        const manualCustomersQuery = query(customersCol);

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


// --- Team Management Actions ---
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


// --- Notification Actions ---

export type Notification = {
    id: string;
    title: string;
    description: string;
    createdAt: Date;
};

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

// --- Telemetry & System Logs Actions ---

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
                version: data.version || 'v2.0',
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

















