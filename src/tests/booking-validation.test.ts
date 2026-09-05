import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const phoneSchema = z.string({ required_error: "El número de teléfono es obligatorio." })
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
    barberId: z.string().min(1, { message: "Por favor, selecciona un barbero." }),
    name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres." }),
    email: z.string({ required_error: "El correo electrónico es obligatorio." })
        .trim()
        .email({ message: "Por favor, introduce un correo electrónico válido." }),
    phone: phoneSchema,
    service: z.string().min(1, { message: "Por favor, selecciona al menos un servicio." }),
    date: z.string({ required_error: "Por favor, selecciona una fecha." }),
    time: z.string({ required_error: "Por favor, selecciona una hora." }),
});

describe('bookingSchema Contact Validation', () => {
    const validBase = {
        barberId: 'alan',
        name: 'Carlos Mendoza',
        service: 'corte-clasico',
        date: '2026-09-10',
        time: '10:00 AM',
    };

    it('should reject when email is missing or empty', () => {
        const resultMissing = bookingSchema.safeParse({ ...validBase, phone: '3001234567' });
        expect(resultMissing.success).toBe(false);

        const resultEmpty = bookingSchema.safeParse({ ...validBase, email: '', phone: '3001234567' });
        expect(resultEmpty.success).toBe(false);
    });

    it('should reject invalid email formats', () => {
        const result = bookingSchema.safeParse({ ...validBase, email: 'not-an-email', phone: '3001234567' });
        expect(result.success).toBe(false);
    });

    it('should reject when phone is missing or empty', () => {
        const resultMissing = bookingSchema.safeParse({ ...validBase, email: 'test@example.com' });
        expect(resultMissing.success).toBe(false);

        const resultEmpty = bookingSchema.safeParse({ ...validBase, email: 'test@example.com', phone: '' });
        expect(resultEmpty.success).toBe(false);
    });

    it('should reject phone with fewer than 7 digits or invalid characters', () => {
        const resultShort = bookingSchema.safeParse({ ...validBase, email: 'test@example.com', phone: '123' });
        expect(resultShort.success).toBe(false);

        const resultAlpha = bookingSchema.safeParse({ ...validBase, email: 'test@example.com', phone: '300abc1234' });
        expect(resultAlpha.success).toBe(false);
    });

    it('should accept valid local and international phone numbers and valid email', () => {
        const validLocal = bookingSchema.safeParse({
            ...validBase,
            email: 'cliente@barbalarga.com',
            phone: '3001234567',
        });
        expect(validLocal.success).toBe(true);

        const validIntl = bookingSchema.safeParse({
            ...validBase,
            email: 'cliente.ext@gmail.com',
            phone: '+57 310 987 6543',
        });
        expect(validIntl.success).toBe(true);

        const validFormatted = bookingSchema.safeParse({
            ...validBase,
            email: 'carlos@yahoo.es',
            phone: '(601) 745-1234',
        });
        expect(validFormatted.success).toBe(true);
    });
});
