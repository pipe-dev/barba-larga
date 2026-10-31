import nodemailer from 'nodemailer';
import { logSystemEvent } from '@/lib/telemetry';
import { updateDoc } from 'firebase/firestore';

const staticBarberEmails: Record<string, string> = {
    "alan-valencia": "alanvalencia170@gmail.com",
    "stiven-muñoz": "jhonm3584@gmail.com",
    "jose-samudio": "Jjoseadrian261103@gmail.com",
};

export interface SendConfirmationEmailParams {
    name: string;
    clientEmail: string | null;
    phone?: string;
    barber: { name: string; email?: string | null };
    barberId: string;
    date: string;
    formattedDate: string;
    time: string;
    serviceNames: string;
    totalDuration: number;
    totalPrice: number;
    barbershopAddress: string;
    directionsUrl: string;
    whatsappUrl: string;
    newAppointmentRef?: any;
}

export async function sendAppointmentConfirmationEmail(params: SendConfirmationEmailParams): Promise<{ success: boolean; error?: unknown }> {
    const {
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
    } = params;

    const GMAIL_USER = process.env.GMAIL_USER || 'barbalargacitas@gmail.com';
    const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
        console.warn("Nodemailer: GMAIL_USER or GMAIL_APP_PASSWORD not configured. Email sending skipped.");
        return { success: false, error: "Credenciales de Gmail no configuradas." };
    }

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

        if (!barberEmail && newAppointmentRef) {
            try {
                await updateDoc(newAppointmentRef, {
                    adminNotes: `Notificacion enviada solo al administrador. El barbero ${barber.name} no tiene correo configurado.`
                });
            } catch (err) {
                console.warn("Could not update adminNotes for barber without email:", err);
            }
        }

        return { success: true };

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
        return { success: false, error: emailError };
    }
}
