import { describe, expect, it } from 'vitest';
import { formatTimeSlotLabel, generateTimeSlotOptions, nextTimeSlotFrom, toIsoDateString } from './appointmentTimeSlots';

describe('appointmentTimeSlots', () => {
    it('generates 15-minute slots from 07:00 to 19:00 inclusive', () => {
        const slots = generateTimeSlotOptions();
        expect(slots[0]).toBe('07:00');
        expect(slots[slots.length - 1]).toBe('19:00');
        expect(slots).toContain('12:15');
        expect(new Set(slots).size).toBe(slots.length);
    });

    it('formats a 24-hour slot value as a locale time label', () => {
        expect(formatTimeSlotLabel('09:30')).toMatch(/9:30/);
    });

    it('rounds up to the next 15-minute boundary', () => {
        expect(nextTimeSlotFrom(new Date('2026-07-10T10:07:00'))).toBe('10:15');
        expect(nextTimeSlotFrom(new Date('2026-07-10T10:15:00'))).toBe('10:15');
    });

    it('formats a date as YYYY-MM-DD', () => {
        expect(toIsoDateString(new Date(2026, 6, 5))).toBe('2026-07-05');
    });
});
