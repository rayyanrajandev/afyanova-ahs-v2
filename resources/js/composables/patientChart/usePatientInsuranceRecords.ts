import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * Backs ShowV2.vue's Insurance tab — GET /patients/{id}/insurance, the same
 * endpoint the legacy patients/Index.vue Details sheet's Overview tab
 * embedded as cards (reports/patients-index-audit.md §1). Split out to its
 * own tab here rather than folded into Overview, since insurance
 * management (add/verify) is a real, separate workflow, not a glance-only
 * summary — that lighter view already lives in
 * PatientDetailSheet.vue's `insurance` field.
 */
export type PatientChartInsuranceRecord = {
    id: string;
    insuranceType: string | null;
    insuranceProvider: string | null;
    providerCode: string | null;
    planName: string | null;
    policyNumber: string | null;
    memberId: string | null;
    principalMemberName: string | null;
    relationshipToPrincipal: string | null;
    cardNumber: string | null;
    effectiveDate: string | null;
    expiryDate: string | null;
    coverageLevel: string | null;
    copayPercent: number | null;
    coverageLimitAmount: number | null;
    status: string | null;
    verificationStatus: string | null;
    verificationDate: string | null;
    verificationSource: string | null;
    verificationReference: string | null;
    lastVerifiedAt: string | null;
    notes: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type PatientInsuranceListResponse = { data: PatientChartInsuranceRecord[] };

export function usePatientInsuranceRecords(
    patientId: Ref<string>,
    enabled: Ref<boolean> = computed(() => true),
): UseQueryReturnType<PatientChartInsuranceRecord[], Error> {
    return useQuery({
        queryKey: ['patient-chart-insurance', patientId],
        queryFn: async () => {
            const response = await apiGet<PatientInsuranceListResponse>(`/patients/${patientId.value}/insurance`);
            return response.data;
        },
        enabled: computed(() => patientId.value.trim() !== '' && enabled.value),
    });
}
