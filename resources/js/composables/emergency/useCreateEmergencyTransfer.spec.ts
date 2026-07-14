import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useCreateEmergencyTransfer } from './useCreateEmergencyTransfer';

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

describe('useCreateEmergencyTransfer', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('POSTs the case transfers endpoint without caseId in the body', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({ data: { id: 'transfer-1', status: 'requested' } });

        const create = await mount(() => useCreateEmergencyTransfer());
        await create.mutateAsync({
            caseId: 'case-1',
            transferType: 'internal',
            priority: 'urgent',
            destinationLocation: 'ICU',
        });

        expect(postSpy).toHaveBeenCalledWith('/emergency-triage-cases/case-1/transfers', {
            body: { transferType: 'internal', priority: 'urgent', destinationLocation: 'ICU' },
        });
    });
});
