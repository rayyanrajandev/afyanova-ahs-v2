import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { render } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import * as apiClient from '@/lib/apiClient';
import { useBulkUpdateServiceCatalogStatus } from './useBulkUpdateServiceCatalogStatus';

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

describe('useBulkUpdateServiceCatalogStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes /billing-service-catalog/items/bulk-status with the selected ids, status, and reason', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: [], meta: { updated: 2, notFound: [] } });

        const bulkUpdate = await mount(() => useBulkUpdateServiceCatalogStatus());
        const result = await bulkUpdate.mutateAsync({
            itemIds: ['item-1', 'item-2'],
            status: 'inactive',
            reason: 'Superseded tariff',
        });

        expect(patchSpy).toHaveBeenCalledWith('/billing-service-catalog/items/bulk-status', {
            body: { itemIds: ['item-1', 'item-2'], status: 'inactive', reason: 'Superseded tariff' },
            entitlementContext: 'Billing service catalog bulk status',
        });
        expect(result.meta.updated).toBe(2);
    });
});
