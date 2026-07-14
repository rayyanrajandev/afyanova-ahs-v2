import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePharmacyOrderStatusCounts } from './usePharmacyOrderStatusCounts';
import { usePharmacyOrderFilters } from './usePharmacyOrderFilters';

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

describe('usePharmacyOrderStatusCounts', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches from /pharmacy-orders/status-counts', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: {
                pending: 2,
                in_preparation: 1,
                partially_dispensed: 0,
                dispensed: 5,
                cancelled: 1,
                reconciliation_pending: 3,
                reconciliation_completed: 2,
                reconciliation_exception: 0,
                other: 0,
                total: 9,
            },
        });

        const filters = usePharmacyOrderFilters();
        const result = await mount(() => usePharmacyOrderStatusCounts(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/pharmacy-orders/status-counts',
            expect.objectContaining({ q: null, patientId: null, from: null, to: null }),
        );
        expect(result.data.value?.total).toBe(9);
        expect(result.data.value?.pending).toBe(2);
    });
});
