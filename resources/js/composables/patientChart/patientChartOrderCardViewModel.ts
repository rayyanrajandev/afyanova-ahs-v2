import type { EncounterLifecycleAction } from '@/lib/encounterWorkspaceLifecycle';
import { encounterLifecycleLinkageText } from '@/lib/encounterWorkspaceLifecycle';
import { formatEnumLabel } from '@/lib/labels';
import { patientChartModuleHref } from '@/composables/patientChart/patientChartModuleHref';
import {
    type ClinicalSignalDescriptor,
    type CurrentCareLaneKind,
    canCreateLaboratoryEncounterFollowOnOrder,
    canCreatePharmacyEncounterFollowOnOrder,
    canCreateRadiologyEncounterFollowOnOrder,
    canCreateTheatreEncounterFollowOnOrder,
    currentCareNextAction,
    currentCareNextActionHref,
    currentCareNextActionVariant,
    currentCareWorkflowHint,
    hasLaboratoryEncounterMoreActions,
    hasPharmacyEncounterMoreActions,
    hasRadiologyEncounterMoreActions,
    hasTheatreEncounterMoreActions,
    laboratoryClinicalSignal,
    pharmacyOrderQuantityLabel,
    radiologyClinicalSignal,
} from '@/composables/patientChart/patientChartCurrentCare';
import {
    canApplyLaboratoryEncounterLifecycleAction,
    canApplyPharmacyEncounterLifecycleAction,
    canApplyRadiologyEncounterLifecycleAction,
    canApplyTheatreEncounterLifecycleAction,
} from '@/lib/encounterWorkspaceLifecycle';
import type {
    PatientChartLaboratoryOrder,
    PatientChartPharmacyOrder,
    PatientChartRadiologyOrder,
    PatientChartTheatreProcedure,
} from '@/composables/patientChart/patientChartOrderTypes';
import { formatDateTime, truncatePlainText, workflowStatusVariant } from '@/composables/patientChart/usePatientChartTimeline';

export type PatientChartOrderCardMoreAction = { action: EncounterLifecycleAction; label: string };

export type PatientChartOrderCardViewModel = {
    id: string;
    kind: CurrentCareLaneKind;
    title: string;
    metaLine: string;
    statusLabel: string;
    statusVariant: 'default' | 'secondary' | 'outline' | 'destructive';
    signal: ClinicalSignalDescriptor | null;
    surfaceClass: string;
    summary: string;
    /** Untruncated laboratory resultSummary, for LabResultSummaryPopover —
     * `summary` above is truncated for the plain-text teaser line. Null for
     * every non-laboratory kind and for lab orders with no result yet. */
    rawLabResultSummary: string | null;
    linkageText: string | null;
    workflowHint: string | null;
    nextActionLabel: string | null;
    nextActionHref: string | null;
    nextActionVariant: 'default' | 'outline';
    nextActionIcon: string;
    reorderHref: string | null;
    addOnHref: string | null;
    moreActions: PatientChartOrderCardMoreAction[];
    defaultCancelReason: string | null;
};

type ViewModelContext = {
    patientId: string;
    appointmentId: string | null;
    canReadLaboratoryOrders?: boolean;
    canReadRadiologyOrders?: boolean;
    canReadPharmacyOrders?: boolean;
    canReadTheatreProcedures?: boolean;
    canCreateLaboratoryOrders?: boolean;
    canCreateRadiologyOrders?: boolean;
    canCreatePharmacyOrders?: boolean;
    canCreateTheatreProcedures?: boolean;
};

function moreActionsFor(actions: { action: EncounterLifecycleAction; allowed: boolean }[]): PatientChartOrderCardMoreAction[] {
    const labels: Record<EncounterLifecycleAction, string> = {
        cancel: 'Cancel',
        discontinue: 'Discontinue',
        entered_in_error: 'Mark entered in error',
    };
    return actions.filter((entry) => entry.allowed).map((entry) => ({ action: entry.action, label: labels[entry.action] }));
}

