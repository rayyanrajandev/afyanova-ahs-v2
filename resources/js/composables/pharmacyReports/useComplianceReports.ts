import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { PaginationMeta } from './useInventoryReports';

export type ComplianceReportFilters = {
    from: string;
    to: string;
    q: string;
    patientId?: string;
    itemId?: string;
    payerName?: string;
    claimStatus?: string;
    page?: number;
    perPage?: number;
};

export type ControlledDrugItem = {
    id: string;
    orderNumber: string | null;
    dispensedAt: string | null;
    patientId: string | null;
    patientName: string | null;
    medicineName: string | null;
    strength: string | null;
    dosageForm: string | null;
    schedule: string | null;
    batchNumber: string | null;
    quantityDispensed: number;
    unit: string | null;
    prescriberUserId: number | null;
    prescriberName: string | null;
    verifierUserId: number | null;
    verifierName: string | null;
};

export type InsuranceClaimItem = {
    id: string;
    pharmacyOrderId: string | null;
    itemName: string | null;
    patientId: string | null;
    patientName: string | null;
    payerName: string | null;
    payerType: string | null;
    claimStatus: string | null;
    quantityDispensed: number;
    totalCost: number | null;
    approvedAmount: number | null;
    rejectedAmount: number | null;
    submittedAt: string | null;
    adjudicatedAt: string | null;
    nhifCode: string | null;
};

export type ClaimsSummary = {
    totalClaims: number;
    pendingClaims: number;
    submittedClaims: number;
    approvedClaims: number;
    rejectedClaims: number;
    totalApprovedAmount: number;
    totalRejectedAmount: number;
};

type PaginatedResponse<T> = {
    data: T[];
    meta: PaginationMeta;
};

type ClaimsResponse = PaginatedResponse<InsuranceClaimItem> & {
    summary: ClaimsSummary;
};

function filterQuery(filters: ComplianceReportFilters) {
    return {
        from: filters.from || null,
        to: filters.to || null,
        q: filters.q.trim() || null,
        patientId: filters.patientId || null,
        itemId: filters.itemId || null,
        payerName: filters.payerName || null,
        claimStatus: filters.claimStatus || null,
        page: filters.page || null,
        perPage: filters.perPage || null,
    };
}

function useComplianceQuery<T>(key: string, path: string, filters: MaybeRefOrGetter<ComplianceReportFilters>): UseQueryReturnType<T, Error> {
    const filtersKey = computed(() => JSON.stringify(toValue(filters)));
    return useQuery({
        queryKey: ['pharmacy-reports', 'compliance', key, filtersKey],
        queryFn: () => apiGet<T>(path, filterQuery(toValue(filters))),
    });
}

export function useControlledDrugsRegister(filters: MaybeRefOrGetter<ComplianceReportFilters>): UseQueryReturnType<PaginatedResponse<ControlledDrugItem>, Error> {
    return useComplianceQuery<PaginatedResponse<ControlledDrugItem>>('controlled-drugs', '/pharmacy-reports/compliance/controlled-drugs', filters);
}

export function useInsuranceClaims(filters: MaybeRefOrGetter<ComplianceReportFilters>): UseQueryReturnType<ClaimsResponse, Error> {
    return useComplianceQuery<ClaimsResponse>('insurance-claims', '/pharmacy-reports/compliance/insurance-claims', filters);
}
