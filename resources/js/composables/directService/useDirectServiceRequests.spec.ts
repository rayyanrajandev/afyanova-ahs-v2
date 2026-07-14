import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useDirectServiceRequests } from './useDirectServiceRequests';
import { useDirectServiceFilters } from './useDirectServiceFilters';

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

describe('useDirectServiceRequests', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches from /service-requests with the filter set', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'sr-1', requestNumber: 'SR0001', status: 'pending' }],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1, departmentScopeMissing: false },
        });

        const filters = useDirectServiceFilters();
        const result = await mount(() => useDirectServiceRequests(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/service-requests',
            expect.objectContaining({ status: null, priority: null, departmentId: null, page: 1, perPage: 20 }),
        );
        expect(result.data.value?.data).toHaveLength(1);
    });

    it('sends the selected status and department filters', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 20, total: 0, lastPage: 1, departmentScopeMissing: false },
        });

        const filters = useDirectServiceFilters();
        filters.status = 'in_progress';
        filters.departmentId = 'dept-1';
        await mount(() => useDirectServiceRequests(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/service-requests',
            expect.objectContaining({ status: 'in_progress', departmentId: 'dept-1' }),
        );
    });
});
