import {
    canApplyLaboratoryEncounterLifecycleAction,
    canApplyPharmacyEncounterLifecycleAction,
    canApplyRadiologyEncounterLifecycleAction,
    canApplyTheatreEncounterLifecycleAction,
    isEncounterOrderEnteredInError,
} from '@/lib/encounterWorkspaceLifecycle';
import { patientChartModuleHref } from '@/composables/patientChart/patientChartModuleHref';
import type {
    PatientChartCurrentCareNextAction,
    PatientChartLaboratoryOrder,
    PatientChartPharmacyOrder,
    PatientChartRadiologyOrder,
    PatientChartTheatreProcedure,
} from '@/composables/patientChart/patientChartOrderTypes';

export type CurrentCareLaneKind = 'laboratory' | 'pharmacy' | 'radiology' | 'theatre';
type CurrentCareItem = PatientChartLaboratoryOrder | PatientChartPharmacyOrder | PatientChartRadiologyOrder | PatientChartTheatreProcedure;

export function parseClinicalDate(value: string | null | undefined): number | null {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function isClinicalDateWithinDays(value: string | null | undefined, days: number): boolean {
    const parsed = parseClinicalDate(value);
    if (parsed === null) return false;
    const ageMs = Date.now() - parsed;
    return ageMs >= 0 && ageMs <= days * 24 * 60 * 60 * 1000;
}

export function extractLaboratoryResultFlag(
    resultSummary: string | null,
): 'critical' | 'abnormal' | 'inconclusive' | 'normal' | null {
    const normalized = (resultSummary ?? '').trim().toLowerCase();
    if (normalized === '') return null;

    const match = normalized.match(/result flag:\s*([a-z _-]+)/i);
    const token = match?.[1]?.trim().replace(/\s+/g, '_') ?? '';

    if (token.includes('critical')) return 'critical';
    if (token.includes('abnormal')) return 'abnormal';
    if (token.includes('inconclusive')) return 'inconclusive';
    if (token.includes('normal')) return 'normal';
    return null;
}

export type ClinicalSignalDescriptor = {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    surfaceClass: string;
    /**
     * True only when the signal carries clinical meaning the plain status
     * badge doesn't already convey — Critical / Abnormal / Inconclusive.
     * "Result complete" / "Report complete" / "Pending" / cancelled just
     * restate (or read worse than) the status chip, so cards suppress the
     * duplicate badge for those and keep the soft surface tint instead.
     */
    notable: boolean;
};

function workflowStatusVariantFallback(status: string | null | undefined): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch ((status ?? '').toLowerCase()) {
        case 'active':
        case 'completed':
        case 'dispensed':
        case 'paid':
        case 'finalized':
            return 'default';
        case 'ordered':
        case 'collected':
        case 'planned':
        case 'in_preop':
        case 'in_progress':
        case 'scheduled':
        case 'pending':
        case 'in_preparation':
        case 'partially_dispensed':
        case 'issued':
        case 'partially_paid':
            return 'secondary';
        case 'cancelled':
        case 'voided':
        case 'no_show':
        case 'entered_in_error':
            return 'destructive';
        default:
            return 'outline';
    }
}

export function laboratoryClinicalSignal(order: PatientChartLaboratoryOrder): ClinicalSignalDescriptor {
    const status = (order.status ?? '').trim().toLowerCase();
    const resultFlag = extractLaboratoryResultFlag(order.resultSummary);

    if (status === 'completed') {
        if (resultFlag === 'critical') {
            return { label: 'Critical result', variant: 'destructive', surfaceClass: 'border-destructive/30 bg-destructive/5', notable: true };
        }
        if (resultFlag === 'abnormal' || resultFlag === 'inconclusive') {
            return {
                label: resultFlag === 'inconclusive' ? 'Inconclusive result' : 'Abnormal result',
                variant: 'secondary',
                surfaceClass: 'border-amber-500/30 bg-amber-500/5',
                notable: true,
            };
        }
        return { label: 'Result complete', variant: 'default', surfaceClass: 'border-emerald-500/25 bg-emerald-500/5', notable: false };
    }

    if (['ordered', 'collected', 'in_progress'].includes(status)) {
        return { label: 'Pending result', variant: 'secondary', surfaceClass: 'border-border bg-background', notable: false };
    }

    if (status === 'cancelled' || status === 'entered_in_error') {
        return { label: status, variant: 'destructive', surfaceClass: 'border-destructive/20 bg-destructive/5', notable: false };
    }

    return { label: 'In workflow', variant: workflowStatusVariantFallback(order.status), surfaceClass: 'border-border bg-background', notable: false };
}

