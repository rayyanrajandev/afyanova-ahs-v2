import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useAvailableBeds } from './useAvailableBeds';

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

describe('useAvailableBeds', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches from /admissions/available-beds with no filters by default', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'bed-1', code: 'WB-A-01', name: 'Ward A 01', wardName: 'Ward A', bedNumber: '01', departmentId: null, location: null, status: 'active', isOccupied: false, occupiedByAdmissionId: null, occupiedByAdmissionNumber: null }],
            meta: { currentPage: 1, perPage: 200, total: 1, lastPage: 1 },
        });

        const result = await mount(() => useAvailableBeds());

        expect(getSpy).toHaveBeenCalledWith(
            '/admissions/available-beds',
            expect.objectContaining({ wardName: null, departmentId: null, q: null, perPage: 200 }),
        );
        expect(result.data.value?.data).toHaveLength(1);
    });

    it('refetches when a reactive filter changes', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 200, total: 0, lastPage: 1 },
        });

        const filters = ref<{ wardName?: string }>({ wardName: 'Ward A' });
        await mount(() => useAvailableBeds(filters));
        expect(getSpy).toHaveBeenCalledWith('/admissions/available-beds', expect.objectContaining({ wardName: 'Ward A' }));

        filters.value = { wardName: 'Ward B' };
        await vi.waitFor(() =>
            expect(getSpy).toHaveBeenLastCalledWith('/admissions/available-beds', expect.objectContaining({ wardName: 'Ward B' })),
        );
    });
});
