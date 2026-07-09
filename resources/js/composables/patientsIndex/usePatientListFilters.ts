import { reactive } from 'vue';

/**
 * Filters for the patient registry — matches ListPatientsUseCase's filter
 * shape 1:1 (app/Modules/Patient/Application/UseCases/ListPatientsUseCase.php):
 * q, status, gender, region, district, sortBy (patientNumber/firstName/
 * lastName/createdAt/updatedAt), sortDir, page, perPage. Same pattern as
 * useMedicalRecordListFilters.ts.
 *
 * Deliberately does not restore filters from the URL query string on load,
 * unlike the legacy page (patients/Index.vue's queryParam()/
 * queryStatusParam() helpers) — useMedicalRecordListFilters.ts establishes
 * no such convention either. Whether deep-linkable filtered views are worth
 * reintroducing is a feature-parity call for Phase 6's checklist
 * (reports/patients-index-modernization-plan.md §2.1), not resolved here.
 */
export function usePatientListFilters() {
    return reactive({
        q: '',
        status: 'active' as string,
        gender: '' as string,
        region: '',
        district: '',
        page: 1,
        perPage: 10,
        sortBy: 'createdAt' as string,
        sortDir: 'desc' as 'asc' | 'desc',
    });
}

export type PatientListFilters = ReturnType<typeof usePatientListFilters>;
