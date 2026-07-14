import { describe, expect, it } from 'vitest';
import { isUrgentPriority, URGENT_PRIORITIES } from './patientFlowPriority';

describe('isUrgentPriority', () => {
    it('treats P1 and P2 as urgent', () => {
        expect(isUrgentPriority('P1')).toBe(true);
        expect(isUrgentPriority('P2')).toBe(true);
    });

    it('treats P3-P5 as not urgent', () => {
        expect(isUrgentPriority('P3')).toBe(false);
        expect(isUrgentPriority('P4')).toBe(false);
        expect(isUrgentPriority('P5')).toBe(false);
    });

    it('treats null as not urgent', () => {
        expect(isUrgentPriority(null)).toBe(false);
    });

    it('matches the exported URGENT_PRIORITIES list', () => {
        expect(URGENT_PRIORITIES).toEqual(['P1', 'P2']);
    });
});
