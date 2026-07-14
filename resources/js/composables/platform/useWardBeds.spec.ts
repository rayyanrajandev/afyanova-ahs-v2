import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useWardBeds } from './useWardBeds';
import { useWardBedFilters } from './useWardBedFilters';

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

describe('useWardBeds', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches from /platform/admin/ward-beds with the filter set', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'wb-1', code: 'WB-01', name: 'Ward A Bed 1', isOccupied: true, occupiedByAdmissionNumber: 'ADM0001' }],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        });

        const filters = useWardBedFilters();
        const result = await mount(() => useWardBeds(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/platform/admin/ward-beds',
            expect.objectContaining({ status: null, departmentId: null, wardName: null, sortBy: 'name', sortDir: 'asc', page: 1, perPage: 20 }),
        );
        expect(result.data.value?.data).toHaveLength(1);
        expect(result.data.value?.data[0].isOccupied).toBe(true);
    });

    it('sends the selected status filter', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 20, total: 0, lastPage: 1 },
        });

        const filters = useWardBedFilters();
        filters.status = 'inactive';
        await mount(() => useWardBeds(filters));

        expect(getSpy).toHaveBeenCalledWith('/platform/admin/ward-beds', expect.objectContaining({ status: 'inactive' }));
    });
});
