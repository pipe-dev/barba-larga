import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { timeToMinutes } from '@/lib/data';

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

describe('blockTimeSchema with Yearly Recurrence', () => {
    it('should validate yearly recurrence successfully', () => {
        const result = blockTimeSchema.safeParse({
            barberId: 'alan',
            date: '2026-09-06', // Sunday
            time: '08:00 AM',
            endTime: '09:00 PM',
            name: 'Descanso Dominical',
            recurrence: 'yearly',
        });
        expect(result.success).toBe(true);
    });

    it('should validate weekly, daily and none recurrences', () => {
        const resultWeekly = blockTimeSchema.safeParse({
            barberId: 'alan',
            date: '2026-09-06',
            time: '08:00 AM',
            endTime: '09:00 PM',
            name: 'Descanso',
            recurrence: 'weekly',
        });
        expect(resultWeekly.success).toBe(true);

        const resultDaily = blockTimeSchema.safeParse({
            barberId: 'alan',
            date: '2026-09-06',
            time: '08:00 AM',
            endTime: '09:00 PM',
            name: 'Descanso',
            recurrence: 'daily',
        });
        expect(resultDaily.success).toBe(true);

        const resultNone = blockTimeSchema.safeParse({
            barberId: 'alan',
            date: '2026-09-06',
            time: '08:00 AM',
            endTime: '09:00 PM',
            name: 'Descanso',
            recurrence: 'none',
        });
        expect(resultNone.success).toBe(true);
    });

    it('should reject if endTime is before or equal to start time', () => {
        const result = blockTimeSchema.safeParse({
            barberId: 'alan',
            date: '2026-09-06',
            time: '05:00 PM',
            endTime: '03:00 PM',
            name: 'Error time',
            recurrence: 'none',
        });
        expect(result.success).toBe(false);
    });
});
