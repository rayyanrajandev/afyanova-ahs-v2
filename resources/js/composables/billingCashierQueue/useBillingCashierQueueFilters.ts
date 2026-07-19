import { reactive } from 'vue';

/**
 * Filters for the billing Cashier Queue — matches
 * ListCashierQueueUseCase's filter shape 1:1
 * (app/Modules/Billing/Application/UseCases/ListCashierQueueUseCase.php): q,
 * status ('all' | 'in_consultation' | 'unpaid' | 'paid'), page, perPage.
 *
 * Initial values are read from the URL query string so a refresh, a
 * bookmarked link, or the browser back button lands back on the same
 * filtered queue instead of resetting to "all" — the same "remembered
 * filters" contract as usePatientListFilters.ts. billing/IndexV2.vue keeps
 * the URL in sync as filters change (history.replaceState, not an Inertia
 * visit, so this composable's reactive state and the TanStack Query cache
 * survive filter changes untouched).
 */
function readParam(params: URLSearchParams, key: string): string {
    return params.get(key) ?? '';
}

export function useBillingCashierQueueFilters() {
    const params = new URLSearchParams(window.location.search);

    const page = parseInt(readParam(params, 'page'), 10);
    const perPage = parseInt(readParam(params, 'perPage'), 10);

    return reactive({
        q: readParam(params, 'q'),
        status: (readParam(params, 'status') || 'all') as 'all' | 'in_consultation' | 'unpaid' | 'paid',
        page: Number.isFinite(page) && page > 0 ? page : 1,
        perPage: Number.isFinite(perPage) && perPage > 0 ? perPage : 20,
    });
}

export type BillingCashierQueueFilters = ReturnType<typeof useBillingCashierQueueFilters>;
