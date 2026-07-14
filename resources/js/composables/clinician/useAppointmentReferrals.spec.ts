import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useAppointmentReferrals } from './useAppointmentReferrals';

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

describe('useAppointmentReferrals', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches referrals for the given appointment', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [{ id: 'ref-1', appointmentId: 'apt-1', status: 'requested' }],
            meta: { currentPage: 1, perPage: 20, total: 1, lastPage: 1 },
        });

        const appointmentId = ref<string | null>('apt-1');
        const referrals = await mount(() => useAppointmentReferrals(appointmentId));

        expect(getSpy).toHaveBeenCalledWith('/appointments/apt-1/referrals', { perPage: 20, page: 1 });
        expect(referrals.data.value?.data).toHaveLength(1);
    });

    it('does not fetch when the appointment id is null', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [], meta: {} });

        const appointmentId = ref<string | null>(null);
        await mount(() => useAppointmentReferrals(appointmentId));

        expect(getSpy).not.toHaveBeenCalled();
    });
});
