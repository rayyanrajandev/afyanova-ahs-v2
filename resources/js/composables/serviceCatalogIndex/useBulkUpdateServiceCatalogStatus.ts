import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { CatalogItem, CatalogStatus } from '@/lib/billingServiceCatalog';

export type BulkUpdateServiceCatalogStatusPayload = {
    itemIds: string[];
    status: CatalogStatus;
    reason: string | null;
};

type BulkUpdateServiceCatalogStatusResponse = { data: CatalogItem[]; meta: { updated: number; notFound: string[] } };

export function useBulkUpdateServiceCatalogStatus(): UseMutationReturnType<
    BulkUpdateServiceCatalogStatusResponse,
    Error,
    BulkUpdateServiceCatalogStatusPayload,
    unknown
> {
    return useMutation({
        mutationFn: (payload: BulkUpdateServiceCatalogStatusPayload) =>
            apiPatch<BulkUpdateServiceCatalogStatusResponse>('/billing-service-catalog/items/bulk-status', {
                body: payload,
                entitlementContext: 'Billing service catalog bulk status',
            }),
    });
}
