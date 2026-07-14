import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useTriageQueueStatusCounts } from './useTriageQueueStatusCounts';

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

describe('useTriageQueueStatusCounts', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches counts from /reception/triage-queue/status-counts', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: { waiting: 3, inProgress: 1, completed: 5, cancelled: 2 },
        });

        const counts = await mount(() => useTriageQueueStatusCounts());

        expect(getSpy).toHaveBeenCalledWith('/reception/triage-queue/status-counts');
        expect(counts.data.value?.waiting).toBe(3);
        expect(counts.data.value?.inProgress).toBe(1);
    });
});
