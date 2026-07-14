import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useReconcilePharmacyOrder } from './useReconcilePharmacyOrder';

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

    return composable;
}

describe('useReconcilePharmacyOrder', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the pharmacy order reconciliation endpoint', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'ph-1', reconciliationStatus: 'completed' } });

        const reconcile = await mount(() => useReconcilePharmacyOrder());
        await reconcile.mutateAsync({
            id: 'ph-1',
            reconciliationStatus: 'completed',
            reconciliationDecision: 'add_to_current_list',
        });

        expect(patchSpy).toHaveBeenCalledWith('/pharmacy-orders/ph-1/reconciliation', {
            body: { reconciliationStatus: 'completed', reconciliationDecision: 'add_to_current_list' },
        });
    });
});
