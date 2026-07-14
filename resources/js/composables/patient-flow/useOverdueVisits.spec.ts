import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOverdueVisits } from './useOverdueVisits';
import { type VisitJourneyEntry } from './useVisitJourneyBoard';

async function mount<T>(build: () => T): Promise<T> {
    let composable!: T;
    const TestComponent = defineComponent({
        setup() {
            composable = build();
            return () => h('div');
        },
    });

    render(TestComponent);
    await flushPromises();

    return composable;
}

function makeEntry(overrides: Partial<VisitJourneyEntry> = {}): VisitJourneyEntry {
    return {
        appointmentId: 'apt-1',
        serviceRequestId: null,
        patientId: 'patient-1',
        patientName: 'Test Patient',
        patientNumber: 'PT001',
        department: 'Outpatient',
        clinicianUserId: null,
        appointmentStatus: 'in_consultation',
        step: 'with_clinician',
        stepEnteredAt: null,
        priority: null,
        openOrders: [],
        allergies: [],
        billingStatus: null,
        ...overrides,
    };
}

describe('useOverdueVisits', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('excludes entries below the threshold', async () => {
        const entries = ref([makeEntry({ appointmentId: 'a', stepEnteredAt: '2026-01-01T11:00:00.000Z' })]);
        const result = await mount(() => useOverdueVisits(entries, 90));

        expect(result.overdueEntries.value).toEqual([]);
    });

    it('includes entries at or above the threshold', async () => {
        const entries = ref([makeEntry({ appointmentId: 'a', stepEnteredAt: '2026-01-01T10:30:00.000Z' })]);
        const result = await mount(() => useOverdueVisits(entries, 90));

        expect(result.overdueEntries.value).toHaveLength(1);
        expect(result.overdueEntries.value[0]?.appointmentId).toBe('a');
    });

    it('excludes entries with no stepEnteredAt rather than guessing', async () => {
        const entries = ref([makeEntry({ appointmentId: 'a', stepEnteredAt: null })]);
        const result = await mount(() => useOverdueVisits(entries, 90));

        expect(result.overdueEntries.value).toEqual([]);
    });

    it('defaults the threshold to 90 minutes, matching ElapsedTimeBadge critical', async () => {
        const entries = ref([
            makeEntry({ appointmentId: 'not-overdue', stepEnteredAt: '2026-01-01T10:45:00.000Z' }),
            makeEntry({ appointmentId: 'overdue', stepEnteredAt: '2026-01-01T10:00:00.000Z' }),
        ]);
        const result = await mount(() => useOverdueVisits(entries));

        expect(result.overdueEntries.value.map((entry) => entry.appointmentId)).toEqual(['overdue']);
    });
});
