import { reactive } from 'vue';

/**
 * Filters for the medical records registry — matches ListMedicalRecordsUseCase's
 * filter shape 1:1 (see app/Modules/MedicalRecord/Application/UseCases/ListMedicalRecordsUseCase.php).
 * Deliberately does not include authorUserId — confirmed in Phase 0 as backend-supported
 * but never exposed in the old page's UI either; left dormant here too (see
 * reports/medical-records-index-rebuild-plan.md §8).
 */
export function useMedicalRecordListFilters() {
    return reactive({
        q: '',
        status: '' as string,
        recordType: '' as string,
        patientId: '',
        encounterId: '',
        appointmentId: '',
        appointmentReferralId: '',
        admissionId: '',
        theatreProcedureId: '',
        from: '',
        to: '',
        page: 1,
        perPage: 20,
        sortBy: 'encounterAt',
        sortDir: 'desc' as 'asc' | 'desc',
    });
}

export type MedicalRecordListFilters = ReturnType<typeof useMedicalRecordListFilters>;
