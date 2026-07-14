import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useRadiologyOrderStatusCounts } from './useRadiologyOrderStatusCounts';
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

describe('useRadiologyOrderStatusCounts', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches from /radiology-orders/status-counts', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: {
                ordered: 2,
                scheduled: 1,
                in_progress: 3,
                completed: 5,
                cancelled: 1,
                other: 0,
                total: 12,
            },
        });

        const filters = useRadiologyOrderFilters();
        const result = await mount(() => useRadiologyOrderStatusCounts(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/radiology-orders/status-counts',
            expect.objectContaining({ q: null, patientId: null, from: null, to: null }),
        );
        expect(result.data.value?.total).toBe(12);
        expect(result.data.value?.ordered).toBe(2);
    });
});
