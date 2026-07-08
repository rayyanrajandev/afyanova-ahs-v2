import { nextTick, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { usePatientDirectory } from './usePatientDirectory';

function patientResponse(id: string, firstName: string) {
    return { data: { id, patientNumber: `PT-${id}`, firstName, middleName: null, lastName: 'Test' } };
}

describe('usePatientDirectory', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fetches each unique patient id exactly once', async () => {
        const getSpy = vi
            .spyOn(apiClient, 'apiGet')
            .mockImplementation((path: string) => Promise.resolve(patientResponse(path.split('/').pop() ?? '', 'Amina')));

        const ids = ref(['pat-1', 'pat-2']);
        const { directory } = usePatientDirectory(ids);
        await nextTick();
        await vi.waitFor(() => expect(directory.value['pat-1']).toBeDefined());

        expect(getSpy).toHaveBeenCalledTimes(2);
        expect(directory.value['pat-1'].firstName).toBe('Amina');
        expect(directory.value['pat-2'].firstName).toBe('Amina');
    });

    it('does not re-fetch a patient already cached in the directory', async () => {
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue(patientResponse('pat-1', 'Amina'));

        const ids = ref(['pat-1']);
        const { directory } = usePatientDirectory(ids);
        await vi.waitFor(() => expect(directory.value['pat-1']).toBeDefined());

        // Same id appears again alongside a new one — only the new one should trigger a fetch.
        ids.value = ['pat-1', 'pat-2'];
        await vi.waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2));

        expect(getSpy).toHaveBeenNthCalledWith(1, '/patients/pat-1');
        expect(getSpy).toHaveBeenNthCalledWith(2, '/patients/pat-2');
    });

    it('ignores a failed lookup without blocking other patients in the same batch', async () => {
        vi.spyOn(apiClient, 'apiGet').mockImplementation((path: string) => {
            if (path.endsWith('pat-bad')) return Promise.reject(new Error('not found'));
            return Promise.resolve(patientResponse('pat-good', 'Amina'));
        });

        const ids = ref(['pat-bad', 'pat-good']);
        const { directory } = usePatientDirectory(ids);
        await vi.waitFor(() => expect(directory.value['pat-good']).toBeDefined());

        expect(directory.value['pat-bad']).toBeUndefined();
    });
});
