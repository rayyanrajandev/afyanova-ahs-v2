import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { CatalogItem, CatalogResponse, StandardsCodes } from '@/lib/billingServiceCatalog';

export type CreateServiceCatalogItemPayload = {
    clinicalCatalogItemId: string | null;
    serviceCode: string;
    serviceName: string;
    serviceType: string | null;
    departmentId: string | null;
    unit: string | null;
    basePrice: number;
    currencyCode: string;
    taxRatePercent: number | null;
    isTaxable: boolean | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    description: string | null;
    facilityTier: string | null;
    codes: StandardsCodes | null;
    priceUnit: string | null;
    unitsPerPack: number | null;
    metadata: Record<string, unknown> | null;
    idempotencyKey: string;
};

export function useCreateServiceCatalogItem(): UseMutationReturnType<CatalogItem, Error, CreateServiceCatalogItemPayload, unknown> {
    return useMutation({
        mutationFn: async ({ idempotencyKey, ...payload }: CreateServiceCatalogItemPayload) => {
            const response = await apiPost<CatalogResponse>('/billing-service-catalog/items', {
                body: payload,
                entitlementContext: 'Billing service catalog create',
                idempotencyKey,
                requestId: idempotencyKey,
            });
            return response.data;
        },
    });
}
