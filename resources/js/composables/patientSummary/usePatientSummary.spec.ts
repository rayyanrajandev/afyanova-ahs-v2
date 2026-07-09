import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePatientSummary } from './usePatientSummary';

function summaryFixture() {
    return {
        patient: {
            id: 'pat-1',
            patientNumber: 'PT1',
            firstName: 'Amina',
            middleName: null,
            lastName: 'Moshi',
            gender: 'female',
            dateOfBirth: '1996-04-21',
            phone: '+255700000001',
            status: 'active',
            region: 'Dar es Salaam',
            district: 'Ilala',
        },
        contact: { email: null, addressLine: null, nextOfKinName: null, nextOfKinPhone: null },
        alerts: [],
        insurance: null,
        latestEncounter: null,
        workflowStatus: null,
        activeOrders: { labActive: 0, pharmacyActive: 0, imagingActive: 0, procedureActive: 0 },
        upcomingAppointment: null,
        currentAdmission: null,
        stats: { totalVisits: 0, totalEncounters: 0, outstandingInvoices: 0 },
        recentActivity: [],
    };
}

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

describe('usePatientSummary', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('does not fetch when there is no patient id', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet');

        await mount(() => usePatientSummary(ref(null)));

        expect(getSpy).not.toHaveBeenCalled();
    });

    it('fetches the summary for a given patient id', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: summaryFixture() });

        const summary = await mount(() => usePatientSummary(ref('pat-1')));

        expect(getSpy).toHaveBeenCalledWith('/patients/pat-1/summary');
        expect(summary.data.value?.patient.firstName).toBe('Amina');
    });

    it('does not fetch while enabled is false, then fetches once it flips true', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: summaryFixture() });
        const enabled = ref(false);

        await mount(() => usePatientSummary(ref('pat-1'), { enabled }));
        expect(getSpy).not.toHaveBeenCalled();

        enabled.value = true;
        await vi.waitFor(() => expect(getSpy).toHaveBeenCalledTimes(1));
    });

    it('refetches when the patient id changes', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: summaryFixture() });
        const patientId = ref('pat-1');

        await mount(() => usePatientSummary(patientId));
        expect(getSpy).toHaveBeenCalledTimes(1);

        patientId.value = 'pat-2';
        await vi.waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2));
        expect(getSpy).toHaveBeenLastCalledWith('/patients/pat-2/summary');
    });
});
