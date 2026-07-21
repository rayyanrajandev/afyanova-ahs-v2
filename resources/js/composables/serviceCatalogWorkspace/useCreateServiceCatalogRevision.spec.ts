import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { render } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import * as apiClient from '@/lib/apiClient';
import { useCreateServiceCatalogRevision } from './useCreateServiceCatalogRevision';

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

describe('useCreateServiceCatalogRevision', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('POSTs /billing-service-catalog/items/{itemId}/revisions without itemId/idempotencyKey in the body', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({ data: { id: 'item-2' } });

        const create = await mount(() => useCreateServiceCatalogRevision());
        await create.mutateAsync({
            itemId: 'item-1',
            basePrice: 32000,
            taxRatePercent: null,
            isTaxable: null,
            effectiveFrom: '2026-08-01T00:00:00Z',
            effectiveTo: null,
            description: null,
            metadata: null,
            idempotencyKey: 'req-key-3',
        });

        expect(postSpy).toHaveBeenCalledWith('/billing-service-catalog/items/item-1/revisions', expect.objectContaining({
            entitlementContext: 'Billing service catalog revision create',
            idempotencyKey: 'req-key-3',
            requestId: 'req-key-3',
        }));
        const [, options] = postSpy.mock.calls[0];
        expect(options?.body).not.toHaveProperty('itemId');
        expect(options?.body).toMatchObject({ basePrice: 32000, effectiveFrom: '2026-08-01T00:00:00Z' });
    });
});
