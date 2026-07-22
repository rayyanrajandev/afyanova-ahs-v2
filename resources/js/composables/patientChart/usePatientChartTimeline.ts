import { computed, type ComputedRef, type Ref } from 'vue';
import { formatEnumLabel } from '@/lib/labels';
import type { PatientChartAppointment } from '@/composables/patientChart/usePatientAppointments';
import type { PatientChartMedicalRecord } from '@/composables/patientChart/usePatientMedicalRecords';
import type { PatientChartBillingInvoice } from '@/composables/patientChart/usePatientBillingInvoices';
import type {
    PatientChartLaboratoryOrder,
    PatientChartLaboratoryOrderStatusCounts,
    PatientChartPharmacyOrder,
    PatientChartPharmacyOrderStatusCounts,
    PatientChartRadiologyOrder,
    PatientChartRadiologyOrderStatusCounts,
    PatientChartTheatreProcedure,
    PatientChartTheatreProcedureStatusCounts,
} from '@/composables/patientChart/patientChartOrderTypes';
import type { PatientChartBillingInvoiceStatusCounts } from '@/composables/patientChart/usePatientBillingInvoices';
import { patientChartModuleHref } from '@/composables/patientChart/patientChartModuleHref';
import { currentCareNextActionHref, serviceTimelineActionLabel } from '@/composables/patientChart/patientChartCurrentCare';
import {
    activeVisitStatuses,
    appointmentDetailsHref as sharedAppointmentDetailsHref,
    appointmentPrimaryActionHref,
    appointmentPrimaryActionIcon,
    appointmentPrimaryActionLabel,
} from '@/composables/patientChart/patientChartAppointmentAction';

export type ChartTimelineEventCategory =
    | 'visit'
    | 'consultation'
    | 'laboratory'
    | 'imaging'
    | 'pharmacy'
    | 'procedure'
    | 'billing';

export type ChartTimelineEvent = {
    id: string;
    category: ChartTimelineEventCategory;
    occurredAt: string | null;
    title: string;
    subtitle: string;
    summary: string;
    status: string | null;
    appointmentId: string | null;
    encounterId: string | null;
    href: string | null;
    actionLabel: string | null;
    accentClass: string;
    icon: string;
};

