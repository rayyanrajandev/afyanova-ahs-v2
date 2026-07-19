import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useUpdateEmergencyCaseStatus } from './useUpdateEmergencyCaseStatus';

async function mount<T>(
    build: () => T,
    queryClient: QueryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    }),
): Promise<{ composable: T; queryClient: QueryClient }> {
    let composable!: T;
    const TestComponent = defineComponent({
        setup() {
            composable = build();
            return () => h('div');
        },
    });

    render(TestComponent, {
        global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    });
    await flushPromises();

    return { composable, queryClient };
}

describe('useUpdateEmergencyCaseStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the case status endpoint with status/reason/dispositionNotes', async () => {
        const patchSpy = vi
            .spyOn(apiClient, 'apiPatch')
            .mockResolvedValue({ data: { id: 'case-1', status: 'triaged' } });

        const { composable: update } = await mount(() =>
            useUpdateEmergencyCaseStatus(),
        );
        await update.mutateAsync({ caseId: 'case-1', status: 'triaged' });

        expect(patchSpy).toHaveBeenCalledWith(
            '/emergency-triage-cases/case-1/status',
            {
                body: {
                    status: 'triaged',
                    reason: null,
                    dispositionNotes: null,
                    bedResourceId: null,
                },
            },
        );
    });

    it('sends dispositionNotes and bedResourceId when admitting', async () => {
        const patchSpy = vi
            .spyOn(apiClient, 'apiPatch')
            .mockResolvedValue({ data: { id: 'case-1', status: 'admitted' } });

        const { composable: update } = await mount(() =>
            useUpdateEmergencyCaseStatus(),
        );
        await update.mutateAsync({
            caseId: 'case-1',
            status: 'admitted',
            dispositionNotes: 'Admitted to Ward 3 for observation.',
            bedResourceId: 'bed-1',
        });

        expect(patchSpy).toHaveBeenCalledWith(
            '/emergency-triage-cases/case-1/status',
            {
                body: {
                    status: 'admitted',
                    reason: null,
                    dispositionNotes: 'Admitted to Ward 3 for observation.',
                    bedResourceId: 'bed-1',
                },
            },
        );
    });

    it('optimistically patches the case status and drops it from a status-filtered cache it no longer matches', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        const waitingQueue = {
            data: [
                {
                    id: 'case-1',
                    status: 'waiting',
                    triagedAt: null,
                    statusReason: null,
                    dispositionNotes: null,
                    completedAt: null,
                },
                {
                    id: 'case-2',
                    status: 'waiting',
                    triagedAt: null,
                    statusReason: null,
                    dispositionNotes: null,
                    completedAt: null,
                },
            ],
            meta: { currentPage: 1, perPage: 20, total: 2, lastPage: 1 },
        };
        const allCasesQueue = {
            data: [
                {
                    id: 'case-1',
                    status: 'waiting',
                    triagedAt: null,
                    statusReason: null,
                    dispositionNotes: null,
                    completedAt: null,
                },
            ],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        };
        queryClient.setQueryData(
            ['emergency-cases', { status: 'waiting' }],
            waitingQueue,
        );
        queryClient.setQueryData(
            ['emergency-cases', { status: '' }],
            allCasesQueue,
        );

        let resolvePatch!: (value: { data: Record<string, unknown> }) => void;
        vi.spyOn(apiClient, 'apiPatch').mockReturnValue(
            new Promise((resolve) => {
                resolvePatch = resolve;
            }),
        );

        const { composable: update } = await mount(
            () => useUpdateEmergencyCaseStatus(),
            queryClient,
        );
        const pending = update.mutateAsync({
            caseId: 'case-1',
            status: 'triaged',
        });
        await flushPromises();

        // Filtered to status=waiting: case-1 no longer matches, so it's dropped.
        expect(
            queryClient.getQueryData([
                'emergency-cases',
                { status: 'waiting' },
            ]),
        ).toEqual({
            data: [
                {
                    id: 'case-2',
                    status: 'waiting',
                    triagedAt: null,
                    statusReason: null,
                    dispositionNotes: null,
                    completedAt: null,
                },
            ],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        });
        // Unfiltered "all" view: case-1 stays, patched in place with the new status.
        const allCasesResult = queryClient.getQueryData([
            'emergency-cases',
            { status: '' },
        ]) as typeof allCasesQueue;
        expect(allCasesResult.data).toHaveLength(1);
        expect(allCasesResult.data[0].status).toBe('triaged');
        expect(allCasesResult.data[0].triagedAt).not.toBeNull();

        resolvePatch({ data: { id: 'case-1', status: 'triaged' } });
        await pending;
    });

    it('rolls back the optimistic status patch if the request fails', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        const waitingQueue = {
            data: [
                {
                    id: 'case-1',
                    status: 'waiting',
                    triagedAt: null,
                    statusReason: null,
                    dispositionNotes: null,
                    completedAt: null,
                },
            ],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        };
        queryClient.setQueryData(
            ['emergency-cases', { status: 'waiting' }],
            waitingQueue,
        );
        vi.spyOn(apiClient, 'apiPatch').mockRejectedValue(
            new Error('network down'),
        );

        const { composable: update } = await mount(
            () => useUpdateEmergencyCaseStatus(),
            queryClient,
        );
        await expect(
            update.mutateAsync({ caseId: 'case-1', status: 'triaged' }),
        ).rejects.toThrow('network down');

        expect(
            queryClient.getQueryData([
                'emergency-cases',
                { status: 'waiting' },
            ]),
        ).toEqual(waitingQueue);
    });
});
