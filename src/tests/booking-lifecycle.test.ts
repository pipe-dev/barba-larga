import { describe, it, expect, beforeAll } from 'vitest';
import { bookAppointment, getAllAppointments, deleteAppointment, getAvailableTimesForDate, getTeam } from '@/app/actions';

describe('Booking End-to-End Database Lifecycle', () => {
    let createdAptId: string | null = null;
    const testDate = '2026-12-25'; // Far future date
    const testTime = '11:00 AM';
    let testBarberId = '';

    beforeAll(async () => {
        const team = await getTeam();
        expect(team.length).toBeGreaterThan(0);
        testBarberId = team[0].id;
        console.log('Using active barber for test:', team[0].name, 'ID:', testBarberId);
    });

    it('should successfully book an appointment and persist it to Firestore', async () => {
        const formData = new FormData();
        formData.append('name', 'Test Verification Client');
        formData.append('email', 'testclient@barbalarga.com');
        formData.append('phone', '3001234567');
        formData.append('service', 'haircut');
        formData.append('date', testDate);
        formData.append('time', testTime);
        formData.append('barberId', testBarberId);

        const result = await bookAppointment(null, formData);
        console.log('BookAppointment result:', result);
        expect(result.success).toBe(true);
        expect(result.message).toContain('¡Reserva confirmada!');

        // Query Firestore to verify it appears in getAllAppointments
        const allApts = await getAllAppointments();
        const found = allApts.find(a => a.date === testDate && a.time === testTime && a.barberId === testBarberId);
        expect(found).toBeDefined();
        if (found) {
            createdAptId = found.id;
            console.log('Found created appointment in Firestore:', found);
            expect(found.name).toBe('Test Verification Client');
            expect(found.service).toBe('haircut');
            expect(found.status).toBe('pending');
        }
    }, 20000);

    it('should reflect the slot as booked in getAvailableTimesForDate', async () => {
        const avail = await getAvailableTimesForDate(testDate, testBarberId);
        console.log('Available times intervals:', avail.intervals);
        const isOccupied = avail.intervals.some(i => i.startMin === 11 * 60);
        expect(isOccupied).toBe(true);
    }, 15000);

    it('should successfully delete/cancel the test appointment and clean up Firestore', async () => {
        if (createdAptId) {
            const delResult = await deleteAppointment(createdAptId);
            expect(delResult.success).toBe(true);
            console.log('Cleaned up test appointment:', delResult.message);
        }
    }, 15000);
});
