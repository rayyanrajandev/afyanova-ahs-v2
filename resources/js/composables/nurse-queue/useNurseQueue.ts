import { useMutation, useQuery, type UseMutationReturnType, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, reactive } from 'vue';
import { apiGet, apiPost } from '@/lib/apiClient';

export type NurseQueueFilters = ReturnType<typeof useNurseQueueFilters>;

export function useNurseQueueFilters() {
    return reactive({
        page: 1,
        perPage: 20,
    });
}

export type NurseQueuePatient = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    phone: string | null;
    age: number | null;
};

export type NurseQueueEncounter = {
    id: string;
    encounterNumber: string | null;
    patientId: string | null;
    appointmentId: string | null;
    status: string | null;
    type: string | null;
    openedAt: string | null;
    patient: NurseQueuePatient | null;
};

type NurseQueueListResponse = {
    data: NurseQueueEncounter[];
    meta: { currentPage: number; perPage: number; total: number; lastPage: number };
};

export function useNurseQueue(filters: NurseQueueFilters): UseQueryReturnType<NurseQueueListResponse, Error> {
    return useQuery({
        queryKey: ['nurse-queue', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<NurseQueueListResponse>('/nurse-queue', {
                page: filters.page,
                perPage: filters.perPage,
            }),
        refetchInterval: 15_000,
    });
}

export type AssessPayloadItem = {
    catalogItemId?: string | null;
    itemName: string;
    itemCode?: string | null;
    serviceType: string;
    quantity: number;
};

export type AssessPayload = {
    clinicalNote: string;
    items: AssessPayloadItem[];
};

type AssessResponse = { data: { id: string } };

export function useSubmitNurseAssessment(): UseMutationReturnType<AssessResponse, Error, { encounterId: string } & AssessPayload, unknown> {
    return useMutation({
        mutationFn: async ({ encounterId, ...payload }) => {
            const response = await apiPost<AssessResponse>(`/nurse-queue/${encounterId}/assess`, { body: payload as unknown as Record<string, unknown> });
            return response;
        },
    });
}
