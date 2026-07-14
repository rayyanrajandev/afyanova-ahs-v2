import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useClinicianQueueStatusCounts } from './useClinicianQueueStatusCounts';

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

describe('useClinicianQueueStatusCounts', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches counts from /reception/clinician-queue/status-counts', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: { waiting: 4, onHold: 1, inProgress: 2, completed: 6 },
        });

        const counts = await mount(() => useClinicianQueueStatusCounts());

        expect(getSpy).toHaveBeenCalledWith('/reception/clinician-queue/status-counts');
        expect(counts.data.value?.waiting).toBe(4);
        expect(counts.data.value?.onHold).toBe(1);
    });
});
