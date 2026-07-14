import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePharmacyOrders } from './usePharmacyOrders';
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

describe('usePharmacyOrders', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches from /pharmacy-orders with the filter set', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'ph-1', orderNumber: 'PH0001', status: 'pending' }],
            meta: { currentPage: 1, perPage: 50, total: 1, lastPage: 1 },
        });

        const filters = usePharmacyOrderFilters();
        const result = await mount(() => usePharmacyOrders(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/pharmacy-orders',
            expect.objectContaining({ status: null, worklistScope: null, page: 1, perPage: 50, sortBy: 'orderedAt', sortDir: 'desc' }),
        );
        expect(result.data.value?.data).toHaveLength(1);
    });

    it('sends the selected status filter', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 50, total: 0, lastPage: 1 },
        });

        const filters = usePharmacyOrderFilters();
        filters.status = 'dispensed';
        await mount(() => usePharmacyOrders(filters));

        expect(getSpy).toHaveBeenCalledWith('/pharmacy-orders', expect.objectContaining({ status: 'dispensed' }));
    });
});
