import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useUpdateEmergencyTransferStatus } from './useUpdateEmergencyTransferStatus';

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

describe('useUpdateEmergencyTransferStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the transfer status endpoint', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'transfer-1', status: 'accepted' } });

        const update = await mount(() => useUpdateEmergencyTransferStatus());
        await update.mutateAsync({ caseId: 'case-1', transferId: 'transfer-1', status: 'accepted' });

        expect(patchSpy).toHaveBeenCalledWith('/emergency-triage-cases/case-1/transfers/transfer-1/status', {
            body: { status: 'accepted', reason: null, clinicalHandoffNotes: null },
        });
    });

    it('sends a reason when cancelling', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'transfer-1', status: 'cancelled' } });

        const update = await mount(() => useUpdateEmergencyTransferStatus());
        await update.mutateAsync({ caseId: 'case-1', transferId: 'transfer-1', status: 'cancelled', reason: 'No longer needed.' });

        expect(patchSpy).toHaveBeenCalledWith('/emergency-triage-cases/case-1/transfers/transfer-1/status', {
            body: { status: 'cancelled', reason: 'No longer needed.', clinicalHandoffNotes: null },
        });
    });
});
