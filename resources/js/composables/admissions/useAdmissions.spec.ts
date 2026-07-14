import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useAdmissions } from './useAdmissions';
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

describe('useAdmissions', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches from /admissions with the filter set', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'adm-1', admissionNumber: 'ADM0001', status: 'admitted' }],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        });

        const filters = useAdmissionFilters();
        const result = await mount(() => useAdmissions(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/admissions',
            expect.objectContaining({ status: null, ward: null, page: 1, perPage: 20, sortBy: 'admittedAt', sortDir: 'desc' }),
        );
        expect(result.data.value?.data).toHaveLength(1);
    });

    it('sends the selected status filter', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 20, total: 0, lastPage: 1 },
        });

        const filters = useAdmissionFilters();
        filters.status = 'discharged';
        await mount(() => useAdmissions(filters));

        expect(getSpy).toHaveBeenCalledWith('/admissions', expect.objectContaining({ status: 'discharged' }));
    });
});
