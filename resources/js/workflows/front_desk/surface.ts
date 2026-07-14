import type { DashboardQueueRow } from '@/lib/dashboardOperationsQueue';
import type { WorkflowSurface, WorkflowSurfaceBuilder } from '@/workflows/surfaceTypes';

export const buildFrontDeskSurface: WorkflowSurfaceBuilder = ({ counts, lists, helpers, runtime, hasWidget }) => {

    const kpis = (() => {
return [
            helpers.metric('Active patients', 'Patients currently active in the shared queue scope.', 'users', helpers.numberValue(counts.patients, 'active')),
            helpers.metric('Scheduled appointments', 'Appointments still scheduled for arrival.', 'calendar', helpers.numberValue(counts.appointments, 'scheduled')),
            helpers.metric('Checked-in handoff', 'Patients ready for upstream handoff.', 'calendar-clock', helpers.numberValue(counts.appointments, 'checked_in')),
            helpers.metric('OPD walk-ins today', 'Unscheduled OPD arrivals registered through appointments.', 'log-in', helpers.numberValue(counts.appointments, 'walk_in')),
        ];
    })();

    const actions = (() => {
return [
            { label: 'Register Patient', icon: 'user', variant: 'default', href: '/patients' },
            { label: 'Appointment queue', icon: 'calendar-clock', variant: 'outline', href: '/reception/queue' },
            { label: 'Register OPD walk-in', icon: 'log-in', variant: 'outline', href: '/reception/queue' },
        ];
    })();

    const queueRows: DashboardQueueRow[] = (() => {
const now = Date.now();
        const sortByArrival = (a: any, b: any) => {
            const ta = a.checkedInAt ?? a.scheduledAt;
            const tb = b.checkedInAt ?? b.scheduledAt;
            if (!ta && !tb) return 0;
            if (!ta) return 1;
            if (!tb) return -1;
            return new Date(ta).getTime() - new Date(tb).getTime();
        };
        const checkedInRows = [...(lists.checkedInAppointments ?? [])]
            .sort(sortByArrival)
            .slice(0, 5)
            .map((item: any) => {
            const triageCategory = runtime.appointmentTriageCategory(item);

            return {
            id: `checkedin-${String(item.id ?? item.appointmentNumber ?? Math.random())}`,
            title: String(item.appointmentNumber ?? 'Checked-in patient'),
            subtitle: [item.department, item.reason].filter(Boolean).join(' | ') || 'Checked-in and waiting for clinical handoff.',
            meta: triageCategory
                ? `Checked in ${runtime.formatDateTime(item.checkedInAt ?? item.scheduledAt)} · ${triageCategory}`
                : `Checked in ${runtime.formatDateTime(item.checkedInAt ?? item.scheduledAt)}`,
            status: runtime.formatEnumLabel(String(item.status ?? 'checked_in')),
            href: '/reception/queue',
            actionLabel: 'Open checked-in queue',
            isOverdue: false,
            group: 'Checked-in',
            searchHaystack: runtime.appointmentQueueSearchHaystack(item),
            triageCategory,
        };
        });
        const scheduledRows = (lists.scheduledAppointments ?? []).slice(0, 8).map((item: any) => {
            const scheduledAt = item.scheduledAt ? new Date(item.scheduledAt).getTime() : null;
            const isOverdue = scheduledAt !== null && scheduledAt < now && String(item.status ?? '').toLowerCase() === 'scheduled';
            const triageCategory = runtime.appointmentTriageCategory(item);

            return {
                id: String(item.id ?? item.appointmentNumber ?? Math.random()),
                title: String(item.appointmentNumber ?? 'Scheduled appointment'),
                subtitle: [item.department, item.reason].filter(Boolean).join(' | ') || 'Arrival still needs front-desk handling.',
                meta: triageCategory
                    ? `Scheduled ${runtime.formatDateTime(item.scheduledAt)} · ${triageCategory}`
                    : `Scheduled ${runtime.formatDateTime(item.scheduledAt)}`,
                status: runtime.formatEnumLabel(String(item.status ?? 'scheduled')),
                href: '/reception/queue',
                actionLabel: 'Open queue',
                isOverdue,
                group: 'Scheduled',
                searchHaystack: runtime.appointmentQueueSearchHaystack(item),
                triageCategory,
            };
        });
        return [...checkedInRows, ...scheduledRows];
    })();

    const handoff = (() => {
const checkedIn = helpers.numberValue(counts.appointments, 'checked_in');
        const scheduled = helpers.numberValue(counts.appointments, 'scheduled');
        const activePatients = helpers.numberValue(counts.patients, 'active');
        const hasCheckedInBlocker = Number(checkedIn ?? 0) > 0;
        const hasScheduledBlocker = Number(scheduled ?? 0) > 0;

        return {
            title: 'Front desk handoff',
            note: 'Reception to clinical queue',
            blockerTitle: hasCheckedInBlocker
                ? 'Checked-in patients awaiting pickup'
                : hasScheduledBlocker
                    ? 'Scheduled arrivals still open'
                    : 'No critical front desk blockers',
            blockerNote: hasCheckedInBlocker
                ? 'The clinician handoff queue is already forming.'
                : hasScheduledBlocker
                    ? 'Upcoming appointments still need check-in coverage.'
                    : 'Confirm scope before relying on front-desk queue counts.',
            nextAction: hasCheckedInBlocker
                ? 'Start from the checked-in queue so no patient handoff is missed.'
                : 'Review remaining scheduled arrivals and patient search requests.',
            primaryAction: {
                label: hasCheckedInBlocker ? 'Open checked-in queue' : 'Open appointments',
                href: '/reception/queue',
            },
            secondaryAction: { label: 'Open patients', href: '/patients' },
            chips: [
                { label: 'Active patients', value: activePatients },
                { label: 'Scheduled', value: scheduled },
                { label: 'Checked in', value: checkedIn },
            ],
        };
    })();

    const watchItems = (() => {
return [
            {
                label: 'Checked-in handoff',
                note: 'Arrivals already ready for clinician handoff.',
                value: helpers.numberValue(counts.appointments, 'checked_in'),
                href: '/reception/queue',
                actionLabel: 'Open checked-in queue',
                icon: 'calendar-clock',
            },
            {
                label: 'Scheduled arrivals still open',
                note: 'Upcoming appointments still need check-in coverage.',
                value: helpers.numberValue(counts.appointments, 'scheduled'),
                href: '/appointments',
                actionLabel: 'Open appointments',
                icon: 'calendar',
            },
            {
                label: 'Active patient records',
                note: 'Registration-ready records still need desk attention.',
                value: helpers.numberValue(counts.patients, 'active'),
                href: '/patients',
                actionLabel: 'Open patients',
                icon: 'users',
            },
        ];
    })();

    const queueTitle = (() => { return 'Front desk queue'; })();
    const queueDescription = (() => { return 'Checked-in patients awaiting clinical handoff, followed by upcoming scheduled arrivals.'; })();
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
