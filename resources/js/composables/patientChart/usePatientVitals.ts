import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';

export type PatientVitalSet = {
    id: string;
    patientId: string;
    recordedByUserId: number | null;
    recordedAt: string | null;
    temperatureC: number | null;
    heartRateBpm: number | null;
    systolicBpMmhg: number | null;
    diastolicBpMmhg: number | null;
    oxygenSaturationPct: number | null;
    respiratoryRateBpm: number | null;
    weightKg: number | null;
    entryState: string;
    updatedAt: string | null;
};

export function usePatientLatestVitals(patientId: Ref<string>) {
    return useQuery({
        queryKey: ['patient-latest-vitals', patientId],
        queryFn: () =>
            apiGet<{ data: PatientVitalSet | null }>(`/patient-vitals/patient/${patientId.value}`).then((r) => r.data),
        enabled: computed(() => patientId.value.trim() !== ''),
    });
}

export function useVitalSetCreate(patientId: Ref<string>) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (body: Record<string, unknown>) =>
            apiPost<{ data: PatientVitalSet }>('/patient-vitals/chart', { body }).then((r) => r.data),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['patient-latest-vitals', patientId] });
        },
    });
}

export function useVitalSetUpdate(patientId: Ref<string>) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { vitalSetId: string; body: Record<string, unknown> }) =>
            apiPatch<{ data: PatientVitalSet }>(`/patient-vitals/${params.vitalSetId}`, { body: params.body }).then((r) => r.data),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['patient-latest-vitals', patientId] });
        },
    });
}
