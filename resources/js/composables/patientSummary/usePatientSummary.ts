import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * Phase B of reports/patient-summary-module-plan.md. Backed by the single
 * aggregated GET /patients/{id}/summary endpoint (Phase A) — one request,
 * one loading state, deliberately not a client-side fan-out of several
 * queries (see the plan's §3 for why: the module's primary reuse targets
 * are queue/list pages).
 */
export type PatientSummaryIdentity = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    phone: string | null;
    status: string | null;
    region: string | null;
    district: string | null;
};

export type PatientSummaryContact = {
    email: string | null;
    addressLine: string | null;
    nextOfKinName: string | null;
    nextOfKinPhone: string | null;
};

export type PatientSummaryUpcomingAppointment = {
    id: string;
    appointmentNumber: string | null;
    department: string | null;
    scheduledAt: string | null;
    reason: string | null;
};

export type PatientSummaryAdmission = {
    id: string;
    admissionNumber: string | null;
    ward: string | null;
    bed: string | null;
    admittedAt: string | null;
};

export type PatientSummaryStats = {
    totalVisits: number;
    totalEncounters: number;
    outstandingInvoices: number;
};

export type PatientSummaryActivityEntry = {
    type: string | null;
    label: string | null;
    occurredAt: string | null;
};

export type PatientSummaryAlert = {
    id: string;
    substanceName: string | null;
    reaction: string | null;
    severity: string | null;
    status: string | null;
};

export type PatientSummaryInsurance = {
    id: string;
    insuranceType: string | null;
    insuranceProvider: string | null;
    planName: string | null;
    memberId: string | null;
    status: string | null;
    verificationStatus: string | null;
};

export type PatientSummaryEncounter = {
    id: string;
    encounterNumber: string | null;
    status: string | null;
    statusReason: string | null;
    openedAt: string | null;
    closedAt: string | null;
};

export type PatientSummaryWorkflowStatus = {
    step: string;
    department: string | null;
    appointmentId: string | null;
    serviceRequestId: string | null;
};

export type PatientSummaryActiveOrders = {
    labActive: number;
    pharmacyActive: number;
    imagingActive: number;
    procedureActive: number;
};

/**
 * Same "active" definition as the backend's own same-day appointment
 * conflict guard (CreateAppointmentUseCase::assertNoActiveSameDayConflict())
 * — not a separate rule. Lets a consumer (PatientVisitActionsMenu.vue)
 * proactively disable OPD/emergency check-in instead of letting a doomed
 * click round-trip to the server for an error it could have known about
 * in advance.
 */
export type PatientSummaryActiveAppointmentToday = {
    id: string;
    appointmentNumber: string | null;
    status: string | null;
    scheduledAt: string | null;
    department: string | null;
};

export type PatientSummaryDetails = {
    patient: PatientSummaryIdentity;
    contact: PatientSummaryContact;
    alerts: PatientSummaryAlert[];
    insurance: PatientSummaryInsurance | null;
    latestEncounter: PatientSummaryEncounter | null;
    workflowStatus: PatientSummaryWorkflowStatus | null;
    activeOrders: PatientSummaryActiveOrders;
    upcomingAppointment: PatientSummaryUpcomingAppointment | null;
    currentAdmission: PatientSummaryAdmission | null;
    stats: PatientSummaryStats;
    recentActivity: PatientSummaryActivityEntry[];
    activeAppointmentToday: PatientSummaryActiveAppointmentToday | null;
};

type PatientSummaryResponse = { data: PatientSummaryDetails };

/**
 * `enabled` lets a consumer (e.g. a popover) defer fetching until the
 * summary is actually opened — nothing fetches just because a trigger
 * exists on the page, which is what keeps this cheap to drop into a dense
 * queue/list view.
 */
export function usePatientSummary(
    patientId: MaybeRefOrGetter<string | null | undefined>,
    options?: { enabled?: MaybeRefOrGetter<boolean> },
): UseQueryReturnType<PatientSummaryDetails, Error> {
    return useQuery({
        queryKey: ['patient-summary', computed(() => toValue(patientId))],
        queryFn: async () => {
            const id = toValue(patientId);
            const response = await apiGet<PatientSummaryResponse>(`/patients/${id}/summary`);
            return response.data;
        },
        enabled: computed(() => Boolean(toValue(patientId)) && (options?.enabled === undefined || Boolean(toValue(options.enabled)))),
    });
}
