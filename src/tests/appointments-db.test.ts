import { describe, it, expect } from 'vitest';
import { getAllAppointments, getAvailableTimesForDate } from '@/app/actions';

describe('Appointments Live Firestore Integration', () => {
    it('should successfully fetch all appointments without errors', async () => {
        const appointments = await getAllAppointments();
        expect(Array.isArray(appointments)).toBe(true);
        console.log(`Live Firestore Appointments found: ${appointments.length}`);
        if (appointments.length > 0) {
            const first = appointments[0];
            console.log('Sample appointment:', {
                id: first.id,
                name: first.name,
                date: first.date,
                time: first.time,
                barberId: first.barberId,
                status: first.status,
                type: first.type
            });
            expect(first).toHaveProperty('id');
            expect(first).toHaveProperty('date');
            expect(first).toHaveProperty('time');
            expect(first).toHaveProperty('barberId');
        }
    }, 15000);

    it('should query available times for a barber and date without throwing', async () => {
        const todayStr = new Date().toISOString().split('T')[0];
        const result = await getAvailableTimesForDate(todayStr, 'alan-martinez');
        expect(result).toHaveProperty('blocked');
        expect(result).toHaveProperty('gaps');
        expect(result).toHaveProperty('intervals');
        expect(Array.isArray(result.blocked)).toBe(true);
    }, 15000);
});