export function laboratoryOrderCardViewModel(order: PatientChartLaboratoryOrder, ctx: ViewModelContext): PatientChartOrderCardViewModel {
    const canRead = ctx.canReadLaboratoryOrders ?? false;
    const canCreate = ctx.canCreateLaboratoryOrders ?? false;
    const signal = laboratoryClinicalSignal(order);
    const nextAction = currentCareNextAction('laboratory', order);

    return {
        id: order.id,
        kind: 'laboratory',
        title: order.testName || 'Laboratory order',
        metaLine: `${order.orderNumber || 'Order number pending'} | Ordered ${formatDateTime(order.orderedAt)}`,
        statusLabel: formatEnumLabel(order.status || 'ordered'),
        statusVariant: workflowStatusVariant(order.status),
        signal,
        surfaceClass: signal.surfaceClass,
        summary: order.resultSummary ? truncatePlainText(order.resultSummary, 220) : 'Awaiting result entry or verification.',
        rawLabResultSummary: order.resultSummary,
        linkageText: encounterLifecycleLinkageText(order, 'laboratory order'),
        workflowHint: currentCareWorkflowHint(order),
        nextActionLabel: canRead ? nextAction?.label ?? null : null,
        nextActionHref: canRead ? currentCareNextActionHref('laboratory', order, ctx.patientId, ctx.appointmentId) : null,
        nextActionVariant: currentCareNextActionVariant(nextAction),
        nextActionIcon: 'flask-conical',
        reorderHref: canCreateLaboratoryEncounterFollowOnOrder(order, canCreate)
            ? patientChartModuleHref('/laboratory-orders/legacy', ctx.patientId, ctx.appointmentId, { includeTabNew: true, reorderOfId: order.id })
            : null,
        addOnHref: canCreateLaboratoryEncounterFollowOnOrder(order, canCreate)
            ? patientChartModuleHref('/laboratory-orders/legacy', ctx.patientId, ctx.appointmentId, { includeTabNew: true, addOnToOrderId: order.id })
            : null,
        moreActions: hasLaboratoryEncounterMoreActions(order, canCreate)
            ? moreActionsFor([
                  { action: 'cancel', allowed: canApplyLaboratoryEncounterLifecycleAction(order, 'cancel', canCreate) },
                  { action: 'entered_in_error', allowed: canApplyLaboratoryEncounterLifecycleAction(order, 'entered_in_error', canCreate) },
              ])
            : [],
        defaultCancelReason: order.statusReason,
    };
}

export function radiologyOrderCardViewModel(order: PatientChartRadiologyOrder, ctx: ViewModelContext): PatientChartOrderCardViewModel {
    const canRead = ctx.canReadRadiologyOrders ?? false;
    const canCreate = ctx.canCreateRadiologyOrders ?? false;
    const signal = radiologyClinicalSignal(order);
    const nextAction = currentCareNextAction('radiology', order);

    return {
        id: order.id,
        kind: 'radiology',
        title: order.studyDescription || 'Imaging order',
        metaLine: `${order.orderNumber || 'Order number pending'} | Ordered ${formatDateTime(order.orderedAt)}`,
        statusLabel: formatEnumLabel(order.status || 'ordered'),
        statusVariant: workflowStatusVariant(order.status),
        signal,
        surfaceClass: signal.surfaceClass,
        summary: order.reportSummary ? truncatePlainText(order.reportSummary, 220) : 'Awaiting report entry.',
        rawLabResultSummary: null,
        linkageText: encounterLifecycleLinkageText(order, 'imaging order'),
        workflowHint: currentCareWorkflowHint(order),
        nextActionLabel: canRead ? nextAction?.label ?? null : null,
        nextActionHref: canRead ? currentCareNextActionHref('radiology', order, ctx.patientId, ctx.appointmentId) : null,
        nextActionVariant: currentCareNextActionVariant(nextAction),
        nextActionIcon: 'scan-line',
        reorderHref: canCreateRadiologyEncounterFollowOnOrder(order, canCreate)
            ? patientChartModuleHref('/radiology-orders/legacy', ctx.patientId, ctx.appointmentId, { includeTabNew: true, reorderOfId: order.id })
            : null,
        addOnHref: canCreateRadiologyEncounterFollowOnOrder(order, canCreate)
            ? patientChartModuleHref('/radiology-orders/legacy', ctx.patientId, ctx.appointmentId, { includeTabNew: true, addOnToOrderId: order.id })
            : null,
        moreActions: hasRadiologyEncounterMoreActions(order, canCreate)
            ? moreActionsFor([
                  { action: 'cancel', allowed: canApplyRadiologyEncounterLifecycleAction(order, 'cancel', canCreate) },
                  { action: 'entered_in_error', allowed: canApplyRadiologyEncounterLifecycleAction(order, 'entered_in_error', canCreate) },
              ])
            : [],
        defaultCancelReason: order.statusReason,
    };
}

