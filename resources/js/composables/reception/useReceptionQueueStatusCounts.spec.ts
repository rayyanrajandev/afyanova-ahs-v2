import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useReceptionQueueFilters } from './useReceptionQueue';
import { useReceptionQueueStatusCounts } from './useReceptionQueueStatusCounts';

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
    await new Promise((resolve) => setTimeout(resolve, 0));

    return composable;
}

describe('useReceptionQueueStatusCounts', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('GETs the status-counts endpoint with only non-paging filters', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: { waiting_triage: 3, waiting_provider: 1, in_consultation: 2, total: 6 },
        });

        const filters = useReceptionQueueFilters();
        filters.q = 'Zawadi';
        filters.page = 2;
        const counts = await mount(() => useReceptionQueueStatusCounts(filters));

        expect(getSpy).toHaveBeenCalledWith('/reception/queue/status-counts', {
            q: 'Zawadi',
            department: null,
            clinicianUserId: null,
        });
        expect(counts.data.value?.total).toBe(6);
    });
});
