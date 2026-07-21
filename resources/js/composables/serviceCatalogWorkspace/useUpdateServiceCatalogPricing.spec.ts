import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { render } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import * as apiClient from '@/lib/apiClient';
import { useUpdateServiceCatalogPricing } from './useUpdateServiceCatalogPricing';

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

describe('useUpdateServiceCatalogPricing', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes /billing-service-catalog/items/{itemId} without itemId/idempotencyKey in the body', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'item-1' } });

        const update = await mount(() => useUpdateServiceCatalogPricing());
        await update.mutateAsync({
            itemId: 'item-1',
            basePrice: 30000,
            currencyCode: 'TZS',
            taxRatePercent: null,
            isTaxable: null,
            effectiveFrom: null,
            effectiveTo: null,
            description: null,
            metadata: null,
            idempotencyKey: 'req-key-2',
        });

        expect(patchSpy).toHaveBeenCalledWith('/billing-service-catalog/items/item-1', expect.objectContaining({
            entitlementContext: 'Billing service catalog pricing update',
            idempotencyKey: 'req-key-2',
            requestId: 'req-key-2',
        }));
        const [, options] = patchSpy.mock.calls[0];
        expect(options?.body).not.toHaveProperty('itemId');
        expect(options?.body).toMatchObject({ basePrice: 30000, currencyCode: 'TZS' });
    });
});
