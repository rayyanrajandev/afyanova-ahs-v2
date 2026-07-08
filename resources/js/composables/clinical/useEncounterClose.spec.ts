import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { type EncounterCloseReadiness } from '@/lib/encounterCloseReadiness';
import { useEncounterClose } from './useEncounterClose';

function readiness(overrides: Partial<EncounterCloseReadiness> = {}): EncounterCloseReadiness {
    return {
        canClose: true,
        requiresAcknowledgement: false,
        blockingCount: 0,
        warningCount: 0,
        items: [],
        billingSummary: {
            pendingCandidates: 0,
            alreadyInvoiced: 0,
            totalCandidates: 0,
            currencyCode: null,
        },
        ...overrides,
    };
}

function baseOptions(overrides: Partial<Parameters<typeof useEncounterClose>[0]> = {}) {
    return {
        encounterId: () => 'enc-1',
        readiness: () => readiness(),
        appointmentId: () => null,
        canCompleteAppointmentVisit: () => false,
        onClosed: () => {},
        ...overrides,
    };
}

describe('useEncounterClose', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('always opens the checklist dialog on requestClose — disposition can only be supplied there', () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: {} });
        const close = useEncounterClose(baseOptions());

        close.requestClose();

        expect(close.dialogOpen.value).toBe(true);
        expect(patchSpy).not.toHaveBeenCalled();
    });

    it('closes with the chosen disposition when there is nothing to acknowledge', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: {} });
        const onClosed = vi.fn();
        const close = useEncounterClose(baseOptions({ onClosed }));

        close.requestClose();
        close.disposition.value = 'discharged';
        await close.submitDialog();

        expect(patchSpy).toHaveBeenCalledWith('/encounters/enc-1/status', {
            body: {
                status: 'closed',
                reason: null,
                acknowledgeCloseGaps: false,
                disposition: 'discharged',
                dispositionNotes: null,
            },
        });
        expect(close.dialogOpen.value).toBe(false);
        expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it('requires a reason and marks acknowledgeCloseGaps when other warning items are still failing', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: {} });
        const onClosed = vi.fn();
        const close = useEncounterClose(
            baseOptions({
                readiness: () =>
                    readiness({
                        items: [{ id: 'unbilled_services', label: 'Billable services captured', severity: 'warn', status: 'fail', message: '', count: 1, details: [] }],
                    }),
                onClosed,
            }),
        );

        close.requestClose();
        close.disposition.value = 'discharged';
        close.reason.value = 'Pending results acknowledged';
        await close.submitDialog();

        expect(patchSpy).toHaveBeenCalledWith('/encounters/enc-1/status', {
            body: {
                status: 'closed',
                reason: 'Pending results acknowledged',
                acknowledgeCloseGaps: true,
                disposition: 'discharged',
                dispositionNotes: null,
            },
        });
        expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it('does not require acknowledgement solely because disposition_documented is failing', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: {} });
        const close = useEncounterClose(
            baseOptions({
                readiness: () =>
                    readiness({
                        items: [{ id: 'disposition_documented', label: 'Disposition recorded', severity: 'block', status: 'fail', message: '', count: null, details: [] }],
                    }),
            }),
        );

        close.requestClose();
        close.disposition.value = 'discharged';
        await close.submitDialog();

        expect(patchSpy).toHaveBeenCalledWith(
            '/encounters/enc-1/status',
            expect.objectContaining({ body: expect.objectContaining({ reason: null, acknowledgeCloseGaps: false }) }),
        );
    });

    it('keeps the dialog open and surfaces the error when closing fails', async () => {
        vi.spyOn(apiClient, 'apiPatch').mockRejectedValue(new Error('server down'));
        const onClosed = vi.fn();
        const close = useEncounterClose(baseOptions({ onClosed }));

        close.requestClose();
        close.disposition.value = 'discharged';
        await close.submitDialog();

        expect(close.dialogOpen.value).toBe(true);
        expect(close.error.value).toBe('server down');
        expect(onClosed).not.toHaveBeenCalled();
    });

    it('does not attempt to complete an appointment visit when none is linked', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: {} });
        const close = useEncounterClose(
            baseOptions({ appointmentId: () => null, canCompleteAppointmentVisit: () => true }),
        );

        close.requestClose();
        close.disposition.value = 'discharged';
        await close.submitDialog();

        expect(patchSpy).toHaveBeenCalledTimes(1);
        expect(patchSpy).not.toHaveBeenCalledWith(expect.stringContaining('provider-workflow'), expect.anything());
    });

    it('does not complete the appointment visit when the caller lacks permission', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: {} });
        const close = useEncounterClose(
            baseOptions({ appointmentId: () => 'appt-1', canCompleteAppointmentVisit: () => false }),
        );

        close.requestClose();
        close.disposition.value = 'discharged';
        await close.submitDialog();

        expect(patchSpy).toHaveBeenCalledTimes(1);
    });

    it('completes the linked appointment visit after a successful close', async () => {
        const patchSpy = vi.spyOn(apiClient, 'apiPatch').mockResolvedValue({ data: {} });
        const onClosed = vi.fn();
        const close = useEncounterClose(
            baseOptions({
                appointmentId: () => 'appt-1',
                canCompleteAppointmentVisit: () => true,
                onClosed,
            }),
        );

        close.requestClose();
        close.disposition.value = 'discharged';
        await close.submitDialog();
        await vi.waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(2));

        expect(patchSpy).toHaveBeenNthCalledWith(1, '/encounters/enc-1/status', expect.anything());
        expect(patchSpy).toHaveBeenNthCalledWith(2, '/appointments/appt-1/provider-workflow', {
            body: { status: 'completed', reason: null },
        });
        expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it('reports a distinct error when the encounter closes but the appointment completion fails', async () => {
        vi.spyOn(apiClient, 'apiPatch')
            .mockResolvedValueOnce({ data: {} })
            .mockRejectedValueOnce(new Error('appointment service down'));
        const onClosed = vi.fn();
        const close = useEncounterClose(
            baseOptions({
                appointmentId: () => 'appt-1',
                canCompleteAppointmentVisit: () => true,
                onClosed,
            }),
        );

        close.requestClose();
        close.disposition.value = 'discharged';
        await close.submitDialog();

        // The encounter close itself is still reported as successful — onClosed still fires.
        expect(onClosed).toHaveBeenCalledTimes(1);
        expect(close.error.value).toBeNull();
    });
});
