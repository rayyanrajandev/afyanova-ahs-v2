import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/apiClient';
import * as apiClient from '@/lib/apiClient';
import { type MedicalRecordResponse, type MedicalRecordVisitContext } from '@/types/medicalRecord';
import { useMedicalRecordDraft } from './useMedicalRecordDraft';

function makeRecord(overrides: Partial<MedicalRecordResponse> = {}): MedicalRecordResponse {
    return {
        id: 'rec-1',
        recordNumber: 'MR1',
        patientId: 'pat-1',
        encounterId: null,
        admissionId: null,
        appointmentId: null,
        appointmentReferralId: null,
        theatreProcedureId: null,
        authorUserId: null,
        encounterAt: '2026-01-01T00:00:00Z',
        recordType: 'consultation_note',
        subjective: 'S',
        objective: 'O',
        assessment: 'A',
        plan: 'P',
        diagnosisCode: null,
        status: 'draft',
        statusReason: null,
        signedByUserId: null,
        signedByUserName: null,
        authorUserName: null,
        signedAt: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

const visitContext: MedicalRecordVisitContext = {
    patientId: 'pat-1',
    encounterAt: '2026-01-01T00:00:00Z',
    recordType: 'consultation_note',
};

describe('useMedicalRecordDraft', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('POSTs to create when no record exists yet', async () => {
        const created = makeRecord();
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({ data: created });

        const draft = useMedicalRecordDraft({ visitContext: () => visitContext });
        const outcome = await draft.save({
            subjective: 'S',
            objective: 'O',
            assessment: 'A',
            plan: 'P',
            diagnosisCode: '',
        });

        expect(outcome).toBe('saved');
        expect(postSpy).toHaveBeenCalledWith(
            '/medical-records',
            expect.objectContaining({ body: expect.objectContaining({ patientId: 'pat-1' }) }),
        );
        expect(draft.record.value?.id).toBe('rec-1');
    });

    it('PATCHes to update once a record exists, including the optimistic-lock timestamp', async () => {
        const existing = makeRecord({ updatedAt: '2026-01-01T00:00:00Z' });
        const updated = makeRecord({ subjective: 'Updated', updatedAt: '2026-01-01T00:05:00Z' });
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: updated });

        const draft = useMedicalRecordDraft({ visitContext: () => visitContext });
        draft.hydrateExisting(existing);

        await draft.save({ subjective: 'Updated', objective: 'O', assessment: 'A', plan: 'P', diagnosisCode: '' });

        expect(patchSpy).toHaveBeenCalledWith(
            '/medical-records/rec-1',
            expect.objectContaining({
                body: expect.objectContaining({
                    expectedUpdatedAt: '2026-01-01T00:00:00Z',
                    forceDraftSave: false,
                }),
            }),
        );
        expect(draft.record.value?.subjective).toBe('Updated');
    });

    it('enters conflict state on a 409 MEDICAL_RECORD_DRAFT_CONFLICT response, capturing the server copy', async () => {
        const serverRecord = makeRecord({ subjective: 'Someone else edited this' });
        const conflictError = new ApiClientError('Conflict', 409, {
            code: 'MEDICAL_RECORD_DRAFT_CONFLICT',
            context: { currentRecord: serverRecord },
        });
        vi.spyOn(apiClient, 'apiPatch').mockRejectedValue(conflictError);

        const draft = useMedicalRecordDraft({ visitContext: () => visitContext });
        draft.hydrateExisting(makeRecord());

        const outcome = await draft.save({ subjective: 'My edit', objective: 'O', assessment: 'A', plan: 'P', diagnosisCode: '' });

        expect(outcome).toBe('conflict');
        expect(draft.hasConflict.value).toBe(true);
        expect(draft.conflictServerRecord.value?.subjective).toBe('Someone else edited this');
    });

    it('does not treat a non-conflict 422 as a conflict', async () => {
        const validationError = new ApiClientError('Invalid', 422, {
            code: 'VALIDATION_ERROR',
            errors: { diagnosisCode: ['Invalid format.'] },
        });
        vi.spyOn(apiClient, 'apiPatch').mockRejectedValue(validationError);

        const draft = useMedicalRecordDraft({ visitContext: () => visitContext });
        draft.hydrateExisting(makeRecord());

        const outcome = await draft.save({ subjective: 'x', objective: 'O', assessment: 'A', plan: 'P', diagnosisCode: 'bad' });

        expect(outcome).toBe('error');
        expect(draft.hasConflict.value).toBe(false);
        expect(draft.syncState.value).toBe('error');
    });

    it('adoptServerVersion() replaces local state with the server copy and clears the conflict', async () => {
        const serverRecord = makeRecord({ subjective: 'Server wins', updatedAt: '2026-01-01T01:00:00Z' });
        const conflictError = new ApiClientError('Conflict', 409, {
            code: 'MEDICAL_RECORD_DRAFT_CONFLICT',
            context: { currentRecord: serverRecord },
        });
        vi.spyOn(apiClient, 'apiPatch').mockRejectedValue(conflictError);

        const draft = useMedicalRecordDraft({ visitContext: () => visitContext });
        draft.hydrateExisting(makeRecord());
        await draft.save({ subjective: 'Mine', objective: 'O', assessment: 'A', plan: 'P', diagnosisCode: '' });

        const adopted = draft.adoptServerVersion();

        expect(adopted?.subjective).toBe('Server wins');
        expect(draft.hasConflict.value).toBe(false);
        expect(draft.record.value?.updatedAt).toBe('2026-01-01T01:00:00Z');
    });

    it('overwriteServerVersion() forces the save past the optimistic lock', async () => {
        const serverRecord = makeRecord();
        const conflictError = new ApiClientError('Conflict', 409, {
            code: 'MEDICAL_RECORD_DRAFT_CONFLICT',
            context: { currentRecord: serverRecord },
        });
        const finalRecord = makeRecord({ subjective: 'Forced' });
        const patchSpy = vi
            .spyOn(apiClient, 'apiPatch')
            .mockRejectedValueOnce(conflictError)
            .mockResolvedValueOnce({ data: finalRecord });

        const draft = useMedicalRecordDraft({ visitContext: () => visitContext });
        draft.hydrateExisting(makeRecord());
        await draft.save({ subjective: 'Forced', objective: 'O', assessment: 'A', plan: 'P', diagnosisCode: '' });
        expect(draft.hasConflict.value).toBe(true);

        const outcome = await draft.overwriteServerVersion({
            subjective: 'Forced',
            objective: 'O',
            assessment: 'A',
            plan: 'P',
            diagnosisCode: '',
        });

        expect(outcome).toBe('saved');
        expect(patchSpy).toHaveBeenLastCalledWith(
            '/medical-records/rec-1',
            expect.objectContaining({
                body: expect.objectContaining({ forceDraftSave: true, expectedUpdatedAt: null }),
            }),
        );
        expect(draft.hasConflict.value).toBe(false);
    });

    it('is single-flight: a save already in progress is skipped, not queued', async () => {
        let resolveFirst!: (value: { data: MedicalRecordResponse }) => void;
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockImplementation(
            () => new Promise((resolve) => (resolveFirst = resolve)),
        );

        const draft = useMedicalRecordDraft({ visitContext: () => visitContext });

        const firstSave = draft.save({ subjective: 'a', objective: '', assessment: '', plan: '', diagnosisCode: '' });
        const secondOutcome = await draft.save({ subjective: 'b', objective: '', assessment: '', plan: '', diagnosisCode: '' });

        expect(secondOutcome).toBe('skipped');
        expect(postSpy).toHaveBeenCalledTimes(1);

        resolveFirst({ data: makeRecord() });
        await firstSave;
    });

    it('surfaces a duplicate-draft 422 as a resolvable conflict rather than silently overwriting the found draft', async () => {
        const existingDraft = makeRecord({ id: 'existing-draft-1', subjective: 'Already on file' });
        const duplicateError = new ApiClientError('Unprocessable', 422, {
            code: 'MEDICAL_RECORD_DUPLICATE_DRAFT',
            errors: { appointmentId: ['A draft note of this type already exists for this visit.'] },
        });

        vi.spyOn(apiClient, 'apiPost').mockRejectedValue(duplicateError);
        const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [existingDraft] });
        const patchSpy = vi.spyOn(apiClient, 'apiPatch');

        const draft = useMedicalRecordDraft({ visitContext: () => visitContext });
        const outcome = await draft.save({
            subjective: 'My still-blank local edit',
            objective: '',
            assessment: '',
            plan: '',
            diagnosisCode: '',
        });

        expect(getSpy).toHaveBeenCalledWith(
            '/medical-records',
            expect.objectContaining({ status: 'draft', patientId: 'pat-1' }),
        );
        // Never auto-resaves over the found draft — that would silently blank out
        // fields the user hasn't touched yet. It's surfaced as a conflict instead.
        expect(patchSpy).not.toHaveBeenCalled();
        expect(outcome).toBe('conflict');
        expect(draft.hasConflict.value).toBe(true);
        expect(draft.conflictServerRecord.value?.id).toBe('existing-draft-1');
        expect(draft.conflictServerRecord.value?.subjective).toBe('Already on file');

        // The caller can now resolve it exactly like a 409 conflict: adopt the
        // found draft's content...
        const adopted = draft.adoptServerVersion();
        expect(adopted?.subjective).toBe('Already on file');
        expect(draft.hasConflict.value).toBe(false);
        expect(draft.record.value?.id).toBe('existing-draft-1');
    });

    it('lets the caller keep local edits over the found draft via overwriteServerVersion()', async () => {
        const existingDraft = makeRecord({ id: 'existing-draft-1', subjective: 'Already on file' });
        const duplicateError = new ApiClientError('Unprocessable', 422, {
            code: 'MEDICAL_RECORD_DUPLICATE_DRAFT',
            errors: { appointmentId: ['A draft note of this type already exists for this visit.'] },
        });
        const forcedSave = makeRecord({ id: 'existing-draft-1', subjective: 'My forced edit' });

        vi.spyOn(apiClient, 'apiPost').mockRejectedValue(duplicateError);
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [existingDraft] });
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: forcedSave });

        const draft = useMedicalRecordDraft({ visitContext: () => visitContext });
        await draft.save({ subjective: 'My forced edit', objective: '', assessment: '', plan: '', diagnosisCode: '' });
        expect(draft.hasConflict.value).toBe(true);

        const outcome = await draft.overwriteServerVersion({
            subjective: 'My forced edit',
            objective: '',
            assessment: '',
            plan: '',
            diagnosisCode: '',
        });

        expect(outcome).toBe('saved');
        // Targets the *found* draft's id via PATCH, not a second create attempt.
        expect(patchSpy).toHaveBeenCalledWith(
            '/medical-records/existing-draft-1',
            expect.objectContaining({ body: expect.objectContaining({ forceDraftSave: true }) }),
        );
    });

    it('falls back to a plain error if the duplicate-draft recovery lookup finds nothing', async () => {
        const duplicateError = new ApiClientError('Unprocessable', 422, {
            code: 'MEDICAL_RECORD_DUPLICATE_DRAFT',
            errors: { appointmentId: ['A draft note of this type already exists for this visit.'] },
        });
        vi.spyOn(apiClient, 'apiPost').mockRejectedValue(duplicateError);
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [] });

        const draft = useMedicalRecordDraft({ visitContext: () => visitContext });
        const outcome = await draft.save({ subjective: 'x', objective: '', assessment: '', plan: '', diagnosisCode: '' });

        expect(outcome).toBe('error');
        expect(draft.record.value).toBeNull();
    });

    it('skips saving when there is no visit context and no existing record', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost');
        const draft = useMedicalRecordDraft({ visitContext: () => null });

        const outcome = await draft.save({ subjective: '', objective: '', assessment: '', plan: '', diagnosisCode: '' });

        expect(outcome).toBe('skipped');
        expect(postSpy).not.toHaveBeenCalled();
    });

    describe('findAndHydrateExistingDraft', () => {
        it('loads and returns an existing draft found on the server, so the caller can populate the editor', async () => {
            const existingDraft = makeRecord({ id: 'found-1', subjective: 'Previously saved content' });
            const getSpy = vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [existingDraft] });

            const draft = useMedicalRecordDraft({ visitContext: () => visitContext });
            const content = await draft.findAndHydrateExistingDraft();

            expect(getSpy).toHaveBeenCalledWith(
                '/medical-records',
                expect.objectContaining({ status: 'draft', recordType: 'consultation_note' }),
            );
            expect(content?.subjective).toBe('Previously saved content');
            expect(draft.record.value?.id).toBe('found-1');
            expect(draft.syncState.value).toBe('saved');
        });

        it('returns null and leaves state untouched when nothing is found', async () => {
            vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [] });

            const draft = useMedicalRecordDraft({ visitContext: () => visitContext });
            const content = await draft.findAndHydrateExistingDraft();

            expect(content).toBeNull();
            expect(draft.record.value).toBeNull();
        });

        it('returns null without throwing when there is no visit context yet', async () => {
            const getSpy = vi.spyOn(apiClient, 'apiGet');
            const draft = useMedicalRecordDraft({ visitContext: () => null });

            const content = await draft.findAndHydrateExistingDraft();

            expect(content).toBeNull();
            expect(getSpy).not.toHaveBeenCalled();
        });
    });
});
