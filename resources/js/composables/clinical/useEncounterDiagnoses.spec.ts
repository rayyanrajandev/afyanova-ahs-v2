import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useEncounterDiagnoses } from './useEncounterDiagnoses';

describe('useEncounterDiagnoses', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('resets the form to a blank secondary diagnosis when opening the dialog', () => {
        const diagnoses = useEncounterDiagnoses(() => 'enc-1', vi.fn());
        diagnoses.form.diagnosisCode = 'stale';
        diagnoses.form.diagnosisType = 'primary';

        diagnoses.openDialog();

        expect(diagnoses.dialogOpen.value).toBe(true);
        expect(diagnoses.form.diagnosisCode).toBe('');
        expect(diagnoses.form.diagnosisType).toBe('secondary');
    });

    it('POSTs the trimmed diagnosis payload and refetches on success', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({ data: {} });
        const onChanged = vi.fn();
        const diagnoses = useEncounterDiagnoses(() => 'enc-1', onChanged);

        diagnoses.openDialog();
        diagnoses.form.diagnosisCode = ' R52 ';
        diagnoses.form.diagnosisDescription = '  ';
        diagnoses.form.diagnosisType = 'primary';
        await diagnoses.submitDialog();

        expect(postSpy).toHaveBeenCalledWith('/encounters/enc-1/diagnoses', {
            body: { diagnosisCode: 'R52', diagnosisDescription: null, diagnosisType: 'primary' },
        });
        expect(diagnoses.dialogOpen.value).toBe(false);
        expect(onChanged).toHaveBeenCalledOnce();
    });

    it('keeps the dialog open and surfaces the error when adding fails', async () => {
        vi.spyOn(apiClient, 'apiPost').mockRejectedValue(new Error('validation failed'));
        const diagnoses = useEncounterDiagnoses(() => 'enc-1', vi.fn());

        diagnoses.openDialog();
        diagnoses.form.diagnosisCode = 'R52';
        await diagnoses.submitDialog();

        expect(diagnoses.dialogOpen.value).toBe(true);
        expect(diagnoses.error.value).toBe('validation failed');
    });

    it('DELETEs the diagnosis by id and refetches on success', async () => {
        const deleteSpy = vi.spyOn(apiClient, 'apiDelete').mockResolvedValue({ data: null });
        const onChanged = vi.fn();
        const diagnoses = useEncounterDiagnoses(() => 'enc-1', onChanged);

        await diagnoses.removeDiagnosis('diag-9');

        expect(deleteSpy).toHaveBeenCalledWith('/encounters/enc-1/diagnoses/diag-9');
        expect(onChanged).toHaveBeenCalledOnce();
        expect(diagnoses.removingId.value).toBeNull();
    });

    it('tracks which diagnosis is currently being removed while the request is in flight', async () => {
        let resolveDelete: (() => void) | undefined;
        vi.spyOn(apiClient, 'apiDelete').mockReturnValue(
            new Promise((resolve) => {
                resolveDelete = () => resolve({ data: null });
            }) as Promise<{ data: null }>,
        );
        const diagnoses = useEncounterDiagnoses(() => 'enc-1', vi.fn());

        const removal = diagnoses.removeDiagnosis('diag-9');
        expect(diagnoses.removingId.value).toBe('diag-9');

        resolveDelete?.();
        await removal;
        expect(diagnoses.removingId.value).toBeNull();
    });
});
