import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useTheatreProcedures } from './useTheatreProcedures';
import { useTheatreProcedureFilters } from './useTheatreProcedureFilters';

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

describe('useTheatreProcedures', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches from /theatre-procedures with the filter set', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'th-1', procedureNumber: 'TH0001', status: 'planned' }],
            meta: { currentPage: 1, perPage: 50, total: 1, lastPage: 1 },
        });

        const filters = useTheatreProcedureFilters();
        const result = await mount(() => useTheatreProcedures(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/theatre-procedures',
            expect.objectContaining({ status: null, worklistScope: null, page: 1, perPage: 50, sortBy: 'scheduledAt', sortDir: 'desc' }),
        );
        expect(result.data.value?.data).toHaveLength(1);
    });

    it('sends the selected status filter', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 50, total: 0, lastPage: 1 },
        });

        const filters = useTheatreProcedureFilters();
        filters.status = 'completed';
        await mount(() => useTheatreProcedures(filters));

        expect(getSpy).toHaveBeenCalledWith('/theatre-procedures', expect.objectContaining({ status: 'completed' }));
    });
});
