import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import * as apiClient from '@/lib/apiClient';
import { ApiClientError } from '@/lib/apiClient';
import { usePatientAllergyDialog } from './usePatientAllergyDialog';
import type { PatientChartAllergy } from './usePatientAllergies';

function allergy(overrides: Partial<PatientChartAllergy> = {}): PatientChartAllergy {
    return {
        id: 'allergy-1',
        substanceCode: 'PEN',
        substanceName: 'Penicillin',
        reaction: 'Rash',
        severity: 'moderate',
        status: 'active',
        notedAt: '2026-01-01',
        lastReactionAt: '2026-01-02',
        notes: 'Confirmed by patient history',
        ...overrides,
    };
}

describe('usePatientAllergyDialog', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('opens with a blank form for a new allergy', () => {
        const dialog = usePatientAllergyDialog(ref('pat-1'), vi.fn());
        dialog.openDialog();

        expect(dialog.open.value).toBe(true);
        expect(dialog.editingId.value).toBe('');
        expect(dialog.form.substanceName).toBe('');
        expect(dialog.form.severity).toBe('unknown');
        expect(dialog.form.status).toBe('active');
    });

    it('prefills every field when editing an existing allergy', () => {
        const dialog = usePatientAllergyDialog(ref('pat-1'), vi.fn());
        dialog.openDialog(allergy());

        expect(dialog.editingId.value).toBe('allergy-1');
        expect(dialog.form.substanceCode).toBe('PEN');
        expect(dialog.form.substanceName).toBe('Penicillin');
        expect(dialog.form.reaction).toBe('Rash');
        expect(dialog.form.severity).toBe('moderate');
        expect(dialog.form.lastReactionAt).toBe('2026-01-02');
        expect(dialog.form.notes).toBe('Confirmed by patient history');
    });

    it('POSTs to the allergies endpoint when creating', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({ data: {} });
        const onSaved = vi.fn();
        const dialog = usePatientAllergyDialog(ref('pat-42'), onSaved);
        dialog.openDialog();
        dialog.form.substanceName = 'Latex';

        await dialog.submitDialog();

        expect(postSpy).toHaveBeenCalledWith(
            '/patients/pat-42/allergies',
            expect.objectContaining({ body: expect.objectContaining({ substanceName: 'Latex' }) }),
        );
        expect(dialog.open.value).toBe(false);
        expect(onSaved).toHaveBeenCalledOnce();
    });

    it('PATCHes the specific allergy when editing', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: {} });
        const dialog = usePatientAllergyDialog(ref('pat-42'), vi.fn());
        dialog.openDialog(allergy({ id: 'allergy-9' }));

        await dialog.submitDialog();

        expect(patchSpy).toHaveBeenCalledWith('/patients/pat-42/allergies/allergy-9', expect.anything());
    });

    it('surfaces field-level validation errors from a 422 response without closing the dialog', async () => {
        vi.spyOn(apiClient, 'apiPost').mockRejectedValue(
            new ApiClientError('Validation failed', 422, { errors: { substanceName: ['Substance is required.'] } }),
        );
        const dialog = usePatientAllergyDialog(ref('pat-1'), vi.fn());
        dialog.openDialog();

        await dialog.submitDialog();

        expect(dialog.open.value).toBe(true);
        expect(dialog.formErrors.value.substanceName).toEqual(['Substance is required.']);
    });
});
