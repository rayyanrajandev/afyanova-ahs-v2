import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { ApiClientError } from '@/lib/apiClient';
import { usePatientInsuranceDialog } from './usePatientInsuranceDialog';

describe('usePatientInsuranceDialog', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('posts a new insurance record and calls onSaved', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({ data: { id: 'ins-1' } });
        const onSaved = vi.fn();
        const dialog = usePatientInsuranceDialog(ref('pat-1'), onSaved);

        dialog.openDialog();
        dialog.form.insuranceProvider = 'NHIF';
        dialog.form.memberId = 'MEM-1';
        await dialog.submitDialog();

        expect(postSpy).toHaveBeenCalledWith(
            '/patients/pat-1/insurance',
            expect.objectContaining({ body: expect.objectContaining({ insuranceProvider: 'NHIF', memberId: 'MEM-1' }) }),
        );
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(dialog.open.value).toBe(false);
    });

    it('surfaces validation errors without closing the dialog', async () => {
        const validationError = new ApiClientError('Validation failed', 422, {
            errors: { memberId: ['Member ID or card number is required.'] },
        });
        vi.spyOn(apiClient, 'apiPost').mockRejectedValue(validationError);
        const onSaved = vi.fn();
        const dialog = usePatientInsuranceDialog(ref('pat-1'), onSaved);

        dialog.openDialog();
        await dialog.submitDialog();

        expect(dialog.open.value).toBe(true);
        expect(dialog.formErrors.value.memberId?.[0]).toBe('Member ID or card number is required.');
        expect(onSaved).not.toHaveBeenCalled();
    });

    it('verifyRecord PATCHes the verification status and calls onSaved', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: { id: 'ins-1', verificationStatus: 'verified' } });
        const onSaved = vi.fn();
        const dialog = usePatientInsuranceDialog(ref('pat-1'), onSaved);

        await dialog.verifyRecord('ins-1', 'verified');

        expect(patchSpy).toHaveBeenCalledWith(
            '/patients/pat-1/insurance/ins-1/verify',
            expect.objectContaining({ body: { verificationStatus: 'verified' } }),
        );
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(dialog.verifyingId.value).toBeNull();
    });
});
