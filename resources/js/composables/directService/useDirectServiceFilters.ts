import { reactive } from 'vue';

/**
 * Matches ListServiceRequestsUseCase's filter shape 1:1
 * (app/Modules/ServiceRequest/Application/UseCases/ListServiceRequestsUseCase.php):
 * serviceType, status, priority, from/to, sortDir, page, perPage — that use
 * case has no free-text search parameter at all (unlike Appointment/
 * Emergency), so this filter set deliberately has no `q` field either.
 * departmentId is a client-visible filter only for actors who hold
 * service.requests.view-all-departments — everyone else is hard-scoped
 * server-side (ServiceRequestDepartmentScopeResolver) and any value sent
 * here is ignored by the backend, so the page only renders the department
 * Select for those actors. No default status filter, matching the
 * emergency queue's reasoning: the whole point of this page is seeing every
 * open ticket for the department at a glance.
 */
export function useDirectServiceFilters() {
    return reactive({
        status: '' as string,
        priority: '' as string,
        departmentId: '' as string,
        from: '',
        to: '',
        page: 1,
        perPage: 20,
        sortDir: 'asc' as 'asc' | 'desc',
    });
}

export type DirectServiceFilters = ReturnType<typeof useDirectServiceFilters>;
