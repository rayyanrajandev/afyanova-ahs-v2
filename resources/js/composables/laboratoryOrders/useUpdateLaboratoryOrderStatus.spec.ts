import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useUpdateLaboratoryOrderStatus } from './useUpdateLaboratoryOrderStatus';

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

describe('useUpdateLaboratoryOrderStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the laboratory order status endpoint', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'lab-1', status: 'completed' } });

        const update = await mount(() => useUpdateLaboratoryOrderStatus());
        await update.mutateAsync({ id: 'lab-1', status: 'completed', resultSummary: 'Result Flag: Normal' });

        expect(patchSpy).toHaveBeenCalledWith('/laboratory-orders/lab-1/status', {
            body: { status: 'completed', resultSummary: 'Result Flag: Normal' },
        });
    });

    it('propagates a forward-only-transition error', async () => {
        const error = Object.assign(new Error('This transition is not allowed.'), {
            payload: { errors: { status: ['This transition is not allowed.'] } },
        });
        vi.spyOn(apiClient, 'apiPatch').mockRejectedValue(error);

        const update = await mount(() => useUpdateLaboratoryOrderStatus());

        await expect(update.mutateAsync({ id: 'lab-1', status: 'ordered' })).rejects.toThrow(
            'This transition is not allowed.',
        );
    });
});
