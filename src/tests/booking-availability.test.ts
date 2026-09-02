import { describe, it, expect } from 'vitest';
import { 
    timeToMinutes, 
    minutesToTimeStr, 
    doIntervalsOverlap, 
    getServiceDuration, 
    getServiceDetails,
    type Service
} from '@/lib/data';

describe('Time Conversion Utilities', () => {
    it('should correctly parse standard 12-hour AM/PM formats', () => {
        expect(timeToMinutes('08:00 AM')).toBe(480);
        expect(timeToMinutes('8:00 AM')).toBe(480);
        expect(timeToMinutes('08:00AM')).toBe(480);
        expect(timeToMinutes('8:00AM')).toBe(480);
        expect(timeToMinutes('09:15 AM')).toBe(555);
        expect(timeToMinutes('9:15 AM')).toBe(555);
    });

    it('should correctly handle 12:00 PM (noon) and afternoon/night times', () => {
        expect(timeToMinutes('12:00 PM')).toBe(720);
        expect(timeToMinutes('12:30 PM')).toBe(750);
        expect(timeToMinutes('01:00 PM')).toBe(780);
        expect(timeToMinutes('1:00 PM')).toBe(780);
        expect(timeToMinutes('01:15 PM')).toBe(795);
        expect(timeToMinutes('08:00 PM')).toBe(1200);
        expect(timeToMinutes('09:00 PM')).toBe(1260);
    });

    it('should correctly handle 12:00 AM (midnight)', () => {
        expect(timeToMinutes('12:00 AM')).toBe(0);
        expect(timeToMinutes('12:30 AM')).toBe(30);
    });

    it('should return -1 for invalid or empty strings', () => {
        expect(timeToMinutes('')).toBe(-1);
        expect(timeToMinutes('invalid')).toBe(-1);
        expect(timeToMinutes('25:00 PM')).toBe(-1);
    });

    it('should convert minutes back to formatted time string', () => {
        expect(minutesToTimeStr(480)).toBe('08:00 AM');
        expect(minutesToTimeStr(555)).toBe('09:15 AM');
        expect(minutesToTimeStr(720)).toBe('12:00 PM');
        expect(minutesToTimeStr(795)).toBe('01:15 PM');
        expect(minutesToTimeStr(1260)).toBe('09:00 PM');
    });
});

describe('Continuous Interval Overlap Detection', () => {
    it('should detect overlap when intervals intersect', () => {
        expect(doIntervalsOverlap(480, 555, 540, 600)).toBe(true);
        expect(doIntervalsOverlap(480, 555, 510, 540)).toBe(true);
        expect(doIntervalsOverlap(480, 540, 480, 540)).toBe(true);
    });

    it('should NOT detect overlap for adjacent intervals (touching endpoints)', () => {
        expect(doIntervalsOverlap(480, 555, 555, 615)).toBe(false);
        expect(doIntervalsOverlap(555, 600, 600, 660)).toBe(false);
    });

    it('should NOT detect overlap for completely separate intervals', () => {
        expect(doIntervalsOverlap(480, 540, 600, 660)).toBe(false);
    });
});

const sampleServices: Service[] = [
    { id: 'haircut', name: 'Corte de cabello', description: '', price: '25000', duration: 60, mediaUrl: '', mediaType: 'image' },
    { id: 'haircut-beard', name: 'Corte de cabello con Barba', description: '', price: '35000', duration: 90, mediaUrl: '', mediaType: 'image' },
    { id: 'haircut-design', name: 'Corte de cabello con diseño', description: '', price: '30000', duration: 80, mediaUrl: '', mediaType: 'image' },
    { id: 'haircut-eyebrows', name: 'Corte de cabello con ceja', description: '', price: '26000', duration: 70, mediaUrl: '', mediaType: 'image' },
    { id: 'haircut-facial-mask', name: 'Corte de cabello más mascarilla de exfoliación', description: '', price: '32000', duration: 75, mediaUrl: '', mediaType: 'image' },
    { id: 'beard-combo', name: 'Barba combo', description: '', price: '16000', duration: 40, mediaUrl: '', mediaType: 'image' },
    { id: 'eyebrows', name: 'Cejas con cuchilla', description: '', price: '4000', duration: 20, mediaUrl: '', mediaType: 'image' }
];

describe('Service Duration & Details Calculation', () => {
    it('should return 75 minutes for Corte de cabello más mascarilla de exfoliación', () => {
        const duration = getServiceDuration('haircut-facial-mask', sampleServices);
        expect(duration).toBe(75);
    });

    it('should correctly sum durations for multiple selected services', () => {
        const duration = getServiceDuration('haircut,eyebrows', sampleServices);
        expect(duration).toBe(80);
    });

    it('should fallback to 60 minutes for empty or unknown service ID', () => {
        expect(getServiceDuration('', sampleServices)).toBe(60);
        expect(getServiceDuration('unknown_id', sampleServices)).toBe(60);
    });

    it('should calculate accurate service details including total duration', () => {
        const details = getServiceDetails('haircut-facial-mask', sampleServices);
        expect(details.names).toBe('Corte de cabello más mascarilla de exfoliación');
        expect(details.totalPrice).toBe(32000);
        expect(details.totalDuration).toBe(75);
    });
});

