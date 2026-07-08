import { computed, ref, type Ref } from 'vue';
import { apiGet, apiPatch, apiPost, isApiClientError } from '@/lib/apiClient';
import { messageFromUnknown } from '@/lib/notify';
import {
    type MedicalRecordDraftContent,
    type MedicalRecordResponse,
    type MedicalRecordVisitContext,
} from '@/types/medicalRecord';

export type DraftSyncState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export type DraftSaveOutcome = 'saved' | 'conflict' | 'error' | 'skipped';

type MedicalRecordEnvelope = { data: MedicalRecordResponse };
type MedicalRecordListEnvelope = { data: MedicalRecordResponse[] };

type SaveOptions = {
    /** Best-effort delivery for page-teardown flushes. */
    keepalive?: boolean;
    /** Bypass the optimistic-lock timestamp check (explicit "overwrite anyway"). */
    forceOverwrite?: boolean;
};

/**
 * Owns the persistence of a single draft note: the create-vs-update decision,
 * the optimistic-lock conflict handling, and single-flight sequencing so
 * overlapping autosaves can't stack. Talks to the existing, unchanged endpoints
 * (POST /medical-records, PATCH /medical-records/{id}) — see
 * reports/clinical-note-audit/05-saving-mechanism.md and 08-api-inventory.md.
 *
 * Note on architecture: this deliberately does NOT use TanStack useMutation.
 * Autosave needs tight single-flight control, keepalive on teardown, and a
 * bespoke 409-conflict → adopt-server-version flow that useMutation's generic
 * retry/state model fights rather than helps. The discrete, user-initiated
 * lifecycle transitions (finalize/amend/archive) DO use useMutation — see
 * useMedicalRecordLifecycle. This split is intentional, not an oversight.
 */
