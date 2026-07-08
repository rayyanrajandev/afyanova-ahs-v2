import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import * as apiClient from '@/lib/apiClient';
import { usePatientMedicationProfileDialog } from './usePatientMedicationProfileDialog';
import type { PatientChartMedicationProfile } from './usePatientMedicationProfile';
import type { PatientChartReconciliationPharmacyOrder } from './usePatientMedicationReconciliation';

function profile(overrides: Partial<PatientChartMedicationProfile> = {}): PatientChartMedicationProfile {
    return {
        id: 'profile-1',
        medicationCode: 'AMOX500',
        medicationName: 'Amoxicillin',
        dose: '500mg',
        route: 'oral',
        frequency: 'twice_daily',
        source: 'home_medication',
        status: 'active',
        startedAt: '2026-01-01',
        stoppedAt: null,
        indication: null,
        notes: null,
        lastReconciledAt: null,
        reconciliationNote: null,
        ...overrides,
    };
}

function reconciliationOrder(overrides: Partial<PatientChartReconciliationPharmacyOrder> = {}): PatientChartReconciliationPharmacyOrder {
    return {
        id: 'rx-1',
        orderNumber: 'RX-1',
        medicationCode: 'AMOX500',
        medicationName: 'Amoxicillin',
        dosageInstruction: '500mg twice daily',
        dispensedAt: '2026-01-05T00:00:00Z',
        ...overrides,
    };
}

describe('usePatientMedicationProfileDialog', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('matches an existing profile entry by medication code and opens it in edit mode', () => {
        const profiles = ref([profile()]);
        const dialog = usePatientMedicationProfileDialog(ref('pat-1'), profiles, vi.fn());

        dialog.openDialogFromOrder(reconciliationOrder(), 'continue');

        expect(dialog.editingId.value).toBe('profile-1');
        expect(dialog.form.reconciliationNote).toContain('Therapy reviewed from RX-1');
    });

    it('falls back to matching by medication name when codes do not line up', () => {
        const profiles = ref([profile({ medicationCode: null })]);
        const dialog = usePatientMedicationProfileDialog(ref('pat-1'), profiles, vi.fn());

        dialog.openDialogFromOrder(reconciliationOrder({ medicationCode: null }), 'add');

        expect(dialog.editingId.value).toBe('profile-1');
    });

    it('opens a blank prefilled form from the order when no matching profile entry exists', () => {
        const dialog = usePatientMedicationProfileDialog(ref('pat-1'), ref([]), vi.fn());

        dialog.openDialogFromOrder(reconciliationOrder({ medicationName: 'Ibuprofen', medicationCode: 'IBU200' }), 'add');

        expect(dialog.editingId.value).toBe('');
        expect(dialog.form.medicationName).toBe('Ibuprofen');
        expect(dialog.form.source).toBe('manual_entry');
        expect(dialog.form.notes).toContain('Linked pharmacy order: RX-1');
    });

    it('POSTs a new profile entry with the trimmed form payload', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({ data: {} });
        const onSaved = vi.fn();
        const dialog = usePatientMedicationProfileDialog(ref('pat-42'), ref([]), onSaved);
        dialog.openDialog();
        dialog.form.medicationName = '  Paracetamol  ';

        await dialog.submitDialog();

        expect(postSpy).toHaveBeenCalledWith(
            '/patients/pat-42/medication-profile',
            expect.objectContaining({ body: expect.objectContaining({ medicationName: 'Paracetamol' }) }),
        );
        expect(onSaved).toHaveBeenCalledOnce();
    });

    it('marks a profile entry as reviewed via the quick-reconcile action', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: {} });
        const onSaved = vi.fn();
        const dialog = usePatientMedicationProfileDialog(ref('pat-1'), ref([profile()]), onSaved);

        expect(dialog.isQuickReconcileLoading(profile())).toBe(false);
        await dialog.quickReconcile(profile());

        expect(patchSpy).toHaveBeenCalledWith(
            '/patients/pat-1/medication-profile/profile-1',
            expect.objectContaining({ body: expect.objectContaining({ lastReconciledAt: expect.any(String) }) }),
        );
        expect(onSaved).toHaveBeenCalledOnce();
    });
});
