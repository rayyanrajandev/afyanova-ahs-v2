import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useRecordTriage } from './useRecordTriage';

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

describe('useRecordTriage', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes /appointments/{id}/triage with the recorded vitals and routing', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({
            data: { id: 'apt-1', patientId: 'pat-1', status: 'waiting_provider', department: 'OPD', checkedInAt: '2026-07-09T08:00:00Z' },
        });

        const triage = await mount(() => useRecordTriage());
        const result = await triage.mutateAsync({
            appointmentId: 'apt-1',
            triageVitalsSummary: 'BP 118/74, Pulse 82 bpm',
            triageCategory: 'P3',
            department: 'OPD',
        });

        expect(patchSpy).toHaveBeenCalledWith('/appointments/apt-1/triage', {
            body: { triageVitalsSummary: 'BP 118/74, Pulse 82 bpm', triageCategory: 'P3', department: 'OPD' },
        });
        expect(result.status).toBe('waiting_provider');
    });
});