export function radiologyClinicalSignal(order: PatientChartRadiologyOrder): ClinicalSignalDescriptor {
    const status = (order.status ?? '').trim().toLowerCase();
    const summary = (order.reportSummary ?? '').trim().toLowerCase();

    if (status === 'completed') {
        if (
            summary.includes('critical finding') ||
            summary.includes('urgent review') ||
            summary.includes('immediate clinical action') ||
            summary.includes('escalate')
        ) {
            return { label: 'Critical report', variant: 'destructive', surfaceClass: 'border-destructive/30 bg-destructive/5', notable: true };
        }

        if (summary !== '') {
            const looksNormal =
                summary.includes('no acute abnormality') ||
                summary.includes('no acute ') ||
                summary.includes('normal study') ||
                summary.includes('unremarkable');

            if (looksNormal) {
                return { label: 'Report complete', variant: 'default', surfaceClass: 'border-emerald-500/25 bg-emerald-500/5', notable: false };
            }
            return { label: 'Abnormal report', variant: 'secondary', surfaceClass: 'border-amber-500/30 bg-amber-500/5', notable: true };
        }

        return { label: 'Report complete', variant: 'default', surfaceClass: 'border-emerald-500/25 bg-emerald-500/5', notable: false };
    }

    if (['ordered', 'scheduled', 'in_progress'].includes(status)) {
        return { label: 'Pending report', variant: 'secondary', surfaceClass: 'border-border bg-background', notable: false };
    }

    if (status === 'cancelled' || status === 'entered_in_error') {
        return { label: status, variant: 'destructive', surfaceClass: 'border-destructive/20 bg-destructive/5', notable: false };
    }

    return { label: 'In workflow', variant: workflowStatusVariantFallback(order.status), surfaceClass: 'border-border bg-background', notable: false };
}

export function isCurrentLaboratoryOrder(order: PatientChartLaboratoryOrder): boolean {
    if (typeof order.currentCare?.isCurrent === 'boolean') return order.currentCare.isCurrent;

    const status = (order.status ?? '').trim().toLowerCase();
    if (['ordered', 'collected', 'in_progress'].includes(status)) return true;

    if (status === 'completed') {
        const signal = extractLaboratoryResultFlag(order.resultSummary);
        return signal === 'critical' || signal === 'abnormal' || signal === 'inconclusive' || isClinicalDateWithinDays(order.resultedAt ?? order.orderedAt, 14);
    }
    return false;
}

export function isCurrentRadiologyOrder(order: PatientChartRadiologyOrder): boolean {
    if (typeof order.currentCare?.isCurrent === 'boolean') return order.currentCare.isCurrent;

    const status = (order.status ?? '').trim().toLowerCase();
    if (['ordered', 'scheduled', 'in_progress'].includes(status)) return true;

    if (status === 'completed') {
        const signal = radiologyClinicalSignal(order).label;
        return signal === 'Critical report' || signal === 'Abnormal report' || isClinicalDateWithinDays(order.completedAt ?? order.orderedAt, 14);
    }
    return false;
}

export function isCurrentPharmacyOrder(order: PatientChartPharmacyOrder): boolean {
    if (typeof order.currentCare?.isCurrent === 'boolean') return order.currentCare.isCurrent;

    const status = (order.status ?? '').trim().toLowerCase();
    if (['pending', 'in_preparation', 'partially_dispensed'].includes(status)) return true;

    if (status === 'dispensed') {
        return !['completed', 'reconciled'].includes((order.reconciliationStatus ?? '').trim().toLowerCase()) || isClinicalDateWithinDays(order.dispensedAt ?? order.orderedAt, 30);
    }
    return false;
}

export function isCurrentTheatreProcedure(procedure: PatientChartTheatreProcedure): boolean {
    if (typeof procedure.currentCare?.isCurrent === 'boolean') return procedure.currentCare.isCurrent;

    const status = (procedure.status ?? '').trim().toLowerCase();
    if (['planned', 'in_preop', 'in_progress'].includes(status)) return true;

    if (status === 'completed') return isClinicalDateWithinDays(procedure.completedAt ?? procedure.scheduledAt, 30);
    return false;
}

export function sortCurrentItems<T>(items: T[], getPriority: (item: T) => number, getRecency: (item: T) => number): T[] {
    return [...items].sort((left, right) => {
        const priorityDelta = getPriority(right) - getPriority(left);
        if (priorityDelta !== 0) return priorityDelta;
        return getRecency(right) - getRecency(left);
    });
}

