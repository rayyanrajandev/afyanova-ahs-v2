import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { render } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import * as apiClient from '@/lib/apiClient';
import { useCreateServiceCatalogItem } from './useCreateServiceCatalogItem';

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

describe('useCreateServiceCatalogItem', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('POSTs /billing-service-catalog/items with idempotency headers and without the idempotencyKey field in the body', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({ data: { id: 'item-1' } });

        const create = await mount(() => useCreateServiceCatalogItem());
        await create.mutateAsync({
            clinicalCatalogItemId: null,
            serviceCode: 'CONSULT-OPD-001',
            serviceName: 'OPD Consultation',
            serviceType: 'consultation',
            departmentId: null,
            unit: 'visit',
            basePrice: 25000,
            currencyCode: 'TZS',
            taxRatePercent: null,
            isTaxable: null,
            effectiveFrom: null,
            effectiveTo: null,
            description: null,
            facilityTier: null,
            codes: null,
            priceUnit: null,
            unitsPerPack: null,
            metadata: null,
            idempotencyKey: 'req-key-1',
        });

        expect(postSpy).toHaveBeenCalledWith('/billing-service-catalog/items', expect.objectContaining({
            entitlementContext: 'Billing service catalog create',
            idempotencyKey: 'req-key-1',
            requestId: 'req-key-1',
        }));
        const [, options] = postSpy.mock.calls[0];
        expect(options?.body).not.toHaveProperty('idempotencyKey');
        expect(options?.body).toMatchObject({ serviceCode: 'CONSULT-OPD-001', basePrice: 25000 });
    });
});
