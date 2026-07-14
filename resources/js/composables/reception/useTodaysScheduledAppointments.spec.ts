import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useTodaysScheduledAppointments } from './useTodaysScheduledAppointments';

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
    await new Promise((resolve) => setTimeout(resolve, 0));

    return composable;
}

describe('useTodaysScheduledAppointments', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches scheduled appointments for today only', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [
                {
                    id: 'apt-1',
                    appointmentNumber: 'APT1',
                    patientId: 'pat-1',
                    clinicianUserId: 42,
                    department: 'OPD',
                    scheduledAt: '2026-07-10T09:00:00Z',
                    durationMinutes: 30,
                    reason: null,
                    appointmentType: 'scheduled',
                    status: 'scheduled',
                    createdAt: null,
                },
            ],
        });

        const result = await mount(() => useTodaysScheduledAppointments());

        expect(result.data.value).toHaveLength(1);
        expect(getSpy).toHaveBeenCalledWith(
            '/appointments',
            expect.objectContaining({ status: 'scheduled', perPage: 100, sortBy: 'scheduledAt', sortDir: 'asc' }),
        );

        const [, params] = getSpy.mock.calls[0] as [string, { from: string; to: string }];
        const [fromDate] = params.from.split('T');
        const [toDate] = params.to.split('T');
        expect(fromDate).toBe(toDate);
        expect(params.from).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00$/);
        // The end boundary must carry an end-of-day time — a bare date
        // parses as midnight server-side, which would exclude every
        // appointment scheduled later than 00:00:00 today.
        expect(params.to).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59$/);
    });
});
