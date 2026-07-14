import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useEmergencyCaseStatusCounts } from './useEmergencyCaseStatusCounts';
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

describe('useEmergencyCaseStatusCounts', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches counts from /emergency-triage-cases/status-counts', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: { waiting: 3, triaged: 2, in_treatment: 1, admitted: 0, discharged: 4, cancelled: 0, other: 0, total: 10 },
        });

        const filters = useEmergencyCaseFilters();
        const counts = await mount(() => useEmergencyCaseStatusCounts(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/emergency-triage-cases/status-counts',
            expect.objectContaining({ q: null, triageLevel: null, from: null, to: null }),
        );
        expect(counts.data.value?.total).toBe(10);
    });
});
