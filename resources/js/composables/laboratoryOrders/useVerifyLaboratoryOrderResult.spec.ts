import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useVerifyLaboratoryOrderResult } from './useVerifyLaboratoryOrderResult';

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

describe('useVerifyLaboratoryOrderResult', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the laboratory order verify endpoint', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'lab-1', verifiedAt: '2026-01-01T00:00:00Z' } });

        const verify = await mount(() => useVerifyLaboratoryOrderResult());
        await verify.mutateAsync({ id: 'lab-1', verificationNote: 'Checked against critical result protocol.' });

        expect(patchSpy).toHaveBeenCalledWith('/laboratory-orders/lab-1/verify', {
            body: { verificationNote: 'Checked against critical result protocol.' },
        });
    });
});
