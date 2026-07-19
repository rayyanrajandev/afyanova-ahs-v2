import { reactive } from 'vue';

/**
 * Filters for the Cash Payments accounts list — matches
 * ListCashBillingAccountsRequest's rules 1:1
 * (app/Modules/Billing/Presentation/Http/Requests/ListCashBillingAccountsRequest.php):
 * q, status ('active' | 'settled' | 'suspended'), page, perPage.
 *
 * Initial values are read from the URL query string so a refresh, a
 * bookmarked link, or the browser back button lands back on the same
 * filtered list — the same "remembered filters" contract as
 * useBillingCashierQueueFilters.ts. billing/CashV2.vue keeps the URL in
 * sync as filters change.
 */
function readParam(params: URLSearchParams, key: string): string {
    return params.get(key) ?? '';
}

export function useCashAccountsFilters() {
    const params = new URLSearchParams(window.location.search);

    const page = parseInt(readParam(params, 'page'), 10);
    const perPage = parseInt(readParam(params, 'perPage'), 10);

    return reactive({
        q: readParam(params, 'q'),
        status: (readParam(params, 'status') || 'all') as 'all' | 'active' | 'settled' | 'suspended',
        page: Number.isFinite(page) && page > 0 ? page : 1,
        perPage: Number.isFinite(perPage) && perPage > 0 ? perPage : 20,
    });
}

export type CashAccountsFilters = ReturnType<typeof useCashAccountsFilters>;
