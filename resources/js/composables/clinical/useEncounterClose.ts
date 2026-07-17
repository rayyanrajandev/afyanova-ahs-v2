import { ref } from 'vue';
import { apiPatch, isApiClientError } from '@/lib/apiClient';
import { type EncounterCloseReadiness } from '@/lib/encounterCloseReadiness';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

/**
 * Encounter close/reopen (reports/clinical-notes-frontend-rebuild-plan.md §3/§4).
 * Same endpoint as the current Workspace.vue
 * (PATCH /encounters/{id}/status). The readiness data itself is not fetched
 * here — it already comes from the workspace bundle (useEncounterWorkspace)
 * and is passed in.
 *
 * Also completes the linked appointment visit
 * (PATCH /appointments/{id}/provider-workflow) when the caller can manage
 * appointment provider sessions and an appointment is linked — same side
 * effect the old page performs. Unlike the old page, this failure is
 * reported separately from the close itself: the old page's
 * submitEncounterCloseDialog let an appointment-completion failure bubble
 * into the same catch as the close, which would tell the user "unable to
 * close this encounter" even though the encounter had, in fact, already
 * closed. Deliberately not reproduced here — the encounter close and the
 * appointment-visit completion are reported as what they are.
 */
export function useEncounterClose(options: {
    encounterId: () => string;
    readiness: () => EncounterCloseReadiness | null;
    appointmentId: () => string | null;
    canCompleteAppointmentVisit: () => boolean;
    onClosed: () => void;
}) {
    const dialogOpen = ref(false);
    const reason = ref('');
    const disposition = ref('');
    const dispositionNotes = ref('');
    const error = ref<string | null>(null);
    const submitting = ref(false);
    const blockedReadiness = ref<EncounterCloseReadiness | null>(null);

    function openDialog(): void {
        reason.value = '';
        disposition.value = '';
        dispositionNotes.value = '';
        error.value = null;
        blockedReadiness.value = null;
        dialogOpen.value = true;
    }

    function closeDialog(): void {
        dialogOpen.value = false;
    }

    async function completeLinkedAppointmentVisit(): Promise<void> {
        const appointmentId = options.appointmentId();
        if (!appointmentId || !options.canCompleteAppointmentVisit()) {
            return;
        }

        try {
            await apiPatch(`/appointments/${appointmentId}/provider-workflow`, {
                body: { status: 'completed', reason: null },
            });
        } catch (err) {
            notifyError(
                messageFromUnknown(
                    err,
                    'Encounter closed, but the appointment visit could not be marked complete.',
                ),
            );
        }
    }

    async function closeEncounter(
        closeReason: string | null,
        acknowledgeCloseGaps: boolean,
        dispositionValue: string | null,
        dispositionNotesValue: string | null,
    ): Promise<void> {
        await apiPatch(`/encounters/${options.encounterId()}/status`, {
            body: {
                status: 'closed',
                reason: closeReason,
                acknowledgeCloseGaps,
                disposition: dispositionValue,
                dispositionNotes: dispositionNotesValue,
            },
        });
        dialogOpen.value = false;
        reason.value = '';
        disposition.value = '';
        dispositionNotes.value = '';
        error.value = null;
        notifySuccess('Encounter closed.');
        await completeLinkedAppointmentVisit();
        options.onClosed();
    }

    /**
     * Entry point — always opens the checklist dialog now, since disposition
     * is required to close and can only be supplied there. (Previously this
     * bypassed straight to a close call when there were no blockers/warnings;
     * disposition being a required close-readiness item means that direct
     * path would now always fail, so the dialog is the only path.)
     */
    function requestClose(): void {
        openDialog();
    }

    async function submitDialog(): Promise<void> {
        if (submitting.value) return;
        submitting.value = true;
        error.value = null;

        try {
            const readiness = options.readiness();
            const nonDispositionBlocking = (readiness?.items ?? []).filter(
                (item) => item.id !== 'disposition_documented' && item.severity === 'block' && item.status === 'fail',
            );
            const requiresAcknowledgement = nonDispositionBlocking.length === 0
                && (readiness?.items ?? []).some((item) => item.severity === 'warn' && item.status === 'fail');
            const closeReason = requiresAcknowledgement ? reason.value.trim() : null;
            await closeEncounter(
                closeReason,
                requiresAcknowledgement,
                disposition.value.trim() || null,
                dispositionNotes.value.trim() || null,
            );
        } catch (err) {
            error.value = messageFromUnknown(err, 'Unable to close this encounter right now.');
            if (
                isApiClientError(err)
                && err.payload
                && typeof err.payload === 'object'
                && (err.payload as Record<string, unknown>).code === 'ENCOUNTER_CLOSE_BLOCKED'
            ) {
                const payload = err.payload as { data?: { closeReadiness?: EncounterCloseReadiness } };
                if (payload.data?.closeReadiness) {
                    blockedReadiness.value = payload.data.closeReadiness;
                }
            }
        } finally {
            submitting.value = false;
        }
    }

    return {
        dialogOpen,
        reason,
        disposition,
        dispositionNotes,
        error,
        submitting,
        blockedReadiness,
        requestClose,
        closeDialog,
        submitDialog,
    };
}
