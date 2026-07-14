import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { computed, defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useAdmissionAdtTimeline } from './useAdmissionAdtTimeline';
import type { Admission } from './useAdmissions';

function admission(overrides: Partial<Admission> = {}): Admission {
    return {
        id: 'adm-1',
        admissionNumber: 'ADM1',
        patientId: 'pat-1',
        appointmentId: null,
        attendingClinicianUserId: null,
        ward: null,
        bed: null,
        bedResourceId: null,
        bedResource: null,
        admittedAt: '2026-01-01T08:00:00Z',
        dischargedAt: null,
        admissionReason: 'Observation',
        notes: null,
        financialClass: null,
        billingPayerContractId: null,
        coverageReference: null,
        coverageNotes: null,
        status: 'admitted',
        statusReason: null,
        dischargeDestination: null,
        followUpPlan: null,
        createdAt: '2026-01-01T08:00:00Z',
        updatedAt: '2026-01-01T08:00:00Z',
        ...overrides,
    };
}

async function mount<T>(build: () => T): Promise<T> {
    let composable!: T;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const TestComponent = defineComponent({
        setup() {
            composable = build();
            return () => h('div');
        },
    });

    render(TestComponent, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));

    return composable;
}

describe('useAdmissionAdtTimeline', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches up to 100 unfiltered audit log entries for the admission', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 100, total: 0, lastPage: 1 },
        });

        const target = ref(admission());
        await mount(() => useAdmissionAdtTimeline(computed(() => target.value)));

        expect(getSpy).toHaveBeenCalledWith('/admissions/adm-1/audit-logs', { page: 1, perPage: 100 });
    });

    it('produces a timeline even when the audit fetch returns nothing', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [], meta: { currentPage: 1, perPage: 100, total: 0, lastPage: 1 } });

        const target = ref(admission());
        const result = await mount(() => useAdmissionAdtTimeline(computed(() => target.value)));

        expect(result.timeline.value.length).toBeGreaterThan(0);
        expect(result.timeline.value[0].source).toBe('current-state');
    });
});
