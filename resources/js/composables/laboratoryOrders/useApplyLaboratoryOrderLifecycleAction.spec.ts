import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useApplyLaboratoryOrderLifecycleAction } from './useApplyLaboratoryOrderLifecycleAction';

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

describe('useApplyLaboratoryOrderLifecycleAction', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('POSTs the laboratory order lifecycle endpoint', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({ data: { id: 'lab-1', status: 'cancelled' } });

        const applyLifecycleAction = await mount(() => useApplyLaboratoryOrderLifecycleAction());
        await applyLifecycleAction.mutateAsync({ id: 'lab-1', action: 'cancel', reason: 'Ordered in error.' });

        expect(postSpy).toHaveBeenCalledWith('/laboratory-orders/lab-1/lifecycle', {
            body: { action: 'cancel', reason: 'Ordered in error.' },
        });
    });
});
