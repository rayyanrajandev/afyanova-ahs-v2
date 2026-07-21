import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { CatalogItem, CatalogResponse } from '@/lib/billingServiceCatalog';

export type UpdateServiceCatalogPricingPayload = {
    itemId: string;
    basePrice: number;
    currencyCode: string;
    taxRatePercent: number | null;
    isTaxable: boolean | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    idempotencyKey: string;
};

export function useUpdateServiceCatalogPricing(): UseMutationReturnType<CatalogItem, Error, UpdateServiceCatalogPricingPayload, unknown> {
    return useMutation({
        mutationFn: async ({ itemId, idempotencyKey, ...payload }: UpdateServiceCatalogPricingPayload) => {
            const response = await apiPatch<CatalogResponse>(`/billing-service-catalog/items/${itemId}`, {
                body: payload,
                entitlementContext: 'Billing service catalog pricing update',
                idempotencyKey,
                requestId: idempotencyKey,
            });
            return response.data;
        },
    });
}
