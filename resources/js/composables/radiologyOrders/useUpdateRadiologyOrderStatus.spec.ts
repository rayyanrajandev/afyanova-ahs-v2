import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useUpdateRadiologyOrderStatus } from './useUpdateRadiologyOrderStatus';

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

describe('useUpdateRadiologyOrderStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the radiology order status endpoint', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'rad-1', status: 'completed' } });

        const update = await mount(() => useUpdateRadiologyOrderStatus());
        await update.mutateAsync({ id: 'rad-1', status: 'completed', reportSummary: 'No acute abnormality.' });

        expect(patchSpy).toHaveBeenCalledWith('/radiology-orders/rad-1/status', {
            body: { status: 'completed', reportSummary: 'No acute abnormality.' },
        });
    });

    it('propagates a forward-only-transition error', async () => {
        const error = Object.assign(new Error('Invalid radiology workflow transition.'), {
            payload: { errors: { status: ['Invalid radiology workflow transition.'] } },
        });
        vi.spyOn(apiClient, 'apiPatch').mockRejectedValue(error);

        const update = await mount(() => useUpdateRadiologyOrderStatus());

        await expect(update.mutateAsync({ id: 'rad-1', status: 'ordered' })).rejects.toThrow(
            'Invalid radiology workflow transition.',
        );
    });
});
