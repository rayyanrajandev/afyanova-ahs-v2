import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useAdmissionStatusCounts } from './useAdmissionStatusCounts';
import { useAdmissionFilters } from './useAdmissionFilters';

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

describe('useAdmissionStatusCounts', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches status counts and always requests a discharged-today range', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: { admitted: 3, discharged: 1, transferred: 0, cancelled: 0, other: 0, total: 4, dischargedInRange: 1 },
        });

        const filters = useAdmissionFilters();
        const result = await mount(() => useAdmissionStatusCounts(filters));

        expect(getSpy).toHaveBeenCalledWith('/admissions/status-counts', expect.objectContaining({ ward: null }));
        const [, params] = getSpy.mock.calls[0] as [string, { dischargedFrom: string; dischargedTo: string }];
        expect(params.dischargedFrom).toMatch(/T00:00:00$/);
        expect(params.dischargedTo).toMatch(/T23:59:59$/);
        expect(result.data.value?.dischargedInRange).toBe(1);
    });
});
