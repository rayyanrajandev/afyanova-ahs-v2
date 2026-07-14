import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useUpdateAppointmentReferralStatus } from './useUpdateAppointmentReferralStatus';

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

describe('useUpdateAppointmentReferralStatus', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('PATCHes the referral status endpoint with status/reason/handoffNotes', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({
            data: { id: 'ref-1', appointmentId: 'apt-1', status: 'accepted' },
        });

        const update = await mount(() => useUpdateAppointmentReferralStatus());
        await update.mutateAsync({ appointmentId: 'apt-1', referralId: 'ref-1', status: 'accepted' });

        expect(patchSpy).toHaveBeenCalledWith('/appointments/apt-1/referrals/ref-1/status', {
            body: { status: 'accepted', reason: null, handoffNotes: null },
        });
    });

    it('sends a reason when rejecting', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({
            data: { id: 'ref-1', appointmentId: 'apt-1', status: 'rejected' },
        });

        const update = await mount(() => useUpdateAppointmentReferralStatus());
        await update.mutateAsync({ appointmentId: 'apt-1', referralId: 'ref-1', status: 'rejected', reason: 'Capacity unavailable' });

        expect(patchSpy).toHaveBeenCalledWith('/appointments/apt-1/referrals/ref-1/status', {
            body: { status: 'rejected', reason: 'Capacity unavailable', handoffNotes: null },
        });
    });
});
