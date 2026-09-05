import { describe, it, expect } from 'vitest';
import { getAdminBlockTimeOptions } from '@/lib/data';

describe('Admin Schedule Time Options', () => {
    it('should provide full 8:00 AM to 9:00 PM options for any day', () => {
        const { startTimes, endTimes } = getAdminBlockTimeOptions();

        expect(startTimes.length).toBeGreaterThan(0);
        expect(startTimes).toContain('08:00 AM');
        expect(startTimes).toContain('12:00 PM');
        expect(startTimes).toContain('08:00 PM');

        expect(endTimes).toContain('09:00 PM');
        expect(endTimes[endTimes.length - 1]).toBe('09:00 PM');
    });
});
