import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * Matches PharmacyMedicationAvailabilityResponseTransformer::transform()
 * exactly (app/Modules/Pharmacy/Presentation/Http/Transformers/PharmacyMedicationAvailabilityResponseTransformer.php).
 * `currentStock` is reservation/FEFO-aware (GetPharmacyMedicationAvailabilityUseCase
 * -> InventoryBatchStockService::enrichItemAvailability()) — the real
 * dispensable quantity, not raw on-hand stock. `onHandStock` is the raw
 * current_stock column (a decimal-cast Eloquent field, so it may arrive
 * as a numeric string, e.g. "480.000" — normalize with Number() before
 * doing arithmetic).
 */
export type PharmacyMedicationAvailability = {
    id: string;
    itemCode: string | null;
    itemName: string | null;
    unit: string | null;
    dispensingUnit: string | null;
    conversionFactor: number | string | null;
    currentStock: number | string | null;
    onHandStock: number | string | null;
    reorderLevel: number | string | null;
    maxStockLevel: number | string | null;
    status: string | null;
    stockState: 'out_of_stock' | 'low_stock' | 'healthy' | string | null;
    batchTrackingMode: 'tracked' | 'untracked' | string | null;
    blockedBatchQuantity: number | string | null;
};

type PharmacyMedicationAvailabilityResponse = { data: PharmacyMedicationAvailability | null };

/**
 * GET /pharmacy-orders/availability (PharmacyOrderController::availability)
 * — resolves the best active inventory match for a medication code/name
 * via the same fuzzy findBestActiveMatchByCodeOrName() every dispense
 * ultimately re-resolves against (no stable FK between an order and an
 * inventory item), enriched with reservation-aware availability. `data`
 * is null when no active inventory match exists for this medication.
 */
export function usePharmacyMedicationAvailability(
    medicationCode: MaybeRefOrGetter<string | null | undefined>,
    medicationName: MaybeRefOrGetter<string | null | undefined>,
    enabled: MaybeRefOrGetter<boolean>,
): UseQueryReturnType<PharmacyMedicationAvailability | null, Error> {
    return useQuery({
        queryKey: [
            'pharmacy-medication-availability',
            computed(() => toValue(medicationCode)),
            computed(() => toValue(medicationName)),
        ],
        queryFn: async () => {
            const response = await apiGet<PharmacyMedicationAvailabilityResponse>('/pharmacy-orders/availability', {
                medicationCode: toValue(medicationCode)?.trim() || null,
                medicationName: toValue(medicationName)?.trim() || null,
            });
            return response.data;
        },
        enabled: computed(() => toValue(enabled) && Boolean(toValue(medicationCode)?.trim() || toValue(medicationName)?.trim())),
    });
}
