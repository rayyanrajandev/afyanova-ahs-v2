import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useRecordTriage } from './useRecordTriage';

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

describe('useRecordTriage', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes /appointments/{id}/triage with the recorded vitals and routing', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({
            data: {
                id: 'apt-1',
                patientId: 'pat-1',
                status: 'waiting_provider',
                department: 'OPD',
                checkedInAt: '2026-07-09T08:00:00Z',
            },
        });

        const { composable: triage } = await mount(() => useRecordTriage());
        const result = await triage.mutateAsync({
            appointmentId: 'apt-1',
            triageVitalsSummary: 'BP 118/74, Pulse 82 bpm',
            triageCategory: 'P3',
            department: 'OPD',
        });

        expect(patchSpy).toHaveBeenCalledWith('/appointments/apt-1/triage', {
            body: {
                triageVitalsSummary: 'BP 118/74, Pulse 82 bpm',
                triageCategory: 'P3',
                department: 'OPD',
            },
        });
        expect(result.status).toBe('waiting_provider');
    });

    it('optimistically drops the appointment from cached waiting_triage queues before the request resolves', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        const waitingTriageQueue = {
            data: [{ appointmentId: 'apt-1' }, { appointmentId: 'apt-2' }],
            meta: { currentPage: 1, perPage: 20, total: 2, lastPage: 1 },
        };
        const waitingProviderQueue = {
            data: [{ appointmentId: 'apt-9' }],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        };
        queryClient.setQueryData(
            ['reception-queue', { stage: 'waiting_triage' }],
            waitingTriageQueue,
        );
        queryClient.setQueryData(
            ['reception-queue', { stage: 'waiting_provider' }],
            waitingProviderQueue,
        );

        let resolvePatch!: (value: { data: Record<string, unknown> }) => void;
        vi.spyOn(apiClient, 'apiPatch').mockReturnValue(
            new Promise((resolve) => {
                resolvePatch = resolve;
            }),
        );

        const { composable: triage } = await mount(
            () => useRecordTriage(),
            queryClient,
        );
        const pending = triage.mutateAsync({
            appointmentId: 'apt-1',
            triageVitalsSummary: 'BP 118/74',
        });
        await flushPromises();

        expect(
            queryClient.getQueryData([
                'reception-queue',
                { stage: 'waiting_triage' },
            ]),
        ).toEqual({
            data: [{ appointmentId: 'apt-2' }],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        });
        // Other stages' cached queues aren't touched by this optimistic update.
        expect(
            queryClient.getQueryData([
                'reception-queue',
                { stage: 'waiting_provider' },
            ]),
        ).toEqual(waitingProviderQueue);

        resolvePatch({ data: { id: 'apt-1', status: 'waiting_provider' } });
        await pending;
    });

    it('rolls back the optimistic removal if the request fails', async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        });
        const waitingTriageQueue = {
            data: [{ appointmentId: 'apt-1' }],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        };
        queryClient.setQueryData(
            ['reception-queue', { stage: 'waiting_triage' }],
            waitingTriageQueue,
        );
        vi.spyOn(apiClient, 'apiPatch').mockRejectedValue(
            new Error('network down'),
        );

        const { composable: triage } = await mount(
            () => useRecordTriage(),
            queryClient,
        );
        await expect(
            triage.mutateAsync({
                appointmentId: 'apt-1',
                triageVitalsSummary: 'BP 118/74',
            }),
        ).rejects.toThrow('network down');

        expect(
            queryClient.getQueryData([
                'reception-queue',
                { stage: 'waiting_triage' },
            ]),
        ).toEqual(waitingTriageQueue);
    });
});
