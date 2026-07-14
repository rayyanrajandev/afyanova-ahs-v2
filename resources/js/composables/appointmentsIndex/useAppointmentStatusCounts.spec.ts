import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useAppointmentStatusCounts } from './useAppointmentStatusCounts';
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

    return composable;
}

describe('useAppointmentStatusCounts', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches counts from /appointments/status-counts', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: { scheduled: 4, completed: 2, cancelled: 1, no_show: 0, total: 7 },
        });

        const filters = useAppointmentListFilters();
        const counts = await mount(() => useAppointmentStatusCounts(filters));

        expect(getSpy).toHaveBeenCalledWith(
            '/appointments/status-counts',
            expect.objectContaining({ q: null, department: null, from: null, to: null }),
        );
        expect(counts.data.value?.total).toBe(7);
    });
});
