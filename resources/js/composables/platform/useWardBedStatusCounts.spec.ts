import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useWardBedStatusCounts } from './useWardBedStatusCounts';
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

describe('useWardBedStatusCounts', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches status counts scoped by the shared filters', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: { active: 4, inactive: 1, other: 0, total: 5 },
        });

        const filters = useWardBedFilters();
        filters.wardName = 'Ward A';
        const result = await mount(() => useWardBedStatusCounts(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/platform/admin/ward-beds/status-counts',
            expect.objectContaining({ wardName: 'Ward A' }),
        );
        expect(result.data.value).toEqual({ active: 4, inactive: 1, other: 0, total: 5 });
    });
});