export function laboratoryCurrentPriority(order: PatientChartLaboratoryOrder): number {
    if (typeof order.currentCare?.priorityRank === 'number') return order.currentCare.priorityRank;
    const status = (order.status ?? '').trim().toLowerCase();
    const resultFlag = extractLaboratoryResultFlag(order.resultSummary);
    if (status === 'completed' && resultFlag === 'critical') return 500;
    if (status === 'completed' && (resultFlag === 'abnormal' || resultFlag === 'inconclusive')) return 450;
    if (status === 'in_progress') return 400;
    if (status === 'collected') return 380;
    if (status === 'ordered') return 360;
    if (status === 'completed') return 300;
    return 0;
}
export function laboratoryCurrentRecency(order: PatientChartLaboratoryOrder): number {
    return parseClinicalDate(order.resultedAt) ?? parseClinicalDate(order.orderedAt) ?? 0;
}

export function radiologyCurrentPriority(order: PatientChartRadiologyOrder): number {
    if (typeof order.currentCare?.priorityRank === 'number') return order.currentCare.priorityRank;
    const status = (order.status ?? '').trim().toLowerCase();
    const signal = radiologyClinicalSignal(order).label;
    if (signal === 'Critical report') return 500;
    if (signal === 'Abnormal report') return 450;
    if (status === 'in_progress') return 400;
    if (status === 'scheduled') return 380;
    if (status === 'ordered') return 360;
    if (status === 'completed') return 300;
    return 0;
}
export function radiologyCurrentRecency(order: PatientChartRadiologyOrder): number {
    return parseClinicalDate(order.completedAt) ?? parseClinicalDate(order.orderedAt) ?? 0;
}

export function pharmacyCurrentPriority(order: PatientChartPharmacyOrder): number {
    if (typeof order.currentCare?.priorityRank === 'number') return order.currentCare.priorityRank;
    const status = (order.status ?? '').trim().toLowerCase();
    const reconciliationStatus = (order.reconciliationStatus ?? '').trim().toLowerCase();
    if (status === 'dispensed' && !['completed', 'reconciled'].includes(reconciliationStatus)) return 520;
    if (status === 'partially_dispensed') return 500;
    if (status === 'in_preparation') return 480;
    if (status === 'pending') return 460;
    if (status === 'dispensed') return 320;
    return 0;
}
export function pharmacyCurrentRecency(order: PatientChartPharmacyOrder): number {
    return parseClinicalDate(order.reconciledAt) ?? parseClinicalDate(order.dispensedAt) ?? parseClinicalDate(order.orderedAt) ?? 0;
}

export function theatreCurrentPriority(procedure: PatientChartTheatreProcedure): number {
    if (typeof procedure.currentCare?.priorityRank === 'number') return procedure.currentCare.priorityRank;
    const status = (procedure.status ?? '').trim().toLowerCase();
    if (status === 'in_progress') return 500;
    if (status === 'in_preop') return 450;
    if (status === 'planned') return 400;
    if (status === 'completed') return 300;
    return 0;
}
export function theatreCurrentRecency(procedure: PatientChartTheatreProcedure): number {
    return parseClinicalDate(procedure.completedAt) ?? parseClinicalDate(procedure.scheduledAt) ?? 0;
}

export function currentCareNextAction(kind: CurrentCareLaneKind, item: CurrentCareItem | null): PatientChartCurrentCareNextAction | null {
    const nextAction = item?.currentCare?.nextAction;
    if (nextAction?.label?.trim()) return nextAction;
    if (!item) return null;

    if (kind === 'laboratory') {
        return { key: 'review_order', label: (item as PatientChartLaboratoryOrder).resultedAt ? 'Review result' : 'Review order', emphasis: 'secondary' };
    }
    if (kind === 'radiology') {
        return { key: 'review_order', label: (item as PatientChartRadiologyOrder).completedAt ? 'Review report' : 'Review order', emphasis: 'secondary' };
    }
    if (kind === 'pharmacy') {
        return { key: 'open_order', label: 'Open order', emphasis: 'secondary' };
    }
    return { key: 'review_case', label: 'Review case', emphasis: 'secondary' };
}

