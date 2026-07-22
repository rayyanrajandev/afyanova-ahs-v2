import type { PatientChartAppointment } from '@/composables/patientChart/usePatientAppointments';

export const activeVisitStatuses = ['waiting_triage', 'waiting_provider', 'in_consultation'];

export type AppointmentWorkspaceAction = 'details' | 'triage' | 'consultation';

/**
 * Resolves the chart's "focused visit" the same way the old Show.vue's
 * primaryVisit computed did: an explicit focus wins, otherwise prefer an
 * active visit, then a scheduled one, then the most recent of any status.
 */
export function resolvePrimaryVisit(
    appointments: PatientChartAppointment[],
    focusedAppointmentId: string,
    closedVisits?: Record<string, true | undefined>,
): PatientChartAppointment | null {
    if (focusedAppointmentId) {
        return appointments.find((appointment) => appointment.id === focusedAppointmentId) ?? null;
    }

    return (
        appointments.find((appointment) => activeVisitStatuses.includes(appointment.status || '') && !closedVisits?.[appointment.id]) ??
        appointments.find((appointment) => appointment.status === 'scheduled') ??
        appointments[0] ??
        null
    );
}

const focusableStatuses = ['scheduled', 'waiting_triage', 'waiting_provider', 'in_consultation', 'completed'];

export function appointmentWorkspaceHref(
    appointment: PatientChartAppointment,
    action: AppointmentWorkspaceAction = 'details',
): string {
    const params = new URLSearchParams({ focusAppointmentId: appointment.id, from: 'patient-chart' });
    const normalizedStatus = String(appointment.status ?? '').trim();
    if (focusableStatuses.includes(normalizedStatus)) {
        params.set('status', normalizedStatus);
    }
    if (action === 'triage') {
        params.set('view', 'triage');
        params.set('focusAction', 'triage');
        params.set('detailsTab', 'workflow');
    } else if (action === 'consultation') {
        params.set('view', 'clinical');
        params.set('focusAction', 'consultation');
        params.set('detailsTab', 'workflow');
    }
    return `/appointments?${params.toString()}`;
}

export function appointmentDetailsHref(appointment: PatientChartAppointment): string {
    return appointmentWorkspaceHref(appointment);
}

export function appointmentWorkflowAction(
    appointment: PatientChartAppointment | null,
    canRecordOpdTriage: boolean,
    canStartConsultation: boolean,
    closedVisits?: Record<string, true | undefined>,
): AppointmentWorkspaceAction {
    if (!appointment) return 'details';
    if (closedVisits?.[appointment.id]) return 'details';
    if (appointment.status === 'waiting_triage' && canRecordOpdTriage) return 'triage';
    if ((appointment.status === 'waiting_provider' || appointment.status === 'in_consultation') && canStartConsultation) return 'consultation';
    return 'details';
}

export function appointmentWorkflowHref(
    appointment: PatientChartAppointment,
    canRecordOpdTriage: boolean,
    canStartConsultation: boolean,
    closedVisits?: Record<string, true | undefined>,
): string {
    return appointmentWorkspaceHref(appointment, appointmentWorkflowAction(appointment, canRecordOpdTriage, canStartConsultation, closedVisits));
}

export function shouldShowAppointmentCareAction(
    appointment: PatientChartAppointment | null,
    closedVisits?: Record<string, true | undefined>,
): boolean {
    if (!appointment) return false;
    if (closedVisits?.[appointment.id]) return false;
    return activeVisitStatuses.includes(appointment.status || '');
}

export function appointmentActionLabel(
    appointment: PatientChartAppointment | null,
    canRecordOpdTriage: boolean,
    canStartConsultation: boolean,
    closedVisits?: Record<string, true | undefined>,
): string {
    const action = appointmentWorkflowAction(appointment, canRecordOpdTriage, canStartConsultation, closedVisits);
    if (action === 'triage') return 'Open triage';
    if (action === 'consultation') {
        return appointment?.status === 'in_consultation' ? 'Resume consultation' : 'Start consultation';
    }
    return appointment?.status === 'scheduled' ? 'Open scheduled visit' : 'Open visit';
}

export function appointmentPrimaryActionHref(
    appointment: PatientChartAppointment,
    canRecordOpdTriage: boolean,
    canStartConsultation: boolean,
    closedVisits?: Record<string, true | undefined>,
): string {
    return shouldShowAppointmentCareAction(appointment, closedVisits)
        ? appointmentWorkflowHref(appointment, canRecordOpdTriage, canStartConsultation, closedVisits)
        : appointmentDetailsHref(appointment);
}

export function appointmentPrimaryActionLabel(
    appointment: PatientChartAppointment,
    canRecordOpdTriage: boolean,
    canStartConsultation: boolean,
    closedVisits?: Record<string, true | undefined>,
): string {
    return shouldShowAppointmentCareAction(appointment, closedVisits)
        ? appointmentActionLabel(appointment, canRecordOpdTriage, canStartConsultation, closedVisits)
        : 'Open visit';
}

export function appointmentPrimaryActionIcon(
    appointment: PatientChartAppointment,
    canRecordOpdTriage: boolean,
    canStartConsultation: boolean,
    closedVisits?: Record<string, true | undefined>,
): string {
    if (closedVisits?.[appointment.id]) return 'calendar-clock';
    if (!shouldShowAppointmentCareAction(appointment, closedVisits)) return 'calendar-clock';
    const action = appointmentWorkflowAction(appointment, canRecordOpdTriage, canStartConsultation, closedVisits);
    if (action === 'triage') return 'heart-pulse';
    if (action === 'consultation') return 'stethoscope';
    return 'calendar-clock';
}
