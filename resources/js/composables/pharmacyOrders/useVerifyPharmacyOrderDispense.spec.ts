import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useVerifyPharmacyOrderDispense } from './useVerifyPharmacyOrderDispense';

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

describe('useVerifyPharmacyOrderDispense', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the pharmacy order verify endpoint', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'ph-1', verifiedAt: '2026-01-01T00:00:00Z' } });

        const verify = await mount(() => useVerifyPharmacyOrderDispense());
        await verify.mutateAsync({ id: 'ph-1', verificationNote: 'Checked against order.' });

        expect(patchSpy).toHaveBeenCalledWith('/pharmacy-orders/ph-1/verify', {
            body: { verificationNote: 'Checked against order.' },
        });
    });
});
