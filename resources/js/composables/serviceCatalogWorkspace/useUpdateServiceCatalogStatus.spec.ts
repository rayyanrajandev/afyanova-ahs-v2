import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { render } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import * as apiClient from '@/lib/apiClient';
import { useUpdateServiceCatalogStatus } from './useUpdateServiceCatalogStatus';

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

describe('useUpdateServiceCatalogStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes /billing-service-catalog/items/{itemId}/status without itemId/idempotencyKey in the body', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'item-1' } });

        const update = await mount(() => useUpdateServiceCatalogStatus());
        await update.mutateAsync({
            itemId: 'item-1',
            status: 'retired',
            reason: 'Superseded by new tariff',
            idempotencyKey: 'req-key-4',
        });

        expect(patchSpy).toHaveBeenCalledWith('/billing-service-catalog/items/item-1/status', expect.objectContaining({
            entitlementContext: 'Billing service catalog status update',
            idempotencyKey: 'req-key-4',
            requestId: 'req-key-4',
        }));
        const [, options] = patchSpy.mock.calls[0];
        expect(options?.body).not.toHaveProperty('itemId');
        expect(options?.body).toMatchObject({ status: 'retired', reason: 'Superseded by new tariff' });
    });
});
