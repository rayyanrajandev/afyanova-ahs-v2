import { formatEnumLabel } from '@/lib/labels';
import type { AppIconName } from '@/lib/icons';
import type { Admission } from '@/composables/admissions/useAdmissions';
import type { AdmissionAuditLog } from '@/composables/admissions/useAdmissionAuditLog';

/**
 * AdmA of the Admission V2 full-parity plan — ported verbatim from the
 * legacy admissions/Index.vue's ADT timeline builder (detailsAdtTimelineEvents,
 * Index.vue:4097-4268, plus its helper functions ~2750-2884 and
 * dischargeHandoffSummary at ~3536). Extracted into a pure function (no
 * Vue reactivity) so it's unit-testable independent of the audit-log fetch
 * that feeds it — see useAdmissionAdtTimeline.ts for the composable that
 * calls this.
 */
export type AdtTimelineEventKind = 'admit' | 'transfer' | 'discharge' | 'cancel';
export type AdtTimelineEventSource = 'audit' | 'current-state';

export type AdtTimelineEvent = {
    key: string;
    kind: AdtTimelineEventKind;
    title: string;
    timestamp: string | null;
    description: string;
    reason: string | null;
    placementSummary: string | null;
    placementOrigin: string | null;
    handoffSummary: string | null;
    icon: AppIconName;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    source: AdtTimelineEventSource;
};

function normalizeOptionalText(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized ? normalized : null;
}

function formatPlacementLabel(ward: unknown, bed: unknown): string | null {
    const normalizedWard = typeof ward === 'string' ? ward.trim() : '';
    const normalizedBed = typeof bed === 'string' ? bed.trim() : '';
    if (!normalizedWard && !normalizedBed) return null;
    return `${normalizedWard || 'Ward pending'} / ${normalizedBed || 'Bed pending'}`;
}

function dischargeHandoffSummary(destination: unknown, followUpPlan: unknown): string | null {
    const items: string[] = [];
    const normalizedDestination = normalizeOptionalText(destination);
    const normalizedFollowUpPlan = normalizeOptionalText(followUpPlan);

    if (normalizedDestination) items.push(`Destination: ${normalizedDestination}`);
    if (normalizedFollowUpPlan) items.push(`Follow-up: ${normalizedFollowUpPlan}`);

    return items.length ? items.join(' | ') : null;
}

function auditFieldBeforeValue(log: AdmissionAuditLog, key: string): unknown {
    const field = (log.changes as Record<string, unknown> | null)?.[key];
    if (!field || typeof field !== 'object') return null;
    return (field as Record<string, unknown>).before ?? null;
}

function auditFieldAfterValue(log: AdmissionAuditLog, key: string): unknown {
    const field = (log.changes as Record<string, unknown> | null)?.[key];
    if (!field || typeof field !== 'object') return null;
    return (field as Record<string, unknown>).after ?? null;
}

function auditTransitionStatus(log: AdmissionAuditLog, direction: 'from' | 'to'): string | null {
    const transition = (log.metadata as Record<string, unknown> | null)?.transition;
    if (!transition || typeof transition !== 'object') return null;
    const value = (transition as Record<string, unknown>)[direction];
    return typeof value === 'string' ? value : null;
}

function adtTimelineEventPresentation(kind: AdtTimelineEventKind): { title: string; icon: AppIconName; variant: AdtTimelineEvent['variant'] } {
    if (kind === 'admit') return { title: 'Admitted', icon: 'bed-double', variant: 'secondary' };
    if (kind === 'transfer') return { title: 'Transferred', icon: 'layout-list', variant: 'outline' };
    if (kind === 'discharge') return { title: 'Discharged', icon: 'user-x', variant: 'secondary' };
    return { title: 'Voided', icon: 'circle-x', variant: 'destructive' };
}

function adtTimelineKindOrder(kind: AdtTimelineEventKind): number {
    if (kind === 'admit') return 0;
    if (kind === 'transfer') return 1;
    if (kind === 'discharge') return 2;
    return 3;
}

function parseTimelineTimestamp(value: string | null): number | null {
    if (!value) return null;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
}

function currentStatusToTimelineKind(status: string | null | undefined): AdtTimelineEventKind | null {
    const normalized = status?.trim().toLowerCase() ?? '';
    if (normalized === 'admitted') return 'admit';
    if (normalized === 'transferred') return 'transfer';
    if (normalized === 'discharged') return 'discharge';
    if (normalized === 'cancelled') return 'cancel';
    return null;
}

