import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useBillingPayerContractOptions } from './useBillingPayerContractOptions';

async function mount<T>(build: () => T): Promise<T> {
    let composable!: T;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const TestComponent = defineComponent({
        setup() {
            composable = build();
            return () => h('div');
        },
    });

    render(TestComponent, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));

    return composable;
}

describe('useBillingPayerContractOptions', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches active payer contracts sorted by contract name', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'contract-1', contractCode: 'NHIF-01', contractName: 'NHIF Standard', payerType: 'insurance', payerName: 'NHIF', payerPlanCode: null, payerPlanName: null, currencyCode: 'TZS', status: 'active' }],
        });

        const { options } = await mount(() => useBillingPayerContractOptions());

        expect(getSpy).toHaveBeenCalledWith('/billing-payer-contracts', { status: 'active', perPage: 200, sortBy: 'contractName', sortDir: 'asc' });
        expect(options.value).toHaveLength(1);
        expect(options.value[0].value).toBe('contract-1');
        expect(options.value[0].label).toBe('NHIF Standard');
    });

    it('falls back to contract code or payer name when no contract name exists', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'contract-2', contractCode: 'CASH-01', contractName: null, payerType: 'cash', payerName: null, payerPlanCode: null, payerPlanName: null, currencyCode: null, status: 'active' }],
        });

        const { options } = await mount(() => useBillingPayerContractOptions());

        expect(options.value[0].label).toBe('CASH-01');
    });
});
