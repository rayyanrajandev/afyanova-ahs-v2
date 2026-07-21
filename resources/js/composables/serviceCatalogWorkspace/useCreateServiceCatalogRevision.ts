import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPost } from '@/lib/apiClient';
import type { CatalogItem, CatalogResponse } from '@/lib/billingServiceCatalog';

export type CreateServiceCatalogRevisionPayload = {
    itemId: string;
    basePrice: number;
    taxRatePercent: number | null;
    isTaxable: boolean | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    idempotencyKey: string;
};

export function useCreateServiceCatalogRevision(): UseMutationReturnType<CatalogItem, Error, CreateServiceCatalogRevisionPayload, unknown> {
    return useMutation({
        mutationFn: async ({ itemId, idempotencyKey, ...payload }: CreateServiceCatalogRevisionPayload) => {
            const response = await apiPost<CatalogResponse>(`/billing-service-catalog/items/${itemId}/revisions`, {
                body: payload,
                entitlementContext: 'Billing service catalog revision create',
                idempotencyKey,
                requestId: idempotencyKey,
            });
            return response.data;
        },
    });
}
