import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useAdmissionPatientDirectory } from './useAdmissionPatientDirectory';

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

describe('useAdmissionPatientDirectory', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('hydrates each unique patient id once', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockImplementation(async (url: string) => ({
            data: { id: url.split('/').pop(), patientNumber: 'PT1', firstName: 'Zawadi', middleName: null, lastName: 'Mrema' },
        }));

        const ids = ref(['pat-1', 'pat-1', 'pat-2']);
        const directory = await mount(() => useAdmissionPatientDirectory(ids));
        await vi.waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2));

        expect(getSpy).toHaveBeenCalledWith('/patients/pat-1');
        expect(directory.displayName('pat-1')).toBe('Zawadi Mrema');
        expect(directory.patientNumber('pat-1')).toBe('PT1');
    });

    it('returns placeholders before hydration or with no id', async () => {
        vi.spyOn(apiClient, 'apiGet').mockImplementation(() => new Promise(() => {}));

        const ids = ref(['pat-1']);
        const directory = await mount(() => useAdmissionPatientDirectory(ids));

        expect(directory.displayName('pat-1')).toBe('Loading…');
        expect(directory.displayName(null)).toBe('Patient pending');
        expect(directory.patientNumber(null)).toBe('');
    });
});
