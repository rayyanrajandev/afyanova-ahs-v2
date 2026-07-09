import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveAgeFromDateOfBirth, deriveDateOfBirthFromAge, formatAgeLabel } from './patientAge';

describe('patientAge', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-09T00:00:00'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('deriveDateOfBirthFromAge', () => {
        it('returns null when both inputs are blank', () => {
            expect(deriveDateOfBirthFromAge('', '')).toBeNull();
        });

        it('returns null when years and months are both zero', () => {
            expect(deriveDateOfBirthFromAge('0', '0')).toBeNull();
        });

        it('derives a date from years and months', () => {
            expect(deriveDateOfBirthFromAge('30', '2')).toBe('1996-05-09');
        });

        it('derives a date from months alone (infant)', () => {
            expect(deriveDateOfBirthFromAge('', '6')).toBe('2026-01-09');
        });

        it('rejects out-of-range input', () => {
            expect(deriveDateOfBirthFromAge('200', '0')).toBeNull();
            expect(deriveDateOfBirthFromAge('0', '20')).toBeNull();
        });

        it('does not throw when given actual numbers instead of strings', () => {
            // Vue's v-model on a native <input type="number"> auto-coerces
            // the bound value to a JS number at runtime, regardless of the
            // .number modifier — a real bug this composable's caller hit
            // (ageYearsInput.trim is not a function). Guard against any
            // caller making that same mistake.
            expect(deriveDateOfBirthFromAge(30 as unknown as string, 2 as unknown as string)).toBe('1996-05-09');
        });
    });

    describe('deriveAgeFromDateOfBirth', () => {
        it('returns null for a blank input', () => {
            expect(deriveAgeFromDateOfBirth('')).toBeNull();
        });

        it('returns null for a future date', () => {
            expect(deriveAgeFromDateOfBirth('2030-01-01')).toBeNull();
        });

        it('computes years and months as of today', () => {
            expect(deriveAgeFromDateOfBirth('1996-05-09')).toEqual({ years: 30, months: 2 });
        });

        it('rounds down when the birthday has not occurred yet this month', () => {
            expect(deriveAgeFromDateOfBirth('2025-07-10')).toEqual({ years: 0, months: 11 });
        });
    });

    describe('formatAgeLabel', () => {
        it('formats years and months', () => {
            expect(formatAgeLabel({ years: 30, months: 2 })).toBe('30 yrs 2 mos');
        });

        it('omits months when zero and years is nonzero', () => {
            expect(formatAgeLabel({ years: 1, months: 0 })).toBe('1 yr');
        });

        it('shows 0 mos for a newborn', () => {
            expect(formatAgeLabel({ years: 0, months: 0 })).toBe('0 mos');
        });
    });
});