export function buildAdtTimeline(admission: Admission, logs: AdmissionAuditLog[]): AdtTimelineEvent[] {
    const events: AdtTimelineEvent[] = [];
    const logsAscending = [...logs].sort((left, right) => {
        const leftTime = parseTimelineTimestamp(left.createdAt) ?? 0;
        const rightTime = parseTimelineTimestamp(right.createdAt) ?? 0;
        return leftTime - rightTime;
    });

    const createLog = logsAscending.find((log) => log.action === 'admission.created');
    if (createLog) {
        const presentation = adtTimelineEventPresentation('admit');
        events.push({
            key: `adt-${createLog.id}-admit`,
            kind: 'admit',
            title: presentation.title,
            timestamp: admission.admittedAt || createLog.createdAt,
            description: admission.appointmentId
                ? 'Admission started from a consultation handoff.'
                : 'Admission record was created directly.',
            reason: admission.admissionReason?.trim() || null,
            placementSummary: null,
            placementOrigin: null,
            handoffSummary: null,
            icon: presentation.icon,
            variant: presentation.variant,
            source: 'audit',
        });
    }

    for (const log of logsAscending) {
        if (log.action !== 'admission.status.updated') continue;

        const kind = currentStatusToTimelineKind(auditTransitionStatus(log, 'to'));
        if (!kind || kind === 'admit') continue;

        const presentation = adtTimelineEventPresentation(kind);
        const fromStatus = auditTransitionStatus(log, 'from');
        const toStatus = auditTransitionStatus(log, 'to');
        const reasonValue = auditFieldAfterValue(log, 'status_reason');
        const reason = typeof reasonValue === 'string' && reasonValue.trim() !== '' ? reasonValue.trim() : null;
        const timestamp = kind === 'discharge' ? ((auditFieldAfterValue(log, 'discharged_at') as string | null) ?? log.createdAt) : log.createdAt;
        const placementBefore = formatPlacementLabel(auditFieldBeforeValue(log, 'ward'), auditFieldBeforeValue(log, 'bed'));
        const placementAfter = formatPlacementLabel(auditFieldAfterValue(log, 'ward'), auditFieldAfterValue(log, 'bed'));
        const dischargeDestination = auditFieldAfterValue(log, 'discharge_destination');
        const followUpPlan = auditFieldAfterValue(log, 'follow_up_plan');
        const handoffSummary = kind === 'discharge' ? dischargeHandoffSummary(dischargeDestination, followUpPlan) : null;
        let description = fromStatus && toStatus
            ? `Status moved from ${formatEnumLabel(fromStatus)} to ${formatEnumLabel(toStatus)}.`
            : `Status changed to ${presentation.title}.`;

        if (kind === 'transfer') {
            if (placementBefore && placementAfter && placementBefore !== placementAfter) {
                description = `Transferred from ${placementBefore} to ${placementAfter}.`;
            } else if (placementAfter) {
                description = `Transferred to ${placementAfter}.`;
            }
        }

        if (kind === 'discharge') {
            const normalizedDestination = normalizeOptionalText(dischargeDestination);
            if (normalizedDestination) {
                description = `Discharged to ${normalizedDestination}.`;
            }
        }

        events.push({
            key: `adt-${log.id}-${kind}`,
            kind,
            title: presentation.title,
            timestamp,
            description,
            reason,
            placementSummary: kind === 'transfer' ? placementAfter : null,
            placementOrigin: kind === 'transfer' ? placementBefore : null,
            handoffSummary,
            icon: presentation.icon,
            variant: presentation.variant,
            source: 'audit',
        });
    }

    if (!events.some((event) => event.kind === 'admit')) {
        const presentation = adtTimelineEventPresentation('admit');
        events.push({
            key: `adt-fallback-admit-${admission.id}`,
            kind: 'admit',
            title: presentation.title,
            timestamp: admission.admittedAt || admission.createdAt || null,
            description: 'Admission event inferred from the current record because the create audit entry is unavailable.',
            reason: admission.admissionReason?.trim() || null,
            placementSummary: null,
            placementOrigin: null,
            handoffSummary: null,
            icon: presentation.icon,
            variant: presentation.variant,
            source: 'current-state',
        });
    }

    const currentKind = currentStatusToTimelineKind(admission.status);
    if (currentKind && currentKind !== 'admit' && !events.some((event) => event.kind === currentKind)) {
        const presentation = adtTimelineEventPresentation(currentKind);
        const currentPlacement = currentKind === 'transfer' ? formatPlacementLabel(admission.ward, admission.bed) : null;
        const currentHandoffSummary = currentKind === 'discharge' ? dischargeHandoffSummary(admission.dischargeDestination, admission.followUpPlan) : null;

        events.push({
            key: `adt-fallback-${currentKind}-${admission.id}`,
            kind: currentKind,
            title: presentation.title,
            timestamp: currentKind === 'discharge' ? admission.dischargedAt || admission.updatedAt || null : admission.updatedAt || null,
            description:
                currentKind === 'transfer' && currentPlacement
                    ? `Current transfer placement is ${currentPlacement}. Matching status transition audit entry is unavailable.`
                    : currentKind === 'discharge' && normalizeOptionalText(admission.dischargeDestination)
                      ? `Current discharge destination is ${normalizeOptionalText(admission.dischargeDestination)}. Matching status transition audit entry is unavailable.`
                      : 'Current admission state is shown because a matching status transition audit entry is unavailable.',
            reason: admission.statusReason?.trim() || null,
            placementSummary: currentPlacement,
            placementOrigin: null,
            handoffSummary: currentHandoffSummary,
            icon: presentation.icon,
            variant: presentation.variant,
            source: 'current-state',
        });
    }

    return events.sort((left, right) => {
        const leftTime = parseTimelineTimestamp(left.timestamp);
        const rightTime = parseTimelineTimestamp(right.timestamp);

        if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
            return leftTime - rightTime;
        }
        if (leftTime !== null && rightTime === null) return -1;
        if (leftTime === null && rightTime !== null) return 1;

        const kindDelta = adtTimelineKindOrder(left.kind) - adtTimelineKindOrder(right.kind);
        if (kindDelta !== 0) return kindDelta;

        return left.key.localeCompare(right.key);
    });
}
