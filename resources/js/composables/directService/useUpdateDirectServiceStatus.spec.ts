import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useUpdateDirectServiceStatus } from './useUpdateDirectServiceStatus';

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

describe('useUpdateDirectServiceStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the service request status endpoint', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'sr-1', status: 'in_progress' } });

        const update = await mount(() => useUpdateDirectServiceStatus());
        await update.mutateAsync({ requestId: 'sr-1', status: 'in_progress' });

        expect(patchSpy).toHaveBeenCalledWith('/service-requests/sr-1/status', {
            body: { status: 'in_progress', statusReason: null },
        });
    });

    it('sends statusReason when closing a ticket', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'sr-1', status: 'completed' } });

        const update = await mount(() => useUpdateDirectServiceStatus());
        await update.mutateAsync({ requestId: 'sr-1', status: 'completed', statusReason: 'Results delivered.' });

        expect(patchSpy).toHaveBeenCalledWith('/service-requests/sr-1/status', {
            body: { status: 'completed', statusReason: 'Results delivered.' },
        });
    });
});
