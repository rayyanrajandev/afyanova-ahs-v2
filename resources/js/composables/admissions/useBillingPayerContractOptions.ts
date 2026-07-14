import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type ComputedRef } from 'vue';
import { apiGet } from '@/lib/apiClient';
import { financialClassLabel } from '@/lib/financialCoverage';
import type { SearchableSelectOption } from '@/lib/patientLocations';

/**
 * AdmD of the Admission V2 full-parity plan — ported from the legacy
 * admissions/Index.vue's createBillingPayerContractOptions (Index.vue:896-914).
 * `GET /billing-payer-contracts` (gated by billing.payer-contracts.read,
 * matching the legacy page's own permission check), no reusable composable
 * existed for this anywhere in the codebase before now.
 */
export type BillingPayerContract = {
    id: string;
    contractCode: string | null;
    contractName: string | null;
    payerType: string | null;
    payerName: string | null;
    payerPlanCode: string | null;
    payerPlanName: string | null;
    currencyCode: string | null;
    status: string | null;
};

type BillingPayerContractListResponse = { data: BillingPayerContract[] };

function payerContractLabel(contract: BillingPayerContract): string {
    return (contract.contractName ?? contract.contractCode ?? contract.payerName ?? 'Unnamed payer contract').trim();
}

function payerContractDescription(contract: BillingPayerContract): string {
    return [contract.contractCode, contract.payerName, contract.payerPlanName, contract.currencyCode]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join(' | ');
}

export function useBillingPayerContractOptions(): { options: ComputedRef<SearchableSelectOption[]>; query: UseQueryReturnType<BillingPayerContract[], Error> } {
    const query = useQuery({
        queryKey: ['billing-payer-contracts'],
        queryFn: async () => {
            const response = await apiGet<BillingPayerContractListResponse>('/billing-payer-contracts', {
                status: 'active',
                perPage: 200,
                sortBy: 'contractName',
                sortDir: 'asc',
            });
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const options = computed<SearchableSelectOption[]>(() =>
        (query.data.value ?? []).map((contract) => ({
            value: contract.id,
            label: payerContractLabel(contract),
            description: payerContractDescription(contract),
            group: financialClassLabel(contract.payerType),
            keywords: [contract.contractCode, contract.contractName, contract.payerName, contract.payerPlanCode, contract.payerPlanName, contract.currencyCode, financialClassLabel(contract.payerType)]
                .map((value) => String(value ?? '').trim())
                .filter(Boolean),
        })),
    );

    return { options, query };
}
