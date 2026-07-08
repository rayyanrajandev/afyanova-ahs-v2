import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { PatientChartAllergy } from '@/composables/patientChart/usePatientAllergies';
import type { PatientChartMedicationProfile } from '@/composables/patientChart/usePatientMedicationProfile';

export type PatientChartReconciliationPharmacyOrder = {
    id: string;
    orderNumber: string | null;
    medicationCode: string | null;
    medicationName: string | null;
    dosageInstruction: string | null;
    dispensedAt: string | null;
};

export type PatientChartMedicationReconciliation = {
    counts: {
        activeAllergies: number;
        activeMedicationProfile: number;
        activeDispensedOrders: number;
        unreconciledDispensedOrders: number;
        continueCandidates: number;
        reviewRequired: number;
    };
    activeAllergies: PatientChartAllergy[];
    activeMedicationProfile: PatientChartMedicationProfile[];
    activeDispensedOrders: PatientChartReconciliationPharmacyOrder[];
    unreconciledDispensedOrders: PatientChartReconciliationPharmacyOrder[];
    continueCandidates: PatientChartReconciliationPharmacyOrder[];
    profileWithoutDispensedOrders: PatientChartMedicationProfile[];
    newOrdersToProfile: PatientChartReconciliationPharmacyOrder[];
    suggestedActions: string[];
};

type Response = { data: PatientChartMedicationReconciliation };

export function usePatientMedicationReconciliation(
    patientId: Ref<string>,
): UseQueryReturnType<PatientChartMedicationReconciliation, Error> {
    return useQuery({
        queryKey: ['patient-chart-medication-reconciliation', patientId],
        queryFn: async () => {
            const response = await apiGet<Response>(`/patients/${patientId.value}/medication-reconciliation`);
            return response.data;
        },
        enabled: computed(() => patientId.value.trim() !== ''),
    });
}
