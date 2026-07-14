import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useAppointmentPatientDirectory } from './useAppointmentPatientDirectory';

async function mount<T>(build: () => T): Promise<T> {
    let composable!: T;
    const TestComponent = defineComponent({
        setup() {
            composable = build();
            return () => h('div');
        },
    });

    render(TestComponent);
    await flushPromises();

    return composable;
}

describe('useAppointmentPatientDirectory', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('hydrates each unique patient id once', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockImplementation(async (url: string) => ({
            data: { id: url.split('/').pop(), patientNumber: 'PT1', firstName: 'Amina', middleName: null, lastName: 'Moshi' },
        }));

        const ids = ref(['pat-1', 'pat-1', 'pat-2']);
        const directory = await mount(() => useAppointmentPatientDirectory(ids));
        await vi.waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2));

        expect(getSpy).toHaveBeenCalledWith('/patients/pat-1');
        expect(getSpy).toHaveBeenCalledWith('/patients/pat-2');
        expect(directory.displayName('pat-1')).toBe('Amina Moshi');
        expect(directory.patientNumber('pat-1')).toBe('PT1');
    });

    it('returns an empty string for patientNumber before hydration or with no id', async () => {
        vi.spyOn(apiClient, 'apiGet').mockImplementation(() => new Promise(() => {}));

        const ids = ref(['pat-1']);
        const directory = await mount(() => useAppointmentPatientDirectory(ids));

        expect(directory.patientNumber('pat-1')).toBe('');
        expect(directory.patientNumber(null)).toBe('');
    });

    it('returns a placeholder while a patient is still loading', async () => {
        vi.spyOn(apiClient, 'apiGet').mockImplementation(() => new Promise(() => {}));

        const ids = ref(['pat-1']);
        const directory = await mount(() => useAppointmentPatientDirectory(ids));

        expect(directory.displayName('pat-1')).toBe('Loading…');
        expect(directory.displayName(null)).toBe('Patient pending');
    });

    it('re-hydrates when the id list grows', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: { id: 'pat-3', patientNumber: 'PT3', firstName: 'Baraka', middleName: null, lastName: 'Juma' },
        });

        const ids = ref<string[]>([]);
        await mount(() => useAppointmentPatientDirectory(ids));
        expect(getSpy).not.toHaveBeenCalled();

        ids.value = ['pat-3'];
        await vi.waitFor(() => expect(getSpy).toHaveBeenCalledTimes(1));
        expect(getSpy).toHaveBeenCalledWith('/patients/pat-3');
    });
});
