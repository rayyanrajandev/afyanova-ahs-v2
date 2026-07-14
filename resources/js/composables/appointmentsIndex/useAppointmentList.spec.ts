import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useAppointmentList } from './useAppointmentList';
import { useAppointmentListFilters } from './useAppointmentListFilters';

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

describe('useAppointmentList', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches the list with default filters', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [
                { id: 'apt-1', appointmentNumber: 'APT1', patientId: 'pat-1', department: 'OPD', scheduledAt: '2026-07-10T09:00:00Z', durationMinutes: 30, reason: null, appointmentType: 'scheduled', status: 'scheduled', createdAt: null },
            ],
            meta: { currentPage: 1, perPage: 10, total: 1, lastPage: 1 },
        });

        const filters = useAppointmentListFilters();
        const list = await mount(() => useAppointmentList(filters));

        expect(list.data.value?.data).toHaveLength(1);
        expect(getSpy).toHaveBeenCalledWith(
            '/appointments',
            expect.objectContaining({ status: 'scheduled', page: 1, perPage: 10, sortBy: 'scheduledAt', sortDir: 'asc' }),
        );
    });

    it('sends null, not empty strings, for blank optional filters', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 10, total: 0, lastPage: 1 },
        });

        const filters = useAppointmentListFilters();
        await mount(() => useAppointmentList(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/appointments',
            expect.objectContaining({ q: null, department: null, from: null, to: null }),
        );
    });

    it('refetches when a filter changes', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 10, total: 0, lastPage: 1 },
        });

        const filters = useAppointmentListFilters();
        await mount(() => useAppointmentList(filters));
        expect(getSpy).toHaveBeenCalledTimes(1);

        filters.status = 'completed';
        await vi.waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2));
        expect(getSpy).toHaveBeenLastCalledWith('/appointments', expect.objectContaining({ status: 'completed' }));
    });
});
