import type { DashboardQueueRow } from '@/lib/dashboardOperationsQueue';
import type { WorkflowSurface, WorkflowSurfaceBuilder } from '@/workflows/surfaceTypes';

export const buildNursingSurface: WorkflowSurfaceBuilder = ({ counts, lists, helpers, runtime, hasWidget }) => {

    const kpis = (() => {
return [
            helpers.metric('Waiting for triage', 'Checked-in patients pending nurse assessment.', 'users', helpers.numberValue(counts.appointments, 'checked_in')),
            helpers.metric('Admitted now', 'Current admitted census in scope.', 'bed-double', helpers.numberValue(counts.admissions, 'admitted')),
            helpers.metric('Vitals overdue', 'Admitted patients with no vitals recorded in the last 4 hours.', 'activity', runtime.vitalsOverdueCount),
            helpers.metric('Escalated ward tasks', 'Ward follow-up items marked escalated.', 'alert-triangle', helpers.numberValue(counts.wardTasks, 'escalated')),
        ];
    })();

    const actions = (() => {
return [
            { label: 'Triage queue', icon: 'users', variant: 'default', href: runtime.triageQueueHref() },
            { label: 'Admission queue', icon: 'layout-list', variant: 'outline', href: '/admissions?view=queue' },
            { label: 'Inpatient ward', icon: 'bed-double', variant: 'outline', href: '/inpatient-ward' },
        ];
    })();

    const queueRows: DashboardQueueRow[] = (() => {
const sortByArrival = (a: any, b: any) => {
            const ta = a.checkedInAt ?? a.scheduledAt;
            const tb = b.checkedInAt ?? b.scheduledAt;
            if (!ta && !tb) return 0;
            if (!ta) return 1;
            if (!tb) return -1;
            return new Date(ta).getTime() - new Date(tb).getTime();
        };
        const triageItems = [...(lists.checkedInAppointments ?? [])]
            .sort(sortByArrival)
            .slice(0, 3)
            .map((item: any) => {
            const triageCategory = runtime.appointmentTriageCategory(item);

            return {
            id: `triage-${String(item.id ?? item.appointmentNumber ?? Math.random())}`,
            title: String(item.appointmentNumber ?? 'Triage patient'),
            subtitle: [item.department, item.reason].filter(Boolean).join(' | ') || 'Checked-in and waiting for nurse assessment.',
            meta: triageCategory
                ? `Checked in ${runtime.formatDateTime(item.checkedInAt ?? item.scheduledAt)} · ${triageCategory}`
                : `Checked in ${runtime.formatDateTime(item.checkedInAt ?? item.scheduledAt)}`,
            status: runtime.formatEnumLabel(String(item.status ?? 'checked_in')),
            href: runtime.triageQueueHref(String(item.id ?? '')),
            actionLabel: 'Open triage queue',
            isOverdue: false,
            group: 'Triage',
            searchHaystack: runtime.appointmentQueueSearchHaystack(item),
            triageCategory,
        };
        });
        const admissionItems = (lists.admissions ?? []).slice(0, 2).map((item: any) => ({
            id: String(item.id ?? item.admissionNumber ?? Math.random()),
            title: String(item.admissionNumber ?? 'Active admission'),
            subtitle: [item.ward, item.bed, item.admissionReason].filter(Boolean).join(' | ') || 'Admission needs ward or bed-flow review.',
            meta: `Admitted ${runtime.formatDateTime(item.admittedAt)}`,
            status: runtime.formatEnumLabel(String(item.status ?? 'admitted')),
            href: '/admissions?view=queue',
            actionLabel: 'Open admissions',
            isOverdue: false,
            group: 'Admissions',
        }));
        return [...triageItems, ...admissionItems];
    })();

    const handoff = (() => {
const escalatedTasks = helpers.numberValue(counts.wardTasks, 'escalated');
        const blockedDischarge = helpers.numberValue(counts.wardDischargeChecklists, ['blocked', 'pending']);
        const pendingLab = helpers.numberValue(counts.laboratory, ['ordered', 'collected', 'in_progress']);
        const pendingPharmacy = helpers.numberValue(counts.pharmacy, ['pending', 'in_preparation', 'partially_dispensed']);
        const waitingTriage = helpers.numberValue(counts.appointments, 'checked_in');
        const hasEscalated = Number(escalatedTasks ?? 0) > 0;
        const hasWaitingTriage = Number(waitingTriage ?? 0) > 0;

        return {
            title: 'Nursing handoff',
            note: 'Triage and ward operations',
            blockerTitle: hasWaitingTriage
                ? 'Patients waiting for triage assessment'
                : hasEscalated
                    ? 'Immediate bedside follow-up still needs acknowledgement.'
                    : Number(blockedDischarge ?? 0) > 0
                        ? 'Blocked discharge checklists'
                        : Number(pendingLab ?? 0) > 0
                            ? 'Pending lab follow-up'
                            : 'No critical nursing blockers',
            blockerNote: hasWaitingTriage
                ? 'Check-in queue has patients waiting for initial nursing assessment.'
                : hasEscalated
                ? 'Review task escalation or discharge blockers before closing handoff.'
                : Number(blockedDischarge ?? 0) > 0
                    ? 'Bed occupancy and discharge readiness need another pass.'
                    : Number(pendingLab ?? 0) > 0
                        ? 'Check which laboratory work is still blocking bedside care.'
                        : 'Bed occupancy and discharge readiness look stable for the next shift.',
            nextAction: hasWaitingTriage
                ? 'Start from the triage queue to clear patients waiting for assessment.'
                : Number(blockedDischarge ?? 0) > 0
                ? 'Review current occupancy and placement before the next handoff.'
                : 'Start from the live admissions view, then step into ward follow-up.',
            primaryAction: hasWaitingTriage
                ? { label: 'Open triage queue', href: runtime.triageQueueHref() }
                : { label: 'Open bed board', href: '/admissions?view=board' },
            secondaryAction: { label: 'Open inpatient ward', href: '/inpatient-ward' },
            chips: [
                { label: 'Waiting triage', value: waitingTriage },
                { label: 'Admitted now', value: helpers.numberValue(counts.admissions, 'admitted') },
                { label: 'Escalated tasks', value: escalatedTasks },
            ],
        };
    })();

    const watchItems = (() => {
return [
            {
                label: 'Triage queue',
                note: 'Checked-in patients waiting for nurse assessment.',
                value: helpers.numberValue(counts.appointments, 'checked_in'),
                href: runtime.triageQueueHref(),
                actionLabel: 'Open triage',
                icon: 'users',
            },
            {
                label: 'Vitals overdue',
                note: 'Admitted patients with no vitals recorded in the last 4 hours. Record vitals to clear.',
                value: runtime.vitalsOverdueCount,
                href: '/inpatient-ward',
                actionLabel: 'Open inpatient ward',
                icon: 'activity',
            },
            {
                label: 'Blocked discharge checklists',
                note: 'Patients blocked from discharge — bed occupancy is held until resolved.',
                value: helpers.numberValue(counts.wardDischargeChecklists, ['blocked', 'pending']),
                href: '/inpatient-ward',
                actionLabel: 'Open inpatient ward',
                icon: 'circle-x',
            },
            {
                label: 'Pending medication dispense',
                note: 'Medication requests are still queued for the ward.',
                value: helpers.numberValue(counts.pharmacy, ['pending', 'in_preparation', 'partially_dispensed']),
                href: '/pharmacy-orders',
                actionLabel: 'Open pharmacy',
                icon: 'pill',
            },
            {
                label: 'Pending care plans',
                note: 'Care plans not yet finalised or awaiting nurse sign-off.',
                value: helpers.numberValue(counts.wardCarePlans, ['draft', 'pending']),
                href: '/inpatient-ward',
                actionLabel: 'Open inpatient ward',
                icon: 'clipboard-list',
            },
        ];
    })();

    const queueTitle = (() => { return 'Triage & admissions queue'; })();
    const queueDescription = (() => { return 'Checked-in patients waiting for triage and active inpatient admissions.'; })();
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
