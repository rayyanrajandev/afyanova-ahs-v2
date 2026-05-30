import type { DashboardQueueRow } from '@/lib/dashboardOperationsQueue';
import type { WorkflowSurfaceBuilder } from '@/workflows/surfaceTypes';

export const buildAdminSurface: WorkflowSurfaceBuilder = ({ counts, helpers, runtime }) => {
    const { numberValue, metric } = helpers;

    const kpis = [
        metric(
            'Audit export backlog',
            'Queued or processing export jobs across accessible modules.',
            'activity',
            numberValue(runtime.auditExportHealth?.aggregate, 'currentBacklog'),
        ),
        metric(
            'Recent export failures',
            'Failed export jobs from the recent health window.',
            'alert-triangle',
            numberValue(runtime.auditExportHealth?.aggregate, 'recentFailed'),
        ),
        metric(
            'Accessible facilities',
            'Facilities currently visible in this workstation scope.',
            'building-2',
            Number((runtime.scopeData?.userAccess as { accessibleFacilityCount?: number } | undefined)?.accessibleFacilityCount ?? 0),
        ),
        metric('Ward escalations', 'Escalated inpatient tasks still visible in scope.', 'bed-double', numberValue(counts.wardTasks, 'escalated')),
    ];

    const actions = [
        { label: 'Audit export', icon: 'activity' as const, variant: 'outline' as const, onClick: () => runtime.openResourcesTab?.() },
        { label: 'Platform users', icon: 'users' as const, variant: 'outline' as const, href: '/platform/admin/users' },
    ];

    const failures = Array.isArray(runtime.auditExportHealth?.recentFailures)
        ? (runtime.auditExportHealth.recentFailures as Array<Record<string, unknown>>)
        : [];

    const queueRows: DashboardQueueRow[] = failures.slice(0, 3).map((item, index) => ({
        id: String(item.id ?? `audit-failure-${index}`),
        title: String(item.targetResourceId ?? 'Failed export job'),
        subtitle: String(item.errorMessage ?? 'Export failed and needs review.'),
        meta: `${runtime.formatEnumLabel(String(item.moduleKey ?? 'module'))} | ${runtime.formatDateTime(String(item.failedAt ?? item.createdAt ?? ''))}`,
        status: 'Failed',
        href: '#dashboard-resources',
        actionLabel: 'Open resources',
    }));

    const recentExportFailures = numberValue(runtime.auditExportHealth?.aggregate, 'recentFailed');
    const exportBacklog = numberValue(runtime.auditExportHealth?.aggregate, 'currentBacklog');
    const wardEscalations = numberValue(counts.wardTasks, 'escalated');
    const accessibleFacilities = Number(
        (runtime.scopeData?.userAccess as { accessibleFacilityCount?: number } | undefined)?.accessibleFacilityCount ?? 0,
    );

    const handoff = {
        title: 'Admin oversight handoff',
        note: 'Platform and operational oversight',
        blockerTitle:
            accessibleFacilities === 0
                ? 'Scope needs attention'
                : Number(recentExportFailures ?? 0) > 0
                  ? 'Recent audit export failures'
                  : Number(wardEscalations ?? 0) > 0
                    ? 'Ward escalations still open'
                    : 'No critical admin blockers',
        blockerNote:
            accessibleFacilities === 0
                ? 'Confirm tenant/facility scope before trusting any queue metrics.'
                : Number(recentExportFailures ?? 0) > 0
                  ? 'Recent failed export jobs need review before the next shift.'
                  : Number(wardEscalations ?? 0) > 0
                    ? 'The next operations lead should review current ward escalations.'
                    : 'Operational scope and platform queues look stable for the next lead.',
        nextAction:
            accessibleFacilities === 0
                ? 'Review scope selection before moving into operational queues.'
                : 'Switch to resources for export health, retry-resume telemetry, and workstation context.',
        primaryAction: {
            label: accessibleFacilities === 0 ? 'Review scope' : 'Open audit export',
            href: '/dashboard#dashboard-resources',
        },
        secondaryAction: { label: 'Platform users', href: '/platform/admin/users' },
        chips: [
            { label: 'Accessible facilities', value: Number.isFinite(accessibleFacilities) ? accessibleFacilities : null },
            { label: 'Export backlog', value: exportBacklog },
            { label: 'Recent failures', value: recentExportFailures },
        ],
    };

    const watchItems = [
        {
            label: 'Scope resolution needs review',
            note: 'Review scope when tenant or facility context looks off.',
            value: accessibleFacilities,
            href: '/dashboard#dashboard-resources',
            actionLabel: 'Review scope',
            icon: 'building-2' as const,
        },
        {
            label: 'Recent audit export failures',
            note: 'Recent failed export jobs need review before the next shift.',
            value: recentExportFailures,
            href: '/dashboard#dashboard-resources',
            actionLabel: 'Open audit export',
            icon: 'activity' as const,
        },
        {
            label: 'Ward escalations still open',
            note: 'Operational escalations that may need leadership review.',
            value: wardEscalations,
            href: '/inpatient-ward',
            actionLabel: 'Open inpatient ward',
            icon: 'bed-double' as const,
        },
    ];

    return {
        kpis,
        actions,
        queueRows,
        handoff,
        watchItems,
        queueTitle: 'Recent export failures',
        queueDescription: 'Failures and backlog signals from audit export health.',
        searchPlaceholder: 'Patient name, MRN, phone, or appointment #',
    };
};
