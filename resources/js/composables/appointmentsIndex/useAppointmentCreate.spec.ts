import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useAppointmentCreate } from './useAppointmentCreate';

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

describe('useAppointmentCreate', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('POSTs the appointment payload to /appointments', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: { id: 'apt-1', appointmentNumber: 'APT1', patientId: 'pat-1', department: 'OPD', scheduledAt: '2026-07-10T09:00:00Z', durationMinutes: 30, reason: null, appointmentType: 'scheduled', status: 'scheduled', createdAt: null },
        });

        const create = await mount(() => useAppointmentCreate());
        const result = await create.mutateAsync({
            patientId: 'pat-1',
            scheduledAt: '2026-07-10T09:00',
            department: 'OPD',
            reason: 'Follow-up',
        });

        expect(postSpy).toHaveBeenCalledWith(
            '/appointments',
            expect.objectContaining({
                body: { patientId: 'pat-1', scheduledAt: '2026-07-10T09:00', department: 'OPD', reason: 'Follow-up' },
            }),
        );
        expect(result.appointmentNumber).toBe('APT1');
    });
});
