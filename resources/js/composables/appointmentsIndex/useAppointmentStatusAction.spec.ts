import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useAppointmentStatusAction } from './useAppointmentStatusAction';

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

describe('useAppointmentStatusAction', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('cancels an appointment with a reason', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({
            data: { id: 'apt-1', appointmentNumber: 'APT1', patientId: 'pat-1', department: null, scheduledAt: null, durationMinutes: null, reason: null, appointmentType: 'scheduled', status: 'cancelled', createdAt: null },
        });

        const action = await mount(() => useAppointmentStatusAction());
        const result = await action.mutateAsync({ appointmentId: 'apt-1', status: 'cancelled', reason: 'Patient requested cancellation' });

        expect(patchSpy).toHaveBeenCalledWith('/appointments/apt-1/status', {
            body: { status: 'cancelled', reason: 'Patient requested cancellation' },
        });
        expect(result.status).toBe('cancelled');
    });

    it('records a no-show with a reason', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({
            data: { id: 'apt-2', appointmentNumber: 'APT2', patientId: 'pat-2', department: null, scheduledAt: null, durationMinutes: null, reason: null, appointmentType: 'scheduled', status: 'no_show', createdAt: null },
        });

        const action = await mount(() => useAppointmentStatusAction());
        await action.mutateAsync({ appointmentId: 'apt-2', status: 'no_show', reason: 'Did not arrive' });

        expect(patchSpy).toHaveBeenCalledWith('/appointments/apt-2/status', {
            body: { status: 'no_show', reason: 'Did not arrive' },
        });
    });
});
