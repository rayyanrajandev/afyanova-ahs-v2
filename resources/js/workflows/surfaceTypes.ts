import type { DashboardQueueRow } from '@/lib/dashboardOperationsQueue';
import type { DirectServiceModuleKey } from '@/lib/directServicePatientWorklist';
import type { AppIconName } from '@/lib/icons';
import type { DashboardWorkflowWidget } from '@/types/dashboard';

export type DirectServiceModuleSummary = {
    key: DirectServiceModuleKey;
    label: string;
    href: string;
    actionLabel: string;
    icon: AppIconName;
    active: number | null;
    completed: number | null;
    subtitle: string;
    meta: string;
    queueStatus: string;
};

export type DashboardSurfaceRuntime = {
    today: string;
    nowTick: number;
    clinicianClinicalDepartment: string | null;
    vitalsOverdueCount: number;
    mciModeActive: boolean;
    directServiceModules: DirectServiceModuleSummary[];
    singleDirectServiceModule: DirectServiceModuleSummary | null;
    primaryDirectServiceModule: DirectServiceModuleSummary | null;
    auditExportHealth: Record<string, unknown> | null;
    scopeData: Record<string, unknown> | null;
    TRIAGE_P_ORDER: Record<string, number>;
    formatDateTime: (value: string | null | undefined) => string;
    formatMoney: (amount: unknown, currency?: unknown) => string;
    formatEnumLabel: (value: string) => string;
    clinicianQueueHref: (
        status?: 'waiting_provider' | 'in_consultation' | 'completed',
        focusAppointmentId?: string,
    ) => string;
    triageQueueHref: (focusAppointmentId?: string, triageCategory?: string) => string;
    departmentQueueHref: (
        department: string,
        status?: 'waiting_provider' | 'in_consultation',
        focusAppointmentId?: string,
    ) => string;
    activeConsultationWorkspaceHref: (appointmentId: string) => string;
    directServiceModuleHref: (module: DirectServiceModuleSummary | null, query?: string) => string;
    dashboardPatientLabel: (patientId: unknown) => string | null;
    appointmentTriageCategory: (item: Record<string, unknown>) => string | null;
    appointmentQueueSearchHaystack: (item: Record<string, unknown>) => string;
    mapDirectServiceOrdersToQueueRows: (items: unknown[], moduleKey: DirectServiceModuleKey) => DashboardQueueRow[];
    openResourcesTab?: () => void;
};

export type DashboardMetric = {
    label: string;
    help: string;
    icon: AppIconName;
    value: string;
    unavailable: boolean;
};

export type DashboardQuickAction = {
    label: string;
    icon: AppIconName;
    variant: 'default' | 'outline';
    href?: string;
    onClick?: () => void;
};

export type DashboardHandoff = {
    title: string;
    note: string;
    blockerTitle: string;
    blockerNote: string;
    nextAction: string;
    primaryAction: { label: string; href: string };
    secondaryAction: { label: string; href: string };
    chips: Array<{ label: string; value: number | null }>;
};

export type DashboardWatchItem = {
    label: string;
    note: string;
    value: number | null;
    href: string;
    actionLabel: string;
    icon: AppIconName;
};

export type DashboardSurfaceHelpers = {
    numberValue: (source: unknown, key: string | string[]) => number | null;
    metric: (label: string, help: string, icon: AppIconName, value: number | null, suffix?: string) => DashboardMetric;
};

export type DashboardSurfaceContext = {
    counts: Record<string, unknown>;
    lists: Record<string, unknown>;
    helpers: DashboardSurfaceHelpers;
    runtime: DashboardSurfaceRuntime;
    hasWidget: (widgetId: string) => boolean;
};

export type WorkflowSurface = {
    kpis: DashboardMetric[];
    actions: DashboardQuickAction[];
    queueRows: DashboardQueueRow[];
    handoff: DashboardHandoff;
    watchItems: DashboardWatchItem[];
    queueTitle: string;
    queueDescription: string;
    searchPlaceholder: string;
};

export type WorkflowSurfaceBuilder = (context: DashboardSurfaceContext) => WorkflowSurface;

export function createWidgetGate(widgets: DashboardWorkflowWidget[]): (widgetId: string) => boolean {
    if (widgets.length === 0) {
        return () => true;
    }

    const ids = new Set(widgets.map((widget) => widget.id));

    return (widgetId: string) => ids.has(widgetId);
}
