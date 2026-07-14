import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useReceptionQueue, useReceptionQueueFilters } from './useReceptionQueue';

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

describe('useReceptionQueueFilters', () => {
    it('defaults to waiting_triage with no search/department/clinician filters', () => {
        const filters = useReceptionQueueFilters();

        expect(filters.stage).toBe('waiting_triage');
        expect(filters.q).toBe('');
        expect(filters.department).toBe('');
        expect(filters.clinicianUserId).toBe('');
        expect(filters.page).toBe(1);
        expect(filters.perPage).toBe(20);
    });
});

describe('useReceptionQueue', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('GETs the queue endpoint with stage and paging params', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 20, total: 0, lastPage: 1 },
        });

        const filters = useReceptionQueueFilters();
        await mount(() => useReceptionQueue(filters));

        expect(getSpy).toHaveBeenCalledWith('/reception/queue', {
            stage: 'waiting_triage',
            q: null,
            department: null,
            clinicianUserId: null,
            page: 1,
            perPage: 20,
        });
    });

    it('sends q/department/clinicianUserId when set', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 20, total: 0, lastPage: 1 },
        });

        const filters = useReceptionQueueFilters();
        filters.q = 'Zawadi';
        filters.department = 'Dental';
        filters.clinicianUserId = '42';
        await mount(() => useReceptionQueue(filters));

        expect(getSpy).toHaveBeenCalledWith('/reception/queue', expect.objectContaining({
            q: 'Zawadi',
            department: 'Dental',
            clinicianUserId: '42',
        }));
    });

    it('returns the paginated data and meta envelope', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ appointmentId: 'apt-1' }],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        });

        const filters = useReceptionQueueFilters();
        const result = await mount(() => useReceptionQueue(filters));

        expect(result.data.value?.data).toHaveLength(1);
        expect(result.data.value?.meta.total).toBe(1);
    });
});
