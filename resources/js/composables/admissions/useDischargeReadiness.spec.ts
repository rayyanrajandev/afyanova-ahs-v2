import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { computed, defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useDischargeReadiness, type DischargeReadinessAdmission } from './useDischargeReadiness';

vi.mock('@inertiajs/vue3', () => ({
    usePage: () => ({ props: { auth: { permissions: ['medical.records.read', 'laboratory.orders.read', 'pharmacy.orders.read', 'billing.invoices.read'], isFacilitySuperAdmin: false } } }),
}));

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

function admission(overrides: Partial<DischargeReadinessAdmission> = {}): DischargeReadinessAdmission {
    return {
        id: 'adm-1',
        patientId: 'pat-1',
        admittedAt: '2026-01-01T08:00:00Z',
        createdAt: '2026-01-01T08:00:00Z',
        ...overrides,
    };
}

describe('useDischargeReadiness', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('blocks discharge when the discharge summary is undocumented and labs are pending', async () => {
        vi.spyOn(apiClient, 'apiGet').mockImplementation(async (url: string) => {
            if (url === '/medical-records') return { data: [] };
            if (url === '/laboratory-orders') return { data: [{ admissionId: 'adm-1', patientId: 'pat-1', orderedAt: '2026-01-01T09:00:00Z', status: 'ordered' }] };
            if (url === '/pharmacy-orders') return { data: [] };
            if (url === '/billing') return { data: [] };
            return { data: [] };
        });

        const target = ref(admission());
        const readiness = await mount(() => useDischargeReadiness(computed(() => target.value)));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(readiness.canConfirmDischarge.value).toBe(false);
        expect(readiness.blockReason.value).toContain('Discharge summary written');
    });

    it('allows discharge once a documented discharge summary exists and no labs are pending', async () => {
        vi.spyOn(apiClient, 'apiGet').mockImplementation(async (url: string) => {
            if (url === '/medical-records') {
                return { data: [{ admissionId: 'adm-1', patientId: 'pat-1', encounterAt: '2026-01-02T08:00:00Z', status: 'finalized', recordType: 'discharge_note', recordNumber: 'MR1' }] };
            }
            if (url === '/laboratory-orders') return { data: [] };
            if (url === '/pharmacy-orders') return { data: [] };
            if (url === '/billing') return { data: [] };
            return { data: [] };
        });

        const target = ref(admission());
        const readiness = await mount(() => useDischargeReadiness(computed(() => target.value)));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(readiness.canConfirmDischarge.value).toBe(true);
        expect(readiness.blockReason.value).toBe('');
    });

    it('fails open when all four linked modules are unavailable', async () => {
        vi.spyOn(apiClient, 'apiGet').mockRejectedValue(new Error('network error'));

        const target = ref(admission());
        const readiness = await mount(() => useDischargeReadiness(computed(() => target.value)));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(readiness.canConfirmDischarge.value).toBe(true);
    });

    it('marks a manual checklist item complete and reflects it in the section', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [] });

        const target = ref(admission());
        const readiness = await mount(() => useDischargeReadiness(computed(() => target.value)));
        await new Promise((resolve) => setTimeout(resolve, 0));

        readiness.setManualChecklistValue('transportConfirmed', true);
        const logisticsSection = readiness.sections.value.find((s) => s.key === 'logistics');
        expect(logisticsSection?.items[0].complete).toBe(true);
    });
});
