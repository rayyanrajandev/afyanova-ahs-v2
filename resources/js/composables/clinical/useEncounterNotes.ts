import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { MedicalRecordResponse } from '@/types/medicalRecord';

type MedicalRecordListResponse = {
    data: MedicalRecordResponse[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

/**
 * Lists every clinical note belonging to one encounter — not just the single
 * "primary" note the Encounter Workspace bundle (useEncounterWorkspace.ts)
 * resolves. Backs the Workspace's Notes panel, which lets a clinician see
 * and switch between multiple notes on the same encounter (e.g. several
 * progress notes over a multi-day admission) instead of only ever the one
 * primary note. No backend change — GET /medical-records already supports
 * this exact encounterId filter (ListMedicalRecordsUseCase.php:46-49).
 */
export function useEncounterNotes(
    encounterId: MaybeRefOrGetter<string | null | undefined>,
): UseQueryReturnType<MedicalRecordListResponse, Error> {
    return useQuery({
        queryKey: ['encounter-notes', computed(() => toValue(encounterId))],
        queryFn: () => {
            const id = toValue(encounterId);
            if (!id) {
                throw new Error('An encounter id is required to load notes.');
            }

            return apiGet<MedicalRecordListResponse>('/medical-records', {
                encounterId: id,
                perPage: 100,
            });
        },
        enabled: computed(() => Boolean(toValue(encounterId))),
    });
}
