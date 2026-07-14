import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useTriageCompletedToday } from './useTriageCompletedToday';

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

describe('useTriageCompletedToday', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches the completed-today endpoint when enabled', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ appointmentId: 'apt-1', status: 'waiting_provider', patientName: 'Test Patient' }],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        });

        const result = await mount(() => useTriageCompletedToday(true, 1));

        expect(getSpy).toHaveBeenCalledWith('/reception/triage-queue/completed-today', { page: 1, perPage: 20 });
        expect(result.data.value?.data).toHaveLength(1);
    });

    it('does not fetch when disabled', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 1, perPage: 20, total: 0, lastPage: 1 },
        });

        await mount(() => useTriageCompletedToday(false, 1));

        expect(getSpy).not.toHaveBeenCalled();
    });

    it('sends the requested page', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [],
            meta: { currentPage: 2, perPage: 20, total: 0, lastPage: 2 },
        });

        const page = ref(2);
        await mount(() => useTriageCompletedToday(true, page));

        expect(getSpy).toHaveBeenCalledWith('/reception/triage-queue/completed-today', { page: 2, perPage: 20 });
    });
});
