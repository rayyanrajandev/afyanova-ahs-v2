import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { useMedicalRecordStatusAction } from './useMedicalRecordStatusAction';
import type { MedicalRecordListItem } from './useMedicalRecordList';

function record(overrides: Partial<MedicalRecordListItem> = {}): MedicalRecordListItem {
    return {
        id: 'rec-1',
        recordNumber: 'MR-1',
        patientId: 'pat-1',
        encounterId: 'enc-1',
        admissionId: null,
        appointmentId: null,
        appointmentReferralId: null,
        theatreProcedureId: null,
        authorUserId: 1,
        encounterAt: '2026-01-01T00:00:00Z',
        recordType: 'consultation_note',
        subjective: null,
        objective: null,
        assessment: null,
        plan: null,
        diagnosisCode: null,
        status: 'draft',
        statusReason: null,
        signedByUserId: null,
        signedByUserName: null,
        authorUserName: 'Dr. Test',
        signedAt: null,
        createdAt: null,
        updatedAt: null,
        ...overrides,
    };
}

function baseOptions(overrides: Partial<Parameters<typeof useMedicalRecordStatusAction>[0]> = {}) {
    return {
        canFinalize: () => true,
        canAmend: () => true,
        canArchive: () => true,
        onChanged: vi.fn(),
        ...overrides,
    };
}

describe('useMedicalRecordStatusAction', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('only allows finalize from draft, amend from finalized, and archive from anything but archived', () => {
        const action = useMedicalRecordStatusAction(baseOptions());

        expect(action.canApply('finalized', record({ status: 'draft' }))).toBe(true);
        expect(action.canApply('finalized', record({ status: 'finalized' }))).toBe(false);
        expect(action.canApply('amended', record({ status: 'finalized' }))).toBe(true);
        expect(action.canApply('amended', record({ status: 'draft' }))).toBe(false);
        expect(action.canApply('archived', record({ status: 'draft' }))).toBe(true);
        expect(action.canApply('archived', record({ status: 'archived' }))).toBe(false);
    });

    it('refuses to open the dialog when the permission for that action is missing', () => {
        const action = useMedicalRecordStatusAction(baseOptions({ canFinalize: () => false }));

        action.openDialog(record({ status: 'draft' }), 'finalized');

        expect(action.dialogOpen.value).toBe(false);
    });

    it('finalizes without requiring a reason', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: record({ status: 'finalized' }) });
        const onChanged = vi.fn();
        const action = useMedicalRecordStatusAction(baseOptions({ onChanged }));

        action.openDialog(record({ status: 'draft' }), 'finalized');
        await action.submitDialog();

        expect(patchSpy).toHaveBeenCalledWith('/medical-records/rec-1/status', {
            body: { status: 'finalized', reason: null },
        });
        expect(onChanged).toHaveBeenCalledOnce();
    });

    it('requires a reason before amending or archiving', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: record() });
        const action = useMedicalRecordStatusAction(baseOptions());

        action.openDialog(record({ status: 'finalized' }), 'amended');
        action.reason.value = '';
        await action.submitDialog();

        expect(patchSpy).not.toHaveBeenCalled();
        expect(action.error.value).toBe('Amendment reason is required.');
    });

    it('submits the trimmed reason for archive', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: record({ status: 'archived' }) });
        const action = useMedicalRecordStatusAction(baseOptions());

        action.openDialog(record({ status: 'draft' }), 'archived');
        action.reason.value = '  no longer needed  ';
        await action.submitDialog();

        expect(patchSpy).toHaveBeenCalledWith('/medical-records/rec-1/status', {
            body: { status: 'archived', reason: 'no longer needed' },
        });
    });

    it('keeps the dialog open and surfaces the error when the request fails', async () => {
        vi.spyOn(apiClient, 'apiPatch').mockRejectedValue(new Error('server error'));
        const action = useMedicalRecordStatusAction(baseOptions());

        action.openDialog(record({ status: 'draft' }), 'finalized');
        await action.submitDialog();

        expect(action.dialogOpen.value).toBe(true);
        expect(action.error.value).toBe('server error');
    });
});