export function formatDate(value: string | null | undefined): string {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export function formatMoney(value: string | number | null | undefined, currencyCode?: string | null): string {
    if (value === null || value === undefined || value === '') return 'Amount not recorded';
    const amount = Number(value);
    if (!Number.isFinite(amount)) return String(value);
    const currency = currencyCode?.trim().toUpperCase() || 'TZS';
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toLocaleString()}`;
    }
}

export function plainTextFromHtml(value: string | null | undefined): string {
    if (!value) return '';

    return value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p>/gi, '\n\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+\n/g, '\n')
        .replace(/\n\s+/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function truncatePlainText(value: string | null | undefined, max = 160): string {
    const plain = plainTextFromHtml(value);
    if (!plain) return '';
    if (plain.length <= max) return plain;
    return `${plain.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}

export function timelineCategoryLabel(category: ChartTimelineEventCategory): string {
    switch (category) {
        case 'visit':
            return 'Visit';
        case 'consultation':
            return 'Consultation';
        case 'laboratory':
            return 'Lab';
        case 'imaging':
            return 'Imaging';
        case 'pharmacy':
            return 'Pharmacy';
        case 'procedure':
            return 'Procedure';
        case 'billing':
            return 'Billing';
        default:
            return 'Timeline';
    }
}

export function workflowStatusVariant(
    status: string | null | undefined,
): 'default' | 'secondary' | 'outline' | 'destructive' {
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

export function appointmentStatusVariant(
    status: string | null | undefined,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'in_consultation':
            return 'default';
        case 'waiting_provider':
            return 'secondary';
        case 'cancelled':
        case 'no_show':
            return 'destructive';
        default:
            return 'outline';
    }
}

function timelineSectionKey(value: string | null | undefined): string {
    if (!value) return 'undated';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'undated';
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function timelineSectionLabel(value: string | null | undefined): string {
    if (!value) return 'Undated';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Undated';

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const current = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

    if (current === startOfToday) return 'Today';
    if (current === startOfYesterday) return 'Yesterday';
    return formatDate(value);
}

export function recordProblem(record: PatientChartMedicalRecord): string {
    return truncatePlainText(record.assessment, 160) || 'No problem focus recorded.';
}

export function recordNextStep(record: PatientChartMedicalRecord): string {
    return truncatePlainText(record.plan, 160) || 'No follow-up plan recorded.';
}

export type UsePatientChartTimelineParams = {
    patientId: Ref<string>;
    primaryVisit: ComputedRef<PatientChartAppointment | null>;
    focusedEncounterId: Ref<string | null>;
    closedVisits: Ref<Record<string, true | undefined>>;
    canReadAppointments: Ref<boolean>;
    canRecordOpdTriage: Ref<boolean>;
    canStartConsultation: Ref<boolean>;
    canReadMedicalRecords: Ref<boolean>;
    canReadLaboratoryOrders: Ref<boolean>;
    canReadRadiologyOrders: Ref<boolean>;
    canReadPharmacyOrders: Ref<boolean>;
    canReadTheatreProcedures: Ref<boolean>;
    canReadBillingInvoices: Ref<boolean>;
    appointments: Ref<PatientChartAppointment[]>;
    records: Ref<PatientChartMedicalRecord[]>;
    recordsTotal: Ref<number>;
    laboratoryOrders: Ref<PatientChartLaboratoryOrder[]>;
    radiologyOrders: Ref<PatientChartRadiologyOrder[]>;
    pharmacyOrders: Ref<PatientChartPharmacyOrder[]>;
    theatreProcedures: Ref<PatientChartTheatreProcedure[]>;
    billingInvoices: Ref<PatientChartBillingInvoice[]>;
    laboratoryOrderCounts: Ref<PatientChartLaboratoryOrderStatusCounts | null | undefined>;
    radiologyOrderCounts: Ref<PatientChartRadiologyOrderStatusCounts | null | undefined>;
    pharmacyOrderCounts: Ref<PatientChartPharmacyOrderStatusCounts | null | undefined>;
    theatreProcedureCounts: Ref<PatientChartTheatreProcedureStatusCounts | null | undefined>;
    billingInvoiceCounts: Ref<PatientChartBillingInvoiceStatusCounts | null | undefined>;
};

/**
 * Ports timelineEvents/timelineSections/timelinePreview/handoffSummary/
 * latestClinicalSignal/nextDocumentedStep/careCounts/focusedEncounterX from
 * the old Show.vue (patients/chart), unchanged in behavior. Order-type event
 * hrefs/action labels now reuse the same current-care "next action" system
 * as the Orders tab (see patientChartCurrentCare.ts), and focusedEncounterX
 * filters by the real encounterId instead of appointmentId (see §4 of
 * reports/patient-chart-rebuild-plan.md) — the visit event itself still
 * matches by appointmentId since a visit event fundamentally *is* the
 * appointment, which carries no encounterId of its own.
 */
export function usePatientChartTimeline(params: UsePatientChartTimelineParams) {
    function recordRegistryHref(record: PatientChartMedicalRecord): string {
        const query = new URLSearchParams({ patientId: params.patientId.value, recordId: record.id });
        if (record.appointmentId) query.set('appointmentId', record.appointmentId);
        if (record.admissionId) query.set('admissionId', record.admissionId);
        return `/medical-records?${query.toString()}`;
    }

    const appointmentDetailsHref = sharedAppointmentDetailsHref;
    const primaryVisit = params.primaryVisit;

    const visitFocusOptions = computed(() => params.appointments.value.slice(0, 4));
    const latestRecord = computed(() => params.records.value[0] ?? null);

    const openVisitStatuses = ['scheduled', ...activeVisitStatuses];
    const hasOpenVisitInChart = computed(() => Boolean(primaryVisit.value && !params.closedVisits.value?.[primaryVisit.value.id] && openVisitStatuses.includes(primaryVisit.value.status || '')));

    const visitPrimaryActionHref = computed(() => {
        if (!primaryVisit.value) {
            return `/appointments?${new URLSearchParams({ patientId: params.patientId.value, open: 'schedule', from: 'patient-chart' }).toString()}`;
        }
        return hasOpenVisitInChart.value
            ? appointmentPrimaryActionHref(primaryVisit.value, params.canRecordOpdTriage.value, params.canStartConsultation.value, params.closedVisits.value)
            : appointmentDetailsHref(primaryVisit.value);
    });
    const visitPrimaryActionLabel = computed(() => {
        if (!primaryVisit.value) return 'Schedule appointment';
        if (hasOpenVisitInChart.value) {
            return appointmentPrimaryActionLabel(primaryVisit.value, params.canRecordOpdTriage.value, params.canStartConsultation.value, params.closedVisits.value);
        }
        return 'Open visit';
    });
    const visitPrimaryActionIcon = computed(() => {
        if (!primaryVisit.value) return 'calendar-plus-2';
        if (hasOpenVisitInChart.value) {
            return appointmentPrimaryActionIcon(primaryVisit.value, params.canRecordOpdTriage.value, params.canStartConsultation.value, params.closedVisits.value);
        }
        return 'calendar-clock';
    });

    /** Mirrors the old page's careCounts exactly — derived from the server status-counts responses, not from the (perPage-truncated) list items. */
    const careCounts = computed(() => ({
        labActive:
            (params.laboratoryOrderCounts.value?.ordered ?? 0) +
            (params.laboratoryOrderCounts.value?.collected ?? 0) +
            (params.laboratoryOrderCounts.value?.in_progress ?? 0),
        labCompleted: params.laboratoryOrderCounts.value?.completed ?? 0,
        imagingActive:
            (params.radiologyOrderCounts.value?.ordered ?? 0) +
            (params.radiologyOrderCounts.value?.scheduled ?? 0) +
            (params.radiologyOrderCounts.value?.in_progress ?? 0),
        imagingCompleted: params.radiologyOrderCounts.value?.completed ?? 0,
        procedureActive:
            (params.theatreProcedureCounts.value?.planned ?? 0) +
            (params.theatreProcedureCounts.value?.in_preop ?? 0) +
            (params.theatreProcedureCounts.value?.in_progress ?? 0),
        procedureCompleted: params.theatreProcedureCounts.value?.completed ?? 0,
        pharmacyActive:
            (params.pharmacyOrderCounts.value?.pending ?? 0) +
            (params.pharmacyOrderCounts.value?.in_preparation ?? 0) +
            (params.pharmacyOrderCounts.value?.partially_dispensed ?? 0),
        pharmacyDispensed: params.pharmacyOrderCounts.value?.dispensed ?? 0,
        billingOpen:
            (params.billingInvoiceCounts.value?.draft ?? 0) +
            (params.billingInvoiceCounts.value?.issued ?? 0) +
            (params.billingInvoiceCounts.value?.partially_paid ?? 0),
        billingSettled: params.billingInvoiceCounts.value?.paid ?? 0,
    }));

    const timelineEvents = computed<ChartTimelineEvent[]>(() => {
        const appointmentEvents = params.appointments.value.map<ChartTimelineEvent>((appointment) => ({
            id: `visit-${appointment.id}`,
            category: 'visit',
            occurredAt: appointment.scheduledAt,
            title: appointment.department || appointment.appointmentNumber || 'Visit scheduled',
            subtitle: appointment.appointmentNumber || 'Visit',
            summary:
                [
                    appointment.reason || 'No visit reason recorded.',
                    appointment.triageVitalsSummary ? `Triage: ${appointment.triageVitalsSummary}` : null,
                ]
                    .filter(Boolean)
                    .join(' | ') || 'Visit context recorded in the appointment workspace.',
            status: appointment.status || 'scheduled',
            appointmentId: appointment.id,
            encounterId: null,
            href: params.canReadAppointments.value ? appointmentDetailsHref(appointment) : null,
            actionLabel: params.canReadAppointments.value ? 'Open visit' : null,
            accentClass: 'border-l-sky-500/70',
            icon: 'calendar-clock',
        }));

        const recordEvents = params.records.value.map<ChartTimelineEvent>((record) => ({
            id: `record-${record.id}`,
            category: 'consultation',
            occurredAt: record.encounterAt,
            title: record.recordNumber || 'Consultation note',
            subtitle: formatEnumLabel(record.recordType || 'consultation_note'),
            summary: [recordProblem(record), recordNextStep(record)].filter(Boolean).join(' Next: '),
            status: record.status || 'draft',
            appointmentId: record.appointmentId,
            encounterId: record.encounterId,
            href: params.canReadMedicalRecords.value ? recordRegistryHref(record) : null,
            actionLabel: params.canReadMedicalRecords.value ? 'Open note' : null,
            accentClass: 'border-l-emerald-500/70',
            icon: 'file-text',
        }));

        const laboratoryEvents = params.laboratoryOrders.value.map<ChartTimelineEvent>((order) => ({
            id: `lab-${order.id}`,
            category: 'laboratory',
            occurredAt: order.resultedAt || order.orderedAt,
            title: order.testName || 'Laboratory order',
            subtitle: (order.status ?? '').toLowerCase() === 'completed' ? 'Laboratory result' : 'Laboratory order',
            summary:
                truncatePlainText(order.resultSummary, 180) ||
                (order.priority ? `Priority: ${formatEnumLabel(order.priority)}` : 'Awaiting laboratory processing.'),
            status: order.status || 'ordered',
            appointmentId: order.appointmentId,
            encounterId: order.encounterId,
            href: params.canReadLaboratoryOrders.value
                ? currentCareNextActionHref('laboratory', order, params.patientId.value, primaryVisit.value?.id ?? null)
                : null,
            actionLabel: params.canReadLaboratoryOrders.value ? serviceTimelineActionLabel('laboratory', order) : null,
            accentClass: 'border-l-violet-500/70',
            icon: 'flask-conical',
        }));

        const imagingEvents = params.radiologyOrders.value.map<ChartTimelineEvent>((order) => ({
            id: `imaging-${order.id}`,
            category: 'imaging',
            occurredAt: order.completedAt || order.orderedAt,
            title: order.studyDescription || 'Imaging order',
            subtitle: (order.status ?? '').toLowerCase() === 'completed' ? 'Imaging report' : 'Imaging order',
            summary:
                truncatePlainText(order.reportSummary, 180) ||
                (order.modality ? `Modality: ${formatEnumLabel(order.modality)}` : 'Awaiting imaging workflow update.'),
            status: order.status || 'ordered',
            appointmentId: order.appointmentId,
            encounterId: order.encounterId,
            href: params.canReadRadiologyOrders.value
                ? currentCareNextActionHref('radiology', order, params.patientId.value, primaryVisit.value?.id ?? null)
                : null,
            actionLabel: params.canReadRadiologyOrders.value ? serviceTimelineActionLabel('radiology', order) : null,
            accentClass: 'border-l-amber-500/70',
            icon: 'activity',
        }));

        const pharmacyEvents = params.pharmacyOrders.value.map<ChartTimelineEvent>((order) => ({
            id: `pharmacy-${order.id}`,
            category: 'pharmacy',
            occurredAt: order.dispensedAt || order.orderedAt,
            title: order.medicationName || 'Pharmacy order',
            subtitle: (order.status ?? '').toLowerCase() === 'dispensed' ? 'Medication dispensed' : 'Medication order',
            summary: truncatePlainText(order.dosageInstruction, 180) || 'Medication instructions not recorded.',
            status: order.status || 'pending',
            appointmentId: order.appointmentId,
            encounterId: order.encounterId,
            href: params.canReadPharmacyOrders.value
                ? currentCareNextActionHref('pharmacy', order, params.patientId.value, primaryVisit.value?.id ?? null)
                : null,
            actionLabel: params.canReadPharmacyOrders.value ? serviceTimelineActionLabel('pharmacy', order) : null,
            accentClass: 'border-l-fuchsia-500/70',
            icon: 'pill',
        }));

        const theatreEvents = params.theatreProcedures.value.map<ChartTimelineEvent>((procedure) => ({
            id: `procedure-${procedure.id}`,
            category: 'procedure',
            occurredAt: procedure.completedAt || procedure.scheduledAt,
            title: procedure.procedureName || procedure.procedureType || 'Theatre procedure',
            subtitle: (procedure.status ?? '').toLowerCase() === 'completed' ? 'Procedure completed' : 'Procedure scheduled',
            summary:
                truncatePlainText(procedure.notes, 180) ||
                truncatePlainText(procedure.statusReason, 180) ||
                (procedure.theatreRoomName ? `Room: ${procedure.theatreRoomName}` : 'Awaiting theatre progression.'),
            status: procedure.status || 'planned',
            appointmentId: procedure.appointmentId,
            encounterId: procedure.encounterId,
            href: params.canReadTheatreProcedures.value
                ? currentCareNextActionHref('theatre', procedure, params.patientId.value, primaryVisit.value?.id ?? null)
                : null,
            actionLabel: params.canReadTheatreProcedures.value ? serviceTimelineActionLabel('theatre', procedure) : null,
            accentClass: 'border-l-cyan-500/70',
            icon: 'scissors',
        }));

        const billingEvents = params.billingInvoices.value.map<ChartTimelineEvent>((invoice) => ({
            id: `billing-${invoice.id}`,
            category: 'billing',
            occurredAt: invoice.invoiceDate,
            title: invoice.invoiceNumber || 'Billing invoice',
            subtitle: 'Billing',
            summary: `Balance ${formatMoney(invoice.balanceAmount, invoice.currencyCode)}`,
            status: invoice.status || 'draft',
            appointmentId: invoice.appointmentId,
            encounterId: invoice.encounterId,
            href: params.canReadBillingInvoices.value
                ? patientChartModuleHref('/billing', params.patientId.value, primaryVisit.value?.id ?? null, {
                      includeAppointment: false,
                      focusInvoiceId: invoice.id,
                  })
                : null,
            actionLabel: params.canReadBillingInvoices.value ? 'Open invoice' : null,
            accentClass: 'border-l-rose-500/70',
            icon: 'receipt',
        }));

        return [
            ...appointmentEvents,
            ...recordEvents,
            ...laboratoryEvents,
            ...imagingEvents,
            ...pharmacyEvents,
            ...theatreEvents,
            ...billingEvents,
        ].sort((left, right) => {
            const leftTime = left.occurredAt ? new Date(left.occurredAt).getTime() : 0;
            const rightTime = right.occurredAt ? new Date(right.occurredAt).getTime() : 0;
            return rightTime - leftTime;
        });
    });

    const timelinePreview = computed(() => timelineEvents.value.slice(0, 4));

    const timelineSections = computed(() => {
        const sections = new Map<string, { label: string; events: ChartTimelineEvent[] }>();

        timelineEvents.value.forEach((event) => {
            const key = timelineSectionKey(event.occurredAt);
            const label = timelineSectionLabel(event.occurredAt);
            const existing = sections.get(key);

            if (existing) {
                existing.events.push(event);
                return;
            }

            sections.set(key, { label, events: [event] });
        });

        return Array.from(sections.entries()).map(([key, value]) => ({ key, label: value.label, events: value.events }));
    });

    const latestClinicalSignal = computed(
        () => timelineEvents.value.find((event) => ['consultation', 'laboratory', 'imaging'].includes(event.category)) ?? null,
    );

    const handoffSummary = computed(() => {
        if (!primaryVisit.value) {
            return {
                title: 'No active encounter',
                summary: 'This patient has no active outpatient visit in chart context right now.',
                meta: 'Use schedule appointment when the next visit is being arranged.',
            };
        }

        switch (primaryVisit.value.status) {
            case 'waiting_triage':
                return {
                    title: 'Nurse triage pending',
                    summary:
                        primaryVisit.value.triageVitalsSummary ||
                        'The patient is checked in and waiting for nurse triage to be completed.',
                    meta: `${primaryVisit.value.department || 'Department pending'} | Scheduled ${formatDateTime(primaryVisit.value.scheduledAt)}`,
                };
            case 'waiting_provider':
                return {
                    title: 'Ready for clinician review',
                    summary:
                        primaryVisit.value.triageVitalsSummary ||
                        primaryVisit.value.reason ||
                        'Triage is complete and the patient is ready for provider handoff.',
                    meta: `${primaryVisit.value.department || 'Department pending'} | ${formatEnumLabel(primaryVisit.value.status || 'waiting_provider')}`,
                };
            case 'in_consultation':
                return {
                    title: 'Consultation in progress',
                    summary: primaryVisit.value.reason || 'An active consultation session is already underway for this visit.',
                    meta: `${primaryVisit.value.department || 'Department pending'} | Resume the focused visit workspace from this chart.`,
                };
            default:
                return {
                    title: 'Visit scheduled',
                    summary: primaryVisit.value.reason || 'The next booked visit is visible in this patient chart.',
                    meta: `${primaryVisit.value.department || 'Department pending'} | Scheduled ${formatDateTime(primaryVisit.value.scheduledAt)}`,
                };
        }
    });

    const nextDocumentedStep = computed(() => {
        if (latestRecord.value) return recordNextStep(latestRecord.value);
        if (primaryVisit.value?.status === 'waiting_triage') return 'Record nurse triage and hand the patient to the provider queue.';
        if (primaryVisit.value?.status === 'waiting_provider') return 'Start consultation from the provider queue when the clinician is ready.';
        if (primaryVisit.value?.status === 'in_consultation') return 'Continue documentation, place orders if needed, then complete the visit.';
        if (primaryVisit.value) return 'Open the visit workspace to continue the patient flow for this appointment.';
        return 'Schedule or launch the next encounter when this patient re-enters care.';
    });

    const focusedEncounterEvents = computed(() => {
        if (!primaryVisit.value?.id) return [];

        return timelineEvents.value.filter((event) => {
            if (event.category === 'visit') {
                return event.appointmentId === primaryVisit.value?.id;
            }

            return params.focusedEncounterId.value !== null && event.encounterId === params.focusedEncounterId.value;
        });
    });

    const focusedEncounterCounts = computed(() => ({
        total: focusedEncounterEvents.value.length,
        notes: focusedEncounterEvents.value.filter((event) => event.category === 'consultation').length,
        orders: focusedEncounterEvents.value.filter((event) => ['laboratory', 'imaging', 'pharmacy'].includes(event.category)).length,
        billing: focusedEncounterEvents.value.filter((event) => event.category === 'billing').length,
    }));

    const focusedEncounterLatestEvent = computed(() => focusedEncounterEvents.value[0] ?? null);

    const chartCounts = computed(() => ({
        visits: params.appointments.value.length,
        activeVisits: params.appointments.value.filter((appointment) => activeVisitStatuses.includes(appointment.status || '')).length,
        records: params.recordsTotal.value,
        timelineEvents: timelineEvents.value.length,
    }));

    return {
        primaryVisit,
        visitFocusOptions,
        latestRecord,
        hasOpenVisitInChart,
        visitPrimaryActionHref,
        visitPrimaryActionLabel,
        visitPrimaryActionIcon,
        careCounts,
        chartCounts,
        timelineEvents,
        timelinePreview,
        timelineSections,
        latestClinicalSignal,
        handoffSummary,
        nextDocumentedStep,
        focusedEncounterEvents,
        focusedEncounterCounts,
        focusedEncounterLatestEvent,
        recordProblem,
        recordNextStep,
        recordRegistryHref,
        appointmentDetailsHref,
    };
}
