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

type PatientVitalsResponse = {
    latest: PatientVitalSet | null;
    history: PatientVitalSet[];
};

export function usePatientVitals(patientId: Ref<string>) {
    const query = useQuery({
        queryKey: ['patient-vitals', patientId],
        queryFn: () =>
            apiGet<{ data: PatientVitalsResponse }>(`/patient-vitals/patient/${patientId.value}`).then((r) => r.data),
        enabled: computed(() => patientId.value.trim() !== ''),
    });

    const latest = computed(() => query.data.value?.latest ?? null);
    const history = computed(() => query.data.value?.history ?? []);

    return { query, latest, history };
}

export function useVitalSetCreate(patientId: Ref<string>) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (body: Record<string, unknown>) =>
            apiPost<{ data: PatientVitalSet }>('/patient-vitals/chart', { body }).then((r) => r.data),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['patient-vitals', patientId] });
        },
    });
}

export function useVitalSetUpdate(patientId: Ref<string>) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (params: { vitalSetId: string; body: Record<string, unknown> }) =>
            apiPatch<{ data: PatientVitalSet }>(`/patient-vitals/${params.vitalSetId}`, { body: params.body }).then((r) => r.data),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['patient-vitals', patientId] });
        },
    });
}
