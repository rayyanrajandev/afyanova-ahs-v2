import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useUpdatePharmacyOrderPolicy } from './useUpdatePharmacyOrderPolicy';

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

describe('useUpdatePharmacyOrderPolicy', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the pharmacy order policy endpoint', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'ph-1', formularyDecisionStatus: 'formulary' } });

        const updatePolicy = await mount(() => useUpdatePharmacyOrderPolicy());
        await updatePolicy.mutateAsync({
            id: 'ph-1',
            formularyDecisionStatus: 'formulary',
            substitutionAllowed: true,
            substitutionMade: false,
        });

        expect(patchSpy).toHaveBeenCalledWith('/pharmacy-orders/ph-1/policy', {
            body: {
                formularyDecisionStatus: 'formulary',
                substitutionAllowed: true,
                substitutionMade: false,
            },
        });
    });
});
