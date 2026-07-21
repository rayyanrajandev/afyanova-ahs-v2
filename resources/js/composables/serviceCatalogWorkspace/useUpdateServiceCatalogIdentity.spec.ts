import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { render } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import * as apiClient from '@/lib/apiClient';
import { useUpdateServiceCatalogIdentity } from './useUpdateServiceCatalogIdentity';

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

describe('useUpdateServiceCatalogIdentity', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes /billing-service-catalog/items/{itemId} without itemId/idempotencyKey in the body', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'item-1' } });

        const update = await mount(() => useUpdateServiceCatalogIdentity());
        await update.mutateAsync({
            itemId: 'item-1',
            serviceCode: 'CONSULT-OPD-001',
            serviceName: 'OPD Consultation',
            serviceType: 'consultation',
            departmentId: null,
            unit: 'visit',
            facilityTier: null,
            codes: null,
            idempotencyKey: 'req-key-1',
        });

        expect(patchSpy).toHaveBeenCalledWith('/billing-service-catalog/items/item-1', expect.objectContaining({
            entitlementContext: 'Billing service catalog identity update',
            idempotencyKey: 'req-key-1',
            requestId: 'req-key-1',
        }));
        const [, options] = patchSpy.mock.calls[0];
        expect(options?.body).not.toHaveProperty('itemId');
        expect(options?.body).not.toHaveProperty('idempotencyKey');
        expect(options?.body).toMatchObject({ serviceCode: 'CONSULT-OPD-001' });
    });
});
