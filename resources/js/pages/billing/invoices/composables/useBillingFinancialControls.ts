import { ref, type Ref } from 'vue';

import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

import type {
    BillingFinancialControlsSummary,
    SearchForm,
} from '../types';

type BillingApiRequest = <T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: {
        query?: Record<string, string | number | boolean | string[] | null | undefined>;
        body?: Record<string, unknown>;
    },
) => Promise<T>;

type LoadBillingFinancialControlsOptions = {
    apiRequest: BillingApiRequest;
    searchForm: SearchForm;
    canReadBillingFinancialControls: Ref<boolean>;
    billingBoardBootstrapComplete: Ref<boolean>;
};

type ExportBillingFinancialControlsOptions = {
    searchForm: SearchForm;
    canReadBillingFinancialControls: Ref<boolean>;
};

function buildFinancialControlsSummaryExportUrl(searchForm: SearchForm): string {
    const url = new URL(
        '/api/v1/billing-invoices/financial-controls/summary/export',
        window.location.origin,
    );

    const currencyCode = searchForm.currencyCode.trim();
    if (currencyCode) {
        url.searchParams.set('currencyCode', currencyCode);
    }
    if (searchForm.from) {
        url.searchParams.set('from', `${searchForm.from} 00:00:00`);
    }
    if (searchForm.to) {
        url.searchParams.set('to', `${searchForm.to} 23:59:59`);
    }

    return url.toString();
}

export function useBillingFinancialControls() {
    const billingFinancialControlsSummary =
        ref<BillingFinancialControlsSummary | null>(null);
    const billingFinancialControlsLoading = ref(false);
    const billingFinancialControlsError = ref<string | null>(null);
    const billingFinancialControlsExporting = ref(false);

    async function loadFinancialControlsSummary(
        options: LoadBillingFinancialControlsOptions,
    ) {
        if (!options.canReadBillingFinancialControls.value) {
            billingFinancialControlsSummary.value = null;
            billingFinancialControlsError.value = null;
            billingFinancialControlsLoading.value = false;
            options.billingBoardBootstrapComplete.value = true;
            return;
        }

        billingFinancialControlsLoading.value = true;
        billingFinancialControlsError.value = null;

        try {
            const response = await options.apiRequest<{
                data: BillingFinancialControlsSummary;
            }>('GET', '/billing-invoices/financial-controls/summary', {
                query: {
                    currencyCode:
                        options.searchForm.currencyCode.trim() || null,
                    from: options.searchForm.from
                        ? `${options.searchForm.from} 00:00:00`
                        : null,
                    to: options.searchForm.to
                        ? `${options.searchForm.to} 23:59:59`
                        : null,
                },
            });
            billingFinancialControlsSummary.value = response.data;
        } catch (error) {
            billingFinancialControlsSummary.value = null;
            billingFinancialControlsError.value = messageFromUnknown(
                error,
                'Unable to load financial controls summary.',
            );
        } finally {
            billingFinancialControlsLoading.value = false;
            options.billingBoardBootstrapComplete.value = true;
        }
    }

    function exportFinancialControlsSummaryCsv(
        options: ExportBillingFinancialControlsOptions,
    ) {
        if (
            billingFinancialControlsExporting.value ||
            !options.canReadBillingFinancialControls.value
        ) {
            return;
        }

        billingFinancialControlsExporting.value = true;
        try {
            const anchor = document.createElement('a');
            anchor.href = buildFinancialControlsSummaryExportUrl(
                options.searchForm,
            );
            anchor.target = '_blank';
            anchor.rel = 'noopener';
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            notifySuccess('Financial controls CSV export started.');
        } catch (error) {
            notifyError(
                messageFromUnknown(
                    error,
                    'Unable to export financial controls summary.',
                ),
            );
        } finally {
            billingFinancialControlsExporting.value = false;
        }
    }

    return {
        billingFinancialControlsSummary,
        billingFinancialControlsLoading,
        billingFinancialControlsError,
        billingFinancialControlsExporting,
        loadFinancialControlsSummary,
        exportFinancialControlsSummaryCsv,
    };
}
