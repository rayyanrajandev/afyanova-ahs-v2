import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useEmergencyCases } from './useEmergencyCases';
import { useEmergencyCaseFilters } from './useEmergencyCaseFilters';

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

describe('useEmergencyCases', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches from /emergency-triage-cases with the filter set', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'case-1', caseNumber: 'ED0001', status: 'waiting' }],
            meta: { currentPage: 1, perPage: 15, total: 1, lastPage: 1 },
        });

        const filters = useEmergencyCaseFilters();
        const cases = await mount(() => useEmergencyCases(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/emergency-triage-cases',
            expect.objectContaining({ q: null, status: null, triageLevel: null, page: 1, perPage: 15 }),
        );
        expect(cases.data.value?.data).toHaveLength(1);
    });

    it('sends the selected status filter', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [], meta: {} });

        const filters = useEmergencyCaseFilters();
        filters.status = 'waiting';
        await mount(() => useEmergencyCases(filters));

        expect(getSpy).toHaveBeenCalledWith('/emergency-triage-cases', expect.objectContaining({ status: 'waiting' }));
    });
});