export function currentCareNextActionHref(
    kind: CurrentCareLaneKind,
    item: CurrentCareItem,
    patientId: string,
    appointmentId: string | null,
): string {
    const href =
        kind === 'theatre'
            ? patientChartModuleHref('/theatre-procedures', patientId, appointmentId, { includeAppointment: false, focusProcedureId: item.id })
            : patientChartModuleHref(
                  kind === 'laboratory' ? '/laboratory-orders' : kind === 'radiology' ? '/radiology-orders' : '/pharmacy-orders',
                  patientId,
                  appointmentId,
                  { includeAppointment: false, focusOrderId: item.id },
              );

    const actionKey = String(item.currentCare?.nextAction?.key ?? '').trim();
    if (actionKey === '' || actionKey === 'open_order') return href;

    const url = new URL(href, window.location.origin);
    url.searchParams.set('focusWorkflowActionKey', actionKey);
    return `${url.pathname}${url.search}${url.hash}`;
}

export function serviceTimelineActionLabel(kind: CurrentCareLaneKind, item: CurrentCareItem): string {
    const nextAction = currentCareNextAction(kind, item);
    if (nextAction?.label) return nextAction.label;

    const status = String(item.status ?? '').toLowerCase();
    if (kind === 'laboratory') return status === 'completed' ? 'Open result' : 'Open lab order';
    if (kind === 'radiology') return status === 'completed' ? 'Open report' : 'Open imaging order';
    if (kind === 'pharmacy') return status === 'dispensed' ? 'Open dispense' : 'Open pharmacy order';
    return status === 'completed' ? 'Open case' : 'Open procedure';
}

export function currentCareNextActionIcon(kind: CurrentCareLaneKind): string {
    if (kind === 'laboratory') return 'flask-conical';
    if (kind === 'radiology') return 'scan-line';
    if (kind === 'pharmacy') return 'pill';
    return 'scissors';
}

export function currentCareNextActionVariant(action: PatientChartCurrentCareNextAction | null): 'default' | 'outline' {
    return action?.emphasis === 'secondary' ? 'outline' : 'default';
}

export function currentCareWorkflowHint(item: CurrentCareItem | null): string | null {
    const hint = String(item?.currentCare?.workflowHint ?? '').trim();
    return hint === '' ? null : hint;
}

export function canCreateLaboratoryEncounterFollowOnOrder(order: PatientChartLaboratoryOrder | null, canCreate: boolean): boolean {
    return Boolean(order && canCreate && order.patientId?.trim() && !isEncounterOrderEnteredInError(order));
}
export function hasLaboratoryEncounterMoreActions(order: PatientChartLaboratoryOrder | null, canCreate: boolean): boolean {
    return canApplyLaboratoryEncounterLifecycleAction(order, 'cancel', canCreate) || canApplyLaboratoryEncounterLifecycleAction(order, 'entered_in_error', canCreate);
}

export function canCreateRadiologyEncounterFollowOnOrder(order: PatientChartRadiologyOrder | null, canCreate: boolean): boolean {
    return Boolean(order && canCreate && order.patientId?.trim() && !isEncounterOrderEnteredInError(order));
}
export function hasRadiologyEncounterMoreActions(order: PatientChartRadiologyOrder | null, canCreate: boolean): boolean {
    return canApplyRadiologyEncounterLifecycleAction(order, 'cancel', canCreate) || canApplyRadiologyEncounterLifecycleAction(order, 'entered_in_error', canCreate);
}

export function canCreatePharmacyEncounterFollowOnOrder(order: PatientChartPharmacyOrder | null, canCreate: boolean): boolean {
    return Boolean(order && canCreate && order.patientId?.trim() && !isEncounterOrderEnteredInError(order));
}
export function hasPharmacyEncounterMoreActions(order: PatientChartPharmacyOrder | null, canCreate: boolean): boolean {
    return (
        canApplyPharmacyEncounterLifecycleAction(order, 'cancel', canCreate) ||
        canApplyPharmacyEncounterLifecycleAction(order, 'discontinue', canCreate) ||
        canApplyPharmacyEncounterLifecycleAction(order, 'entered_in_error', canCreate)
    );
}

export function canCreateTheatreEncounterFollowOnOrder(procedure: PatientChartTheatreProcedure | null, canCreate: boolean): boolean {
    return Boolean(procedure && canCreate && procedure.patientId?.trim() && !isEncounterOrderEnteredInError(procedure));
}
export function hasTheatreEncounterMoreActions(procedure: PatientChartTheatreProcedure | null, canCreate: boolean): boolean {
    return canApplyTheatreEncounterLifecycleAction(procedure, 'cancel', canCreate) || canApplyTheatreEncounterLifecycleAction(procedure, 'entered_in_error', canCreate);
}

export function pharmacyOrderQuantityLabel(quantity: string | number | null | undefined): string | null {
    if (quantity === null || quantity === undefined) return null;
    const normalized = String(quantity).trim();
    if (normalized === '') return null;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return `Qty ${normalized}`;
    return `Qty ${parsed}`;
}