describe('Scenario Simulation: 75-Minute Appointment & Overbooking Prevention', () => {
    it('prevents overlapping bookings when a 75-minute service is booked at 8:00 AM', () => {
        const bookedIntervals = [{ startMin: 480, endMin: 555 }];

        const isSlotFit = (startTimeStr: string, duration: number) => {
            const start = timeToMinutes(startTimeStr);
            const end = start + duration;
            if (start < 480 || end > 1260) return false;
            for (const interval of bookedIntervals) {
                if (doIntervalsOverlap(start, end, interval.startMin, interval.endMin)) {
                    return false;
                }
            }
            return true;
        };

        expect(isSlotFit('08:00 AM', 60)).toBe(false);
        expect(isSlotFit('09:00 AM', 60)).toBe(false);
        expect(isSlotFit('09:10 AM', 60)).toBe(false);
        expect(isSlotFit('09:15 AM', 60)).toBe(true);
        expect(isSlotFit('10:00 AM', 60)).toBe(true);
    });

    it('prevents overbooking when a gap slot is booked between two appointments', () => {
        const bookedIntervals = [
            { startMin: 480, endMin: 555 },
            { startMin: 600, endMin: 660 }
        ];

        const isSlotFit = (startTimeStr: string, duration: number) => {
            const start = timeToMinutes(startTimeStr);
            const end = start + duration;
            if (start < 480 || end > 1260) return false;
            for (const interval of bookedIntervals) {
                if (doIntervalsOverlap(start, end, interval.startMin, interval.endMin)) {
                    return false;
                }
            }
            return true;
        };

        expect(isSlotFit('09:15 AM', 60)).toBe(false);
        expect(isSlotFit('09:15 AM', 40)).toBe(true);
        expect(isSlotFit('09:15 AM', 20)).toBe(true);
    });

    it('verifies all 7 individual catalogue services have valid positive durations', () => {
        const serviceKeys = [
            'haircut',
            'haircut-beard',
            'haircut-design',
            'haircut-eyebrows',
            'haircut-facial-mask',
            'beard-combo',
            'eyebrows'
        ];

        serviceKeys.forEach(key => {
            const duration = getServiceDuration(key, sampleServices);
            expect(duration).toBeGreaterThanOrEqual(15);
            expect(duration).toBeLessThanOrEqual(120);
        });
    });

    it('prevents overbooking for multi-service combinations (e.g. Corte + Barba + Cejas)', () => {
        // Multi-service: haircut + eyebrows = 80 min (or dynamic duration)
        const totalDuration = getServiceDuration('haircut,eyebrows', sampleServices);
        const bookedIntervals = [
            { startMin: 600, endMin: 600 + totalDuration } // 10:00 AM to 11:20 AM
        ];

        const isSlotFit = (startTimeStr: string, duration: number) => {
            const start = timeToMinutes(startTimeStr);
            const end = start + duration;
            if (start < 480 || end > 1260) return false;
            for (const interval of bookedIntervals) {
                if (doIntervalsOverlap(start, end, interval.startMin, interval.endMin)) {
                    return false;
                }
            }
            return true;
        };

        // Slots inside or overlapping [600, 680] must be rejected
        expect(isSlotFit('10:00 AM', 30)).toBe(false);
        expect(isSlotFit('10:30 AM', 45)).toBe(false);
        expect(isSlotFit('11:00 AM', 30)).toBe(false);
        expect(isSlotFit('11:15 AM', 30)).toBe(false);

        // Slots before or after must be allowed
        expect(isSlotFit('08:00 AM', 60)).toBe(true);
        expect(isSlotFit('11:20 AM', 40)).toBe(true);
        expect(isSlotFit('11:30 AM', 40)).toBe(true);
    });

    it('handles exact user scenario: 11:00 AM (75 min) vs 10:00 AM with 75, 65, 60, 55 min', () => {
        // Existing appointment at 11:00 AM (660 min) with 75 min duration -> [660, 735]
        const bookedIntervals = [
            { startMin: 660, endMin: 735 } // 11:00 AM to 12:15 PM
        ];

        const isSlotFit = (startTimeStr: string, duration: number) => {
            const start = timeToMinutes(startTimeStr);
            const end = start + duration;
            if (start < 480 || end > 1260) return false;
            for (const interval of bookedIntervals) {
                if (doIntervalsOverlap(start, end, interval.startMin, interval.endMin)) {
                    return false;
                }
            }
            return true;
        };

        // If client at 10:00 AM chooses 75 min (ends at 11:15 AM) -> OVERLAPS 15 min with 11:00 AM -> MUST BE REJECTED
        expect(isSlotFit('10:00 AM', 75)).toBe(false);

        // If client at 10:00 AM chooses 65 min (ends at 11:05 AM) -> OVERLAPS 5 min with 11:00 AM -> MUST BE REJECTED
        expect(isSlotFit('10:00 AM', 65)).toBe(false);

        // If client at 10:00 AM chooses 60 min (ends at 11:00 AM exactly) -> NO OVERLAP -> ALLOWED
        expect(isSlotFit('10:00 AM', 60)).toBe(true);

        // If client at 10:00 AM chooses 55 min (ends at 10:55 AM) -> NO OVERLAP -> ALLOWED
        expect(isSlotFit('10:00 AM', 55)).toBe(true);

        // If client at 10:00 AM chooses 50 min (ends at 10:50 AM) -> NO OVERLAP -> ALLOWED
        expect(isSlotFit('10:00 AM', 50)).toBe(true);

        // If client at 10:00 AM chooses 40 min (ends at 10:40 AM) -> NO OVERLAP -> ALLOWED
        expect(isSlotFit('10:00 AM', 40)).toBe(true);
    });
});
