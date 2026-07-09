import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePatientList, usePatientStatusCounts } from './usePatientList';
import { usePatientListFilters } from './usePatientListFilters';

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

describe('usePatientList', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches the list with default filters', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [
                { id: 'pat-1', patientNumber: 'PT-1', firstName: 'Amina', middleName: null, lastName: 'Moshi', status: 'active' },
            ],
            meta: { currentPage: 1, perPage: 10, total: 1, lastPage: 1 },
        });

        const filters = usePatientListFilters();
        const list = await mount(() => usePatientList(filters));

        expect(list.data.value?.data).toHaveLength(1);
        expect(getSpy).toHaveBeenCalledWith(
            '/patients',
            expect.objectContaining({ status: 'active', page: 1, perPage: 10, sortBy: 'createdAt', sortDir: 'desc' }),
        );
    });

    it('sends null, not empty strings, for blank optional filters', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 10, total: 0, lastPage: 1 },
        });

        const filters = usePatientListFilters();
        await mount(() => usePatientList(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/patients',
            expect.objectContaining({ q: null, gender: null, region: null, district: null }),
        );
    });

    it('refetches when a filter changes', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 10, total: 0, lastPage: 1 },
        });

        const filters = usePatientListFilters();
        await mount(() => usePatientList(filters));
        expect(getSpy).toHaveBeenCalledTimes(1);

        filters.status = 'inactive';
        await vi.waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2));
        expect(getSpy).toHaveBeenLastCalledWith('/patients', expect.objectContaining({ status: 'inactive' }));
    });
});

describe('usePatientStatusCounts', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('only sends q, not the other filters', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: { active: 3, inactive: 1, other: 0, total: 4 },
        });

        const filters = usePatientListFilters();
        filters.status = 'inactive';
        filters.gender = 'female';
        filters.q = 'amina';

        const counts = await mount(() => usePatientStatusCounts(filters));

        expect(counts.data.value?.total).toBe(4);
        expect(getSpy).toHaveBeenCalledWith('/patients/status-counts', { q: 'amina' });
    });

    it('does not refetch when a non-q filter changes', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: { active: 0, inactive: 0, other: 0, total: 0 },
        });

        const filters = usePatientListFilters();
        await mount(() => usePatientStatusCounts(filters));
        expect(getSpy).toHaveBeenCalledTimes(1);

        filters.status = 'inactive';
        await flushPromises();
        expect(getSpy).toHaveBeenCalledTimes(1);
    });
});
