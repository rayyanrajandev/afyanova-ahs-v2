import type { DashboardQueueRow } from '@/lib/dashboardOperationsQueue';
import type { WorkflowSurface, WorkflowSurfaceBuilder } from '@/workflows/surfaceTypes';

export const buildClinicianSurface: WorkflowSurfaceBuilder = ({ counts, lists, helpers, runtime, hasWidget }) => {

    const kpis = (() => {
const departmentPoolMetric = runtime.clinicianClinicalDepartment
            ? helpers.metric(
                'Department pool',
                `Patients waiting for any provider in ${runtime.clinicianClinicalDepartment}.`,
                'users',
                helpers.numberValue(counts.departmentPoolAppointments, 'waiting_provider'),
            )
            : helpers.metric('Pending lab orders', 'Laboratory orders still active downstream.', 'flask-conical', helpers.numberValue(counts.laboratory, ['ordered', 'collected', 'in_progress']));

        return [
            helpers.metric('Ready for provider', 'Assigned encounters ready for consultation pickup.', 'calendar-clock', helpers.numberValue(counts.appointments, 'waiting_provider')),
            departmentPoolMetric,
            helpers.metric('Draft records', 'Documentation still open or unfinished.', 'clipboard-list', helpers.numberValue(counts.medicalRecords, 'draft')),
            helpers.metric('Admitted follow-ups', 'Patients still admitted and likely needing review.', 'bed-double', helpers.numberValue(counts.admissions, 'admitted')),
        ];
    })();

    const actions = (() => {
const departmentPoolWaiting = Number(helpers.numberValue(counts.departmentPoolAppointments, 'waiting_provider') ?? 0);
        const departmentAction = runtime.clinicianClinicalDepartment
            ? {
                label: 'Open department pool',
                icon: 'users',
                variant: (departmentPoolWaiting > 0 ? 'default' : 'outline'),
                href: runtime.departmentQueueHref(runtime.clinicianClinicalDepartment, 'waiting_provider'),
            }
            : null;

        return [
            departmentAction ?? { label: 'Open clinician queue', icon: 'calendar-clock', variant: 'default', href: runtime.clinicianQueueHref('waiting_provider') },
            departmentAction
                ? { label: 'Open my queue', icon: 'calendar-clock', variant: 'outline', href: runtime.clinicianQueueHref('waiting_provider') }
                : { label: 'Open medical records', icon: 'clipboard-list', variant: 'outline', href: '/medical-records' },
            departmentAction
                ? { label: 'Open medical records', icon: 'clipboard-list', variant: 'outline', href: '/medical-records' }
                : { label: 'Admissions', icon: 'bed-double', variant: 'outline', href: '/admissions?view=queue' },
        ];
    })();

    const queueRows: DashboardQueueRow[] = (() => {
const departmentLabel = runtime.clinicianClinicalDepartment;
        const waitingProviderRows = (lists.waitingProviderAppointments ?? []).map((item: any) => {
            const triageCategory = runtime.appointmentTriageCategory(item);

            return {
            id: `waiting-provider-${String(item.id ?? item.appointmentNumber ?? Math.random())}`,
            title: runtime.dashboardPatientLabel(item.patientId)
                ? `${runtime.dashboardPatientLabel(item.patientId)} · ${String(item.appointmentNumber ?? 'Provider-ready')}`
                : String(item.appointmentNumber ?? 'Provider-ready appointment'),
            subtitle: [item.department, item.reason].filter(Boolean).join(' | ') || 'Encounter is ready for consultation pickup.',
            meta: triageCategory
                ? `Checked in ${runtime.formatDateTime(item.checkedInAt ?? item.scheduledAt)} · ${triageCategory}`
                : `Checked in ${runtime.formatDateTime(item.checkedInAt ?? item.scheduledAt)}`,
            status: runtime.formatEnumLabel(String(item.status ?? 'waiting_provider')),
            href: runtime.clinicianQueueHref('waiting_provider', String(item.id ?? '')),
            actionLabel: 'Open consultation',
            group: 'My queue — waiting for provider',
            searchHaystack: runtime.appointmentQueueSearchHaystack(item),
            triageCategory,
        };
        });
        const inConsultationRows = (lists.inConsultationAppointments ?? []).map((item: any) => {
            const triageCategory = runtime.appointmentTriageCategory(item);

            return {
            id: `in-consultation-${String(item.id ?? item.appointmentNumber ?? Math.random())}`,
            title: runtime.dashboardPatientLabel(item.patientId)
                ? `${runtime.dashboardPatientLabel(item.patientId)} · ${String(item.appointmentNumber ?? 'In consultation')}`
                : String(item.appointmentNumber ?? 'Active consultation'),
            subtitle: [item.department, item.reason].filter(Boolean).join(' | ') || 'Consultation is already in progress for your assigned patient.',
            meta: triageCategory
                ? `Updated ${runtime.formatDateTime(item.updatedAt ?? item.checkedInAt ?? item.scheduledAt)} · ${triageCategory}`
                : `Updated ${runtime.formatDateTime(item.updatedAt ?? item.checkedInAt ?? item.scheduledAt)}`,
            status: runtime.formatEnumLabel(String(item.status ?? 'in_consultation')),
            href: runtime.activeConsultationWorkspaceHref(String(item.id ?? '')),
            actionLabel: 'Resume consultation',
            group: 'My queue — in consultation',
            searchHaystack: runtime.appointmentQueueSearchHaystack(item),
            triageCategory,
        };
        });
        const departmentPoolRows = departmentLabel
            ? (lists.departmentPoolWaitingAppointments ?? []).map((item: any) => {
                const triageCategory = runtime.appointmentTriageCategory(item);

                return {
                id: `department-pool-${String(item.id ?? item.appointmentNumber ?? Math.random())}`,
                title: runtime.dashboardPatientLabel(item.patientId)
                    ? `${runtime.dashboardPatientLabel(item.patientId)} · ${String(item.appointmentNumber ?? 'Department pool')}`
                    : String(item.appointmentNumber ?? 'Department pool visit'),
                subtitle: [item.department, item.reason].filter(Boolean).join(' | ') || `Waiting in the ${departmentLabel} provider pool.`,
                meta: triageCategory
                    ? `Checked in ${runtime.formatDateTime(item.checkedInAt ?? item.scheduledAt)} · ${triageCategory}`
                    : `Checked in ${runtime.formatDateTime(item.checkedInAt ?? item.scheduledAt)}`,
                status: runtime.formatEnumLabel(String(item.status ?? 'waiting_provider')),
                href: runtime.departmentQueueHref(departmentLabel, 'waiting_provider', String(item.id ?? '')),
                actionLabel: 'Pick up consultation',
                group: `Department pool — ${departmentLabel}`,
                searchHaystack: runtime.appointmentQueueSearchHaystack(item),
                triageCategory,
            };
            })
            : [];

        return [...waitingProviderRows, ...departmentPoolRows, ...inConsultationRows];
    })();

    const handoff = (() => {
const waitingProvider = helpers.numberValue(counts.appointments, 'waiting_provider');
        const departmentPoolWaiting = helpers.numberValue(counts.departmentPoolAppointments, 'waiting_provider');
        const inConsultation = helpers.numberValue(counts.appointments, 'in_consultation');
        const draftRecords = helpers.numberValue(counts.medicalRecords, 'draft');
        const admittedFollowUps = helpers.numberValue(counts.admissions, 'admitted');
        const hasDraftBlocker = Number(draftRecords ?? 0) > 0;
        const hasWaitingProviderBlocker = Number(waitingProvider ?? 0) > 0;
        const hasDepartmentPoolBlocker = Number(departmentPoolWaiting ?? 0) > 0;

        return {
            title: 'Clinician handoff',
            note: runtime.clinicianClinicalDepartment
                ? `OPD flow for ${runtime.clinicianClinicalDepartment} and assigned patients`
                : 'OPD and inpatient clinical flow',
            blockerTitle: hasDraftBlocker
                ? 'Draft records still open'
                : hasWaitingProviderBlocker
                    ? 'Assigned consultations waiting'
                    : hasDepartmentPoolBlocker
                        ? 'Department pool patients waiting'
                        : Number(admittedFollowUps ?? 0) > 0
                            ? 'Active inpatient follow-up load'
                            : 'No critical clinician blockers',
            blockerNote: hasDraftBlocker
                ? 'Clinical documentation still needs completion or finalization.'
                : hasWaitingProviderBlocker
                    ? 'Assigned patients are waiting in the provider queue for consultation to begin.'
                    : hasDepartmentPoolBlocker
                        ? `Patients are waiting in the ${runtime.clinicianClinicalDepartment} clinic pool for the next available provider.`
                        : Number(admittedFollowUps ?? 0) > 0
                            ? 'Current inpatients may still need progress review or discharge decisions.'
                            : 'Consultation queue and note backlog are stable for the next clinical shift.',
            nextAction: hasWaitingProviderBlocker
                ? 'Start the next assigned consultation without leaving the current preset.'
                : hasDepartmentPoolBlocker
                    ? 'Pick up the next patient from your department pool.'
                    : hasDraftBlocker
                        ? 'Review incomplete notes before new backlog accumulates.'
                        : 'Review active inpatients for continuation planning.',
            primaryAction: {
                label: hasWaitingProviderBlocker
                    ? 'Open my queue'
                    : hasDepartmentPoolBlocker && runtime.clinicianClinicalDepartment
                        ? 'Open department pool'
                        : 'Open medical records',
                href: hasWaitingProviderBlocker
                    ? runtime.clinicianQueueHref('waiting_provider')
                    : hasDepartmentPoolBlocker && runtime.clinicianClinicalDepartment
                        ? runtime.departmentQueueHref(runtime.clinicianClinicalDepartment, 'waiting_provider')
                        : '/medical-records',
            },
            secondaryAction: { label: 'Open admissions', href: '/admissions?view=queue' },
            chips: [
                { label: 'Waiting for provider', value: waitingProvider },
                ...(runtime.clinicianClinicalDepartment
                    ? [{ label: 'Department pool', value: departmentPoolWaiting }]
                    : []),
                { label: 'In consultation', value: inConsultation },
                { label: 'Draft notes', value: draftRecords },
            ],
        };
    })();

    const watchItems = (() => {
return [
            {
                label: 'Pending laboratory decisions',
                note: 'Outstanding lab work may still be blocking treatment plans.',
                value: helpers.numberValue(counts.laboratory, ['ordered', 'collected', 'in_progress']),
                href: '/laboratory-orders',
                actionLabel: 'Open laboratory',
                icon: 'flask-conical',
            },
            {
                label: 'Draft records still open',
                note: 'Clinical documentation still needs completion or finalization.',
                value: helpers.numberValue(counts.medicalRecords, 'draft'),
                href: '/medical-records',
                actionLabel: 'Open medical records',
                icon: 'clipboard-list',
            },
            {
                label: 'Active inpatient follow-up load',
                note: 'Current inpatients may still need progress review or discharge decisions.',
                value: helpers.numberValue(counts.admissions, 'admitted'),
                href: '/admissions?view=queue',
                actionLabel: 'Open admissions',
                icon: 'bed-double',
            },
        ];
    })();

    const queueTitle = runtime.clinicianClinicalDepartment ? 'Clinical queues' : 'Consultation-ready queue';
    const queueDescription = runtime.clinicianClinicalDepartment
        ? `Your assigned patients plus the shared ${runtime.clinicianClinicalDepartment} department pool when visits are routed to the clinic.`
        : 'Patients assigned to you who are waiting for provider review, with active consultations shown below.';
    const searchPlaceholder = 'Patient name, MRN, phone, or appointment #';

    return {
        kpis,
        actions,
        queueRows,
        handoff,
        watchItems,
        queueTitle,
        queueDescription,
        searchPlaceholder,
    };
};
