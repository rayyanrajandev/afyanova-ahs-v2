import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useLaboratoryOrders } from './useLaboratoryOrders';
import { useLaboratoryOrderFilters } from './useLaboratoryOrderFilters';

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

describe('useLaboratoryOrders', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches from /laboratory-orders with the filter set', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'lab-1', orderNumber: 'LAB0001', status: 'ordered' }],
            meta: { currentPage: 1, perPage: 50, total: 1, lastPage: 1 },
        });

        const filters = useLaboratoryOrderFilters();
        const result = await mount(() => useLaboratoryOrders(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/laboratory-orders',
            expect.objectContaining({ status: null, priority: null, worklistScope: null, page: 1, perPage: 50, sortBy: 'orderedAt', sortDir: 'desc' }),
        );
        expect(result.data.value?.data).toHaveLength(1);
    });

    it('sends the selected status filter', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 50, total: 0, lastPage: 1 },
        });

        const filters = useLaboratoryOrderFilters();
        filters.status = 'completed';
        await mount(() => useLaboratoryOrders(filters));

        expect(getSpy).toHaveBeenCalledWith('/laboratory-orders', expect.objectContaining({ status: 'completed' }));
    });
});
