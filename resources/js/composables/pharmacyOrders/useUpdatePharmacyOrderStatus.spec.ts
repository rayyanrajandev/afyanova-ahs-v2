import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useUpdatePharmacyOrderStatus } from './useUpdatePharmacyOrderStatus';

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

describe('useUpdatePharmacyOrderStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the pharmacy order status endpoint', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'ph-1', status: 'dispensed' } });

        const update = await mount(() => useUpdatePharmacyOrderStatus());
        await update.mutateAsync({ id: 'ph-1', status: 'dispensed', quantityDispensed: 30, dispensedUnit: 'tablets' });

        expect(patchSpy).toHaveBeenCalledWith('/pharmacy-orders/ph-1/status', {
            body: { status: 'dispensed', quantityDispensed: 30, dispensedUnit: 'tablets' },
        });
    });

    it('propagates an insufficient-stock error', async () => {
        const error = Object.assign(new Error('Insufficient stock to dispense this quantity.'), {
            payload: { errors: { quantityDispensed: ['Insufficient stock to dispense this quantity.'] } },
        });
        vi.spyOn(apiClient, 'apiPatch').mockRejectedValue(error);

        const update = await mount(() => useUpdatePharmacyOrderStatus());

        await expect(update.mutateAsync({ id: 'ph-1', status: 'dispensed', quantityDispensed: 999 })).rejects.toThrow(
            'Insufficient stock to dispense this quantity.',
        );
    });
});