export function useMedicalRecordDraft(options: {
    visitContext: () => MedicalRecordVisitContext | null;
}) {
    const record: Ref<MedicalRecordResponse | null> = ref(null);
    const syncState = ref<DraftSyncState>('idle');
    const syncError = ref<string | null>(null);
    /** The server's current copy, captured when a 409 conflict is detected. */
    const conflictServerRecord = ref<MedicalRecordResponse | null>(null);
    const lastSavedContent = ref<MedicalRecordDraftContent | null>(null);

    const isSaving = computed(() => syncState.value === 'saving');
    const hasConflict = computed(() => syncState.value === 'conflict');

    /** Seed with an already-loaded draft (e.g. reopening an existing note). */
    function hydrateExisting(existing: MedicalRecordResponse): void {
        record.value = existing;
        lastSavedContent.value = {
            subjective: existing.subjective ?? '',
            objective: existing.objective ?? '',
            assessment: existing.assessment ?? '',
            plan: existing.plan ?? '',
            diagnosisCode: existing.diagnosisCode ?? '',
        };
        syncState.value = 'saved';
    }

    /**
     * Proactively check for an already-existing draft before rendering blank.
     * Necessary because the workspace bundle's primaryMedicalRecord field only
     * resolves finalized/amended notes (see
     * reports/clinical-note-audit/04-clinical-note-lifecycle.md §4.3) — a draft
     * is invisible there by design. Without this, the composer starts empty
     * even when real draft content already exists, and only discovers it
     * reactively (see the duplicate-draft handling in save() below), which is
     * too late for "load the page and see your note" to work. Returns the
     * content to populate the editor with, or null if there truly is nothing.
     */
    async function findAndHydrateExistingDraft(): Promise<MedicalRecordDraftContent | null> {
        const context = options.visitContext();
        if (context === null) {
            return null;
        }

        try {
            const existing = await findExistingDraft(context);
            if (existing === null) {
                return null;
            }
            hydrateExisting(existing);
            return { ...lastSavedContent.value! };
        } catch {
            // No existing draft, or the lookup failed — either way, start blank
            // rather than block the composer from rendering at all.
            return null;
        }
    }

    async function save(
        content: MedicalRecordDraftContent,
        saveOptions: SaveOptions = {},
    ): Promise<DraftSaveOutcome> {
        // Single-flight: never let a second save start while one is in flight, and
        // never save on top of an unresolved conflict.
        if (syncState.value === 'saving' || syncState.value === 'conflict') {
            return 'skipped';
        }

        const context = options.visitContext();
        if (context === null && record.value === null) {
            // Nothing to create against yet (no patient/visit context resolved).
            return 'skipped';
        }

        syncState.value = 'saving';
        syncError.value = null;

        try {
            if (record.value === null && context !== null) {
                const response = await apiPost<MedicalRecordEnvelope>('/medical-records', {
                    body: {
                        patientId: context.patientId,
                        encounterId: context.encounterId ?? null,
                        appointmentId: context.appointmentId ?? null,
                        admissionId: context.admissionId ?? null,
                        appointmentReferralId: context.appointmentReferralId ?? null,
                        theatreProcedureId: context.theatreProcedureId ?? null,
                        encounterAt: context.encounterAt,
                        recordType: context.recordType,
                        ...content,
                    },
                    keepalive: saveOptions.keepalive,
                });
                record.value = response.data;
            } else if (record.value !== null) {
                const response = await apiPatch<MedicalRecordEnvelope>(
                    `/medical-records/${record.value.id}`,
                    {
                        body: {
                            ...content,
                            expectedUpdatedAt: saveOptions.forceOverwrite
                                ? null
                                : record.value.updatedAt,
                            forceDraftSave: saveOptions.forceOverwrite ?? false,
                        },
                        keepalive: saveOptions.keepalive,
                    },
                );
                record.value = response.data;
            }

            lastSavedContent.value = { ...content };
            syncState.value = 'saved';
            return 'saved';
        } catch (error) {
            if (isDraftConflict(error)) {
                conflictServerRecord.value = extractConflictRecord(error);
                syncState.value = 'conflict';
                return 'conflict';
            }

            // Recovery for a real, previously-hit gap: the workspace bundle's
            // primaryMedicalRecord only resolves finalized/amended notes (see
            // reports/clinical-note-audit/04-clinical-note-lifecycle.md §4.3), so a
            // draft created earlier (e.g. in a prior page load) is invisible to this
            // component on mount — it tries to create again, and the backend correctly
            // rejects the duplicate. findAndHydrateExistingDraft() on mount should
            // normally prevent this from ever firing; this is the reactive fallback
            // for when it still does (e.g. a draft created concurrently in another
            // tab after this page already rendered blank).
            //
            // Deliberately does NOT auto-resave the found record with the current
            // (possibly still-blank) local content — that would silently overwrite
            // whatever the found draft already had in fields the user hasn't
            // touched yet. Instead this is treated exactly like a 409 version
            // conflict: surface both versions and let adoptServerVersion() /
            // overwriteServerVersion() (already built, already tested) decide.
            if (isDuplicateDraft(error) && record.value === null && context !== null) {
                try {
                    const existing = await findExistingDraft(context);
                    if (existing !== null) {
                        record.value = existing;
                        conflictServerRecord.value = existing;
                        syncState.value = 'conflict';
                        return 'conflict';
                    }
                } catch {
                    // Fall through to the generic error path below.
                }
            }

            syncState.value = 'error';
            syncError.value = messageFromUnknown(error, 'Unable to save this note.');
            return 'error';
        }
    }

    /**
     * Resolve a conflict by adopting the server's current copy. Returns that
     * copy's content so the caller can repopulate the editor with what actually
     * persisted, rather than silently discarding either side.
     */
    function adoptServerVersion(): MedicalRecordDraftContent | null {
        const server = conflictServerRecord.value;
        if (server === null) {
            return null;
        }

        record.value = server;
        conflictServerRecord.value = null;
        syncState.value = 'saved';

        const content: MedicalRecordDraftContent = {
            subjective: server.subjective ?? '',
            objective: server.objective ?? '',
            assessment: server.assessment ?? '',
            plan: server.plan ?? '',
            diagnosisCode: server.diagnosisCode ?? '',
        };
        lastSavedContent.value = { ...content };
        return content;
    }

    /** Resolve a conflict by keeping local edits and overwriting the server. */
    async function overwriteServerVersion(
        content: MedicalRecordDraftContent,
    ): Promise<DraftSaveOutcome> {
        // Clear the conflict gate so save() proceeds, then force past the lock check.
        syncState.value = 'saved';
        conflictServerRecord.value = null;
        return save(content, { forceOverwrite: true });
    }

    return {
        record,
        syncState,
        syncError,
        conflictServerRecord,
        lastSavedContent,
        isSaving,
        hasConflict,
        hydrateExisting,
        findAndHydrateExistingDraft,
        save,
        adoptServerVersion,
        overwriteServerVersion,
    };
}

function isDraftConflict(error: unknown): boolean {
    if (!isApiClientError(error) || error.status !== 409) {
        return false;
    }
    const payload = error.payload as { code?: string } | null;
    return payload?.code === 'MEDICAL_RECORD_DRAFT_CONFLICT';
}

function isDuplicateDraft(error: unknown): boolean {
    if (!isApiClientError(error) || error.status !== 422) {
        return false;
    }
    const payload = error.payload as { code?: string } | null;
    return payload?.code === 'MEDICAL_RECORD_DUPLICATE_DRAFT';
}

async function findExistingDraft(
    context: MedicalRecordVisitContext,
): Promise<MedicalRecordResponse | null> {
    const response = await apiGet<MedicalRecordListEnvelope>('/medical-records', {
        patientId: context.patientId,
        encounterId: context.encounterId ?? undefined,
        status: 'draft',
        recordType: context.recordType,
        perPage: 1,
        sortBy: 'updatedAt',
        sortDir: 'desc',
    });
    return response.data[0] ?? null;
}

function extractConflictRecord(error: unknown): MedicalRecordResponse | null {
    if (!isApiClientError(error)) {
        return null;
    }
    const payload = error.payload as
        | { context?: { currentRecord?: MedicalRecordResponse } }
        | null;
    return payload?.context?.currentRecord ?? null;
}
