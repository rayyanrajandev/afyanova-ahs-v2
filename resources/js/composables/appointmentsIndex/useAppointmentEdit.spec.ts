import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useAppointmentEdit } from './useAppointmentEdit';

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

describe('useAppointmentEdit', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes /appointments/{id} with the edited fields, not the appointmentId itself', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({
            data: { id: 'apt-1', appointmentNumber: 'APT1', patientId: 'pat-1', department: 'ENT', scheduledAt: '2026-07-11T09:00:00Z', durationMinutes: 45, reason: 'Rescheduled', appointmentType: 'scheduled', status: 'scheduled', createdAt: null },
        });

        const edit = await mount(() => useAppointmentEdit());
        const result = await edit.mutateAsync({
            appointmentId: 'apt-1',
            scheduledAt: '2026-07-11T09:00',
            durationMinutes: 45,
            department: 'ENT',
            reason: 'Rescheduled',
        });

        expect(patchSpy).toHaveBeenCalledWith('/appointments/apt-1', {
            body: { scheduledAt: '2026-07-11T09:00', durationMinutes: 45, department: 'ENT', reason: 'Rescheduled' },
        });
        expect(result.department).toBe('ENT');
    });
});
