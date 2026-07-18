import { reactive } from 'vue';

/**
 * Filters for the patient registry — matches ListPatientsUseCase's filter
 * shape 1:1 (app/Modules/Patient/Application/UseCases/ListPatientsUseCase.php):
 * q, status, gender, region, district, registrationWindow, ageGroup,
 * insuranceType, sortBy (patientNumber/firstName/lastName/createdAt/
 * updatedAt), sortDir, page, perPage.
 *
 * Initial values are read from the URL query string so that a link like
 * `/patients?q=...` (e.g. from GlobalPatientSearch.vue's "View all matching
 * patients") or a bookmarked/shared filtered view lands pre-filtered instead
 * of showing an empty search box. patients/IndexV2.vue is responsible for
 * keeping the URL in sync as filters change (via history.replaceState, not
 * an Inertia visit, so this composable's reactive state and the TanStack
 * Query cache survive filter changes untouched).
 */
function readParam(params: URLSearchParams, key: string): string {
    return params.get(key) ?? '';
}

export function usePatientListFilters() {
    const params = new URLSearchParams(window.location.search);

    const status = readParam(params, 'status');
    const sortDir = readParam(params, 'sortDir');
    const page = parseInt(readParam(params, 'page'), 10);
    const perPage = parseInt(readParam(params, 'perPage'), 10);

    // 'all' is a distinct URL value from "no status param at all": the Tabs
    // control's "All" option maps to filters.status = '' (see IndexV2.vue's
    // setStatus()), which must round-trip through the URL as its own value
    // rather than being indistinguishable from "no filter present" (which
    // defaults to 'active') — otherwise refreshing on the "All" tab silently
    // reverts to "Active".
    const resolvedStatus = status === 'all' ? '' : status || 'active';

    return reactive({
        q: readParam(params, 'q'),
        status: resolvedStatus as string,
        gender: readParam(params, 'gender') as string,
        region: readParam(params, 'region'),
        district: readParam(params, 'district'),
        registrationWindow: readParam(params, 'registrationWindow') as '' | 'today' | 'this_week' | 'this_month',
        ageGroup: readParam(params, 'ageGroup') as '' | 'child' | 'adult' | 'elderly',
        insuranceType: readParam(params, 'insuranceType') as '' | 'cash' | 'insurance',
        page: Number.isFinite(page) && page > 0 ? page : 1,
        perPage: Number.isFinite(perPage) && perPage > 0 ? perPage : 50,
        sortBy: (readParam(params, 'sortBy') || 'createdAt') as string,
        sortDir: (sortDir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
    });
}

export type PatientListFilters = ReturnType<typeof usePatientListFilters>;
