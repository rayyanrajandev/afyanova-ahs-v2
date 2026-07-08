import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, reactive } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type EncounterListItem = {
    id: string;
    encounterNumber: string | null;
    patientId: string | null;
    patientNumber: string | null;
    patientName: string | null;
    appointmentId: string | null;
    admissionId: string | null;
    primaryClinicianUserId: number | null;
    primaryClinicianName: string | null;
    status: string | null;
    statusReason: string | null;
    openedAt: string | null;
    closedAt: string | null;
    hasMedicalRecord: boolean;
    latestMedicalRecordStatus: string | null;
    latestMedicalRecordType: string | null;
    latestMedicalRecordNumber: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type EncounterListResponse = {
    data: EncounterListItem[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

export type EncounterStatusCounts = {
    opened: number;
    in_progress: number;
    ready_for_sign: number;
    signed: number;
    closed: number;
    amended: number;
    cancelled: number;
    other: number;
    total: number;
};

type EncounterStatusCountsResponse = { data: EncounterStatusCounts };

/**
 * Filters for the encounters list — matches ListEncountersUseCase's filter
 * shape 1:1 (see app/Modules/Encounter/Application/UseCases/ListEncountersUseCase.php).
 */
export function useEncounterListFilters() {
    return reactive({
        q: '',
        status: '' as string,
        patientId: '',
        primaryClinicianUserId: '' as string,
        from: '',
        to: '',
        page: 1,
        perPage: 20,
        sortBy: 'openedAt',
        sortDir: 'desc' as 'asc' | 'desc',
    });
}

export type EncounterListFilters = ReturnType<typeof useEncounterListFilters>;

export function useEncounterList(
    filters: EncounterListFilters,
): UseQueryReturnType<EncounterListResponse, Error> {
    return useQuery({
        queryKey: ['encounters', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<EncounterListResponse>('/encounters', {
                q: filters.q.trim() || null,
                status: filters.status || null,
                patientId: filters.patientId.trim() || null,
                primaryClinicianUserId:
                    filters.primaryClinicianUserId.trim() || null,
                from: filters.from || null,
                to: filters.to || null,
                page: filters.page,
                perPage: filters.perPage,
                sortBy: filters.sortBy,
                sortDir: filters.sortDir,
            }),
    });
}

export function useEncounterStatusCounts(
    filters: EncounterListFilters,
): UseQueryReturnType<EncounterStatusCounts, Error> {
    return useQuery({
        queryKey: ['encounter-status-counts', computed(() => ({ ...filters }))],
        queryFn: async () => {
            const response = await apiGet<EncounterStatusCountsResponse>(
                '/encounters/status-counts',
                {
                    q: filters.q.trim() || null,
                    patientId: filters.patientId.trim() || null,
                    primaryClinicianUserId:
                        filters.primaryClinicianUserId.trim() || null,
                    from: filters.from || null,
                    to: filters.to || null,
                },
            );
            return response.data;
        },
    });
}
