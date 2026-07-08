import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { MedicalRecordListFilters } from './useMedicalRecordListFilters';

export type MedicalRecordListItem = {
    id: string;
    recordNumber: string | null;
    patientId: string | null;
    encounterId: string | null;
    admissionId: string | null;
    appointmentId: string | null;
    appointmentReferralId: string | null;
    theatreProcedureId: string | null;
    authorUserId: number | null;
    encounterAt: string | null;
    recordType: string | null;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    diagnosisCode: string | null;
    status: string | null;
    statusReason: string | null;
    signedByUserId: number | null;
    signedByUserName: string | null;
    authorUserName: string | null;
    signedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type MedicalRecordListResponse = {
    data: MedicalRecordListItem[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

export type MedicalRecordStatusCounts = {
    draft: number;
    finalized: number;
    amended: number;
    archived: number;
    total: number;
};

type MedicalRecordStatusCountsResponse = { data: MedicalRecordStatusCounts };

function filterQuery(filters: MedicalRecordListFilters) {
    return {
        q: filters.q.trim() || null,
        status: filters.status || null,
        recordType: filters.recordType || null,
        patientId: filters.patientId.trim() || null,
        encounterId: filters.encounterId.trim() || null,
        appointmentId: filters.appointmentId.trim() || null,
        appointmentReferralId: filters.appointmentReferralId.trim() || null,
        admissionId: filters.admissionId.trim() || null,
        theatreProcedureId: filters.theatreProcedureId.trim() || null,
        from: filters.from || null,
        to: filters.to || null,
    };
}

export function useMedicalRecordList(
    filters: MedicalRecordListFilters,
): UseQueryReturnType<MedicalRecordListResponse, Error> {
    return useQuery({
        queryKey: ['medical-records-index', computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<MedicalRecordListResponse>('/medical-records', {
                ...filterQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
                sortBy: filters.sortBy,
                sortDir: filters.sortDir,
            }),
    });
}

export function useMedicalRecordStatusCounts(
    filters: MedicalRecordListFilters,
): UseQueryReturnType<MedicalRecordStatusCounts, Error> {
    return useQuery({
        queryKey: ['medical-records-index-status-counts', computed(() => ({ ...filters }))],
        queryFn: async () => {
            const response = await apiGet<MedicalRecordStatusCountsResponse>(
                '/medical-records/status-counts',
                filterQuery(filters),
            );
            return response.data;
        },
    });
}
