import { reactive } from 'vue';

/**
 * Matches ListAdmissionsUseCase's filter shape 1:1
 * (app/Modules/Admission/Application/UseCases/ListAdmissionsUseCase.php):
 * q, status, ward, from/to, sortBy, sortDir, page, perPage. Same pattern
 * as useDirectServiceFilters.ts/useAppointmentListFilters.ts. No default
 * status filter — an admissions queue's whole point is seeing every active
 * inpatient at a glance, matching the emergency queue's own reasoning.
 */
export function useAdmissionFilters() {
    return reactive({
        q: '',
        status: '' as string,
        ward: '',
        from: '',
        to: '',
        page: 1,
        perPage: 20,
        sortBy: 'admittedAt' as string,
        sortDir: 'desc' as 'asc' | 'desc',
    });
}

export type AdmissionFilters = ReturnType<typeof useAdmissionFilters>;
