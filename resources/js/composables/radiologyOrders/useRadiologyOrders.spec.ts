import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useRadiologyOrders } from './useRadiologyOrders';
import { useRadiologyOrderFilters } from './useRadiologyOrderFilters';

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

describe('useRadiologyOrders', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches from /radiology-orders with the filter set', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'rad-1', orderNumber: 'RAD0001', status: 'ordered' }],
            meta: { currentPage: 1, perPage: 50, total: 1, lastPage: 1 },
        });

        const filters = useRadiologyOrderFilters();
        const result = await mount(() => useRadiologyOrders(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/radiology-orders',
            expect.objectContaining({ status: null, modality: null, worklistScope: null, page: 1, perPage: 50, sortBy: 'orderedAt', sortDir: 'desc' }),
        );
        expect(result.data.value?.data).toHaveLength(1);
    });

    it('sends the selected status filter', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 50, total: 0, lastPage: 1 },
        });

        const filters = useRadiologyOrderFilters();
        filters.status = 'completed';
        await mount(() => useRadiologyOrders(filters));

        expect(getSpy).toHaveBeenCalledWith('/radiology-orders', expect.objectContaining({ status: 'completed' }));
    });
});