export function pharmacyOrderCardViewModel(order: PatientChartPharmacyOrder, ctx: ViewModelContext): PatientChartOrderCardViewModel {
    const canRead = ctx.canReadPharmacyOrders ?? false;
    const canCreate = ctx.canCreatePharmacyOrders ?? false;
    const nextAction = currentCareNextAction('pharmacy', order);
    const quantityLabel = pharmacyOrderQuantityLabel(order.quantityPrescribed);

    return {
        id: order.id,
        kind: 'pharmacy',
        title: order.medicationName || 'Pharmacy order',
        metaLine: [order.orderNumber || 'Order number pending', `Ordered ${formatDateTime(order.orderedAt)}`, quantityLabel].filter(Boolean).join(' | '),
        statusLabel: formatEnumLabel(order.status || 'pending'),
        statusVariant: workflowStatusVariant(order.status),
        signal: null,
        surfaceClass: 'border-border bg-background',
        summary: truncatePlainText(order.dosageInstruction, 220) || 'Medication instructions not recorded.',
        rawLabResultSummary: null,
        linkageText: encounterLifecycleLinkageText(order, 'pharmacy order'),
        workflowHint: currentCareWorkflowHint(order),
        nextActionLabel: canRead ? nextAction?.label ?? null : null,
        nextActionHref: canRead ? currentCareNextActionHref('pharmacy', order, ctx.patientId, ctx.appointmentId) : null,
        nextActionVariant: currentCareNextActionVariant(nextAction),
        nextActionIcon: 'pill',
        reorderHref: canCreatePharmacyEncounterFollowOnOrder(order, canCreate)
            ? patientChartModuleHref('/pharmacy-orders/legacy', ctx.patientId, ctx.appointmentId, { includeTabNew: true, reorderOfId: order.id })
            : null,
        addOnHref: canCreatePharmacyEncounterFollowOnOrder(order, canCreate)
            ? patientChartModuleHref('/pharmacy-orders/legacy', ctx.patientId, ctx.appointmentId, { includeTabNew: true, addOnToOrderId: order.id })
            : null,
        moreActions: hasPharmacyEncounterMoreActions(order, canCreate)
            ? moreActionsFor([
                  { action: 'cancel', allowed: canApplyPharmacyEncounterLifecycleAction(order, 'cancel', canCreate) },
                  { action: 'discontinue', allowed: canApplyPharmacyEncounterLifecycleAction(order, 'discontinue', canCreate) },
                  { action: 'entered_in_error', allowed: canApplyPharmacyEncounterLifecycleAction(order, 'entered_in_error', canCreate) },
              ])
            : [],
        defaultCancelReason: order.statusReason,
    };
}

export function theatreProcedureCardViewModel(procedure: PatientChartTheatreProcedure, ctx: ViewModelContext): PatientChartOrderCardViewModel {
    const canRead = ctx.canReadTheatreProcedures ?? false;
    const canCreate = ctx.canCreateTheatreProcedures ?? false;
    const nextAction = currentCareNextAction('theatre', procedure);

    return {
        id: procedure.id,
        kind: 'theatre',
        title: procedure.procedureName || procedure.procedureType || 'Theatre procedure',
        metaLine: [procedure.procedureNumber || 'Procedure number pending', `Scheduled ${formatDateTime(procedure.scheduledAt)}`].filter(Boolean).join(' | '),
        statusLabel: formatEnumLabel(procedure.status || 'planned'),
        statusVariant: workflowStatusVariant(procedure.status),
        signal: null,
        surfaceClass: 'border-border bg-background',
        summary:
            truncatePlainText(procedure.notes, 220) ||
            truncatePlainText(procedure.statusReason, 220) ||
            (procedure.theatreRoomName ? `Room: ${procedure.theatreRoomName}` : 'Awaiting theatre progression.'),
        rawLabResultSummary: null,
        linkageText: encounterLifecycleLinkageText(procedure, 'procedure booking'),
        workflowHint: currentCareWorkflowHint(procedure),
        nextActionLabel: canRead ? nextAction?.label ?? null : null,
        nextActionHref: canRead ? currentCareNextActionHref('theatre', procedure, ctx.patientId, ctx.appointmentId) : null,
        nextActionVariant: currentCareNextActionVariant(nextAction),
        nextActionIcon: 'scissors',
        reorderHref: canCreateTheatreEncounterFollowOnOrder(procedure, canCreate)
            ? patientChartModuleHref('/theatre-procedures/legacy', ctx.patientId, ctx.appointmentId, { includeTabNew: true, reorderOfId: procedure.id })
            : null,
        addOnHref: canCreateTheatreEncounterFollowOnOrder(procedure, canCreate)
            ? patientChartModuleHref('/theatre-procedures/legacy', ctx.patientId, ctx.appointmentId, { includeTabNew: true, addOnToOrderId: procedure.id })
            : null,
        moreActions: hasTheatreEncounterMoreActions(procedure, canCreate)
            ? moreActionsFor([
                  { action: 'cancel', allowed: canApplyTheatreEncounterLifecycleAction(procedure, 'cancel', canCreate) },
                  { action: 'entered_in_error', allowed: canApplyTheatreEncounterLifecycleAction(procedure, 'entered_in_error', canCreate) },
              ])
            : [],
        defaultCancelReason: procedure.statusReason,
    };
}
