import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { computed, defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePatientInsuranceRecords } from './usePatientInsuranceRecords';

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

    return composable;
}

describe('usePatientInsuranceRecords', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches insurance records for the given patient', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'ins-1', insuranceProvider: 'NHIF', verificationStatus: 'verified' }],
        });

        const records = await mount(() => usePatientInsuranceRecords(ref('pat-1')));

        expect(getSpy).toHaveBeenCalledWith('/patients/pat-1/insurance');
        expect(records.data.value?.[0]?.insuranceProvider).toBe('NHIF');
    });

    it('does not fetch when disabled', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet');

        await mount(() => usePatientInsuranceRecords(ref('pat-1'), computed(() => false)));

        expect(getSpy).not.toHaveBeenCalled();
    });

    it('does not fetch when the patient id is blank', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet');

        await mount(() => usePatientInsuranceRecords(ref('')));

        expect(getSpy).not.toHaveBeenCalled();
    });
});
