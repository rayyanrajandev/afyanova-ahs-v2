import type { DashboardQueueRow } from '@/lib/dashboardOperationsQueue';
import type { WorkflowSurface, WorkflowSurfaceBuilder } from '@/workflows/surfaceTypes';

export const buildTheatreSurface: WorkflowSurfaceBuilder = ({ counts, lists, helpers, runtime, hasWidget }) => {

    const kpis = (() => {
return [
            helpers.metric('Scheduled procedures', 'Cases scheduled and awaiting perioperative prep.', 'calendar', helpers.numberValue(counts.theatreProcedureCounts, 'scheduled')),
            helpers.metric('In progress', 'Procedures currently active in theatre workflow.', 'activity', helpers.numberValue(counts.theatreProcedureCounts, 'in_progress')),
            helpers.metric('Completed today', 'Signed or completed procedures in the current window.', 'check-circle', helpers.numberValue(counts.theatreProcedureCounts, 'completed')),
            helpers.metric('Draft cases', 'Procedure records still in draft documentation.', 'pencil', helpers.numberValue(counts.theatreProcedureCounts, 'draft')),
        ];
    })();

    const actions = (() => {
return [
            { label: 'Theatre procedures', icon: 'scissors', variant: 'default', href: '/theatre-procedures' },
        ];
    })();

    const queueRows: DashboardQueueRow[] = (() => {
return (lists.theatreProcedures ?? []).slice(0, 5).map((item: any) => {
            const procedureLabel = String(item.procedureName ?? item.procedureCode ?? 'Theatre procedure');
            const patientLabel = String(item.patientName ?? item.patientId ?? 'Patient');

            return {
                id: String(item.id ?? Math.random()),
                title: procedureLabel,
                subtitle: patientLabel,
                meta: item.scheduledAt ? `Scheduled ${runtime.formatDateTime(item.scheduledAt)}` : 'Schedule not recorded',
                status: runtime.formatEnumLabel(String(item.status ?? 'scheduled')),
                href: `/theatre-procedures?focusProcedureId=${encodeURIComponent(String(item.id ?? ''))}`,
                actionLabel: 'Open procedure',
                group: 'Theatre schedule',
            };
        });
    })();

    const scheduled = helpers.numberValue(counts.theatreProcedureCounts, 'scheduled');
    const inProgress = helpers.numberValue(counts.theatreProcedureCounts, 'in_progress');
    const draftCases = helpers.numberValue(counts.theatreProcedureCounts, 'draft');

    const handoff = {
        title: 'Theatre shift handoff',
        note: 'Perioperative schedule and documentation',
        blockerTitle:
            Number(inProgress ?? 0) > 0
                ? 'Procedures in progress'
                : Number(scheduled ?? 0) > 0
                  ? 'Scheduled cases awaiting prep'
                  : Number(draftCases ?? 0) > 0
                    ? 'Draft procedure documentation'
                    : 'No critical theatre blockers',
        blockerNote:
            Number(inProgress ?? 0) > 0
                ? 'Active cases need perioperative coordination before the next handoff.'
                : Number(scheduled ?? 0) > 0
                  ? 'Upcoming procedures may need staffing or resource confirmation.'
                  : Number(draftCases ?? 0) > 0
                    ? 'Draft cases still need documentation before sign-off.'
                    : 'Theatre schedule and documentation queues look stable.',
        nextAction:
            Number(inProgress ?? 0) > 0
                ? 'Confirm in-progress cases and resource allocation.'
                : 'Review the upcoming schedule and draft documentation.',
        primaryAction: {
            label: Number(inProgress ?? 0) > 0 ? 'Open in-progress cases' : 'Open theatre procedures',
            href: '/theatre-procedures',
        },
        secondaryAction: { label: 'Theatre schedule', href: '/theatre-procedures' },
        chips: [
            { label: 'Scheduled', value: scheduled },
            { label: 'In progress', value: inProgress },
            { label: 'Draft cases', value: draftCases },
        ],
    };

    const watchItems = [
        {
            label: 'Scheduled procedures',
            note: 'Cases awaiting perioperative preparation.',
            value: scheduled,
            href: '/theatre-procedures',
            actionLabel: 'Open schedule',
            icon: 'calendar' as const,
        },
        {
            label: 'In progress',
            note: 'Cases currently active in theatre workflow.',
            value: inProgress,
            href: '/theatre-procedures',
            actionLabel: 'Open theatre',
            icon: 'activity' as const,
        },
        {
            label: 'Draft documentation',
            note: 'Procedure records still in draft.',
            value: draftCases,
            href: '/theatre-procedures',
            actionLabel: 'Open drafts',
            icon: 'pencil' as const,
        },
    ];

    const queueTitle = 'Theatre schedule preview';
    const queueDescription = 'Upcoming and in-progress procedures from the theatre worklist.';
    const searchPlaceholder = 'Procedure name, patient, or status';

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
