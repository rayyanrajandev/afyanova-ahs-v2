import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { PaginationMeta } from './useInventoryReports';

export type DispensingReportFilters = {
    from: string;
    to: string;
    q: string;
    patientId?: string;
    itemId?: string;
    batchNumber?: string;
    warehouseId?: string;
    payerName?: string;
    claimStatus?: string;
    page?: number;
    perPage?: number;
};

export type DispensedMedicineItem = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    patientName: string | null;
    medicineCode: string | null;
    medicineName: string | null;
    quantityDispensed: number;
    unit: string | null;
    dispensedAt: string | null;
    dispensedByUserId: number | null;
    dispensedByName: string | null;
    internalBatchNumber: string | null;
    batchNumber: string | null;
    unitCost: number | null;
    totalCost: number | null;
};

export type BatchTrackingItem = {
    id: string;
    itemId: string | null;
    itemCode: string | null;
    itemName: string | null;
    internalBatchNumber: string | null;
    batchNumber: string | null;
    lotNumber: string | null;
    manufactureDate: string | null;
    expiryDate: string | null;
    receivedQuantity: number;
    currentQuantity: number;
    dispensedQuantity: number;
    unitCost: number | null;
    warehouseId: string | null;
    supplierId: string | null;
    status: string | null;
};

export type MedicinesByClinicianItem = {
    userId: number;
    clinicianName: string | null;
    orderCount: number;
    totalQuantity: number;
    patientCount: number;
};

type PaginatedResponse<T> = {
    data: T[];
    meta: PaginationMeta;
};

function filterQuery(filters: DispensingReportFilters) {
    return {
        q: filters.q || null,
        from: filters.from || null,
        to: filters.to || null,
        patientId: filters.patientId || null,
        itemId: filters.itemId || null,
        batchNumber: filters.batchNumber || null,
        warehouseId: filters.warehouseId || null,
        payerName: filters.payerName || null,
        claimStatus: filters.claimStatus || null,
        page: filters.page || null,
        perPage: filters.perPage || null,
    };
}

function useDispensingQuery<T>(
    key: string,
    path: string,
    filters: MaybeRefOrGetter<DispensingReportFilters>,
): UseQueryReturnType<PaginatedResponse<T>, Error> {
    const filtersKey = computed(() => JSON.stringify(toValue(filters)));
    return useQuery({
        queryKey: ['pharmacy-reports', 'dispensing', key, filtersKey],
        queryFn: () => apiGet<PaginatedResponse<T>>(path, filterQuery(toValue(filters))),
    });
}

export function useDispensedMedicines(filters: MaybeRefOrGetter<DispensingReportFilters>): UseQueryReturnType<PaginatedResponse<DispensedMedicineItem>, Error> {
    return useDispensingQuery<DispensedMedicineItem>('dispensed-medicines', '/pharmacy-reports/dispensing/dispensed-medicines', filters);
}

export function useBatchTracking(filters: MaybeRefOrGetter<DispensingReportFilters>): UseQueryReturnType<PaginatedResponse<BatchTrackingItem>, Error> {
    return useDispensingQuery<BatchTrackingItem>('batch-tracking', '/pharmacy-reports/dispensing/batch-tracking', filters);
}

export function useMedicinesByClinician(filters: MaybeRefOrGetter<DispensingReportFilters>): UseQueryReturnType<PaginatedResponse<MedicinesByClinicianItem>, Error> {
    return useDispensingQuery<MedicinesByClinicianItem>('by-clinician', '/pharmacy-reports/dispensing/by-clinician', filters);
}
