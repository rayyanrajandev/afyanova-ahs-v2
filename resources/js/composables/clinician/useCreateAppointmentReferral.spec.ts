import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useCreateAppointmentReferral } from './useCreateAppointmentReferral';

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

describe('useCreateAppointmentReferral', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('POSTs /appointments/{id}/referrals with the referral payload', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: { id: 'ref-1', appointmentId: 'apt-1', status: 'requested' },
        });

        const create = await mount(() => useCreateAppointmentReferral());
        await create.mutateAsync({
            appointmentId: 'apt-1',
            payload: { referralType: 'internal', priority: 'urgent', targetDepartment: 'Cardiology' },
        });

        expect(postSpy).toHaveBeenCalledWith('/appointments/apt-1/referrals', {
            body: { referralType: 'internal', priority: 'urgent', targetDepartment: 'Cardiology' },
        });
    });
});
