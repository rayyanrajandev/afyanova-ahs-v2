import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useUpdateEmergencyCaseStatus } from './useUpdateEmergencyCaseStatus';

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

describe('useUpdateEmergencyCaseStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the case status endpoint with status/reason/dispositionNotes', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'case-1', status: 'triaged' } });

        const update = await mount(() => useUpdateEmergencyCaseStatus());
        await update.mutateAsync({ caseId: 'case-1', status: 'triaged' });

        expect(patchSpy).toHaveBeenCalledWith('/emergency-triage-cases/case-1/status', {
            body: { status: 'triaged', reason: null, dispositionNotes: null, bedResourceId: null },
        });
    });

    it('sends dispositionNotes and bedResourceId when admitting', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'case-1', status: 'admitted' } });

        const update = await mount(() => useUpdateEmergencyCaseStatus());
        await update.mutateAsync({
            caseId: 'case-1',
            status: 'admitted',
            dispositionNotes: 'Admitted to Ward 3 for observation.',
            bedResourceId: 'bed-1',
        });

        expect(patchSpy).toHaveBeenCalledWith('/emergency-triage-cases/case-1/status', {
            body: { status: 'admitted', reason: null, dispositionNotes: 'Admitted to Ward 3 for observation.', bedResourceId: 'bed-1' },
        });
    });
});
