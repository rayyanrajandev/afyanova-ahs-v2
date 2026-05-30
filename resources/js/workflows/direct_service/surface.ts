import type { DashboardQueueRow } from '@/lib/dashboardOperationsQueue';
import type { DirectServiceModuleKey } from '@/lib/directServicePatientWorklist';
import type { WorkflowSurfaceBuilder } from '@/workflows/surfaceTypes';

export const buildDirectServiceSurface: WorkflowSurfaceBuilder = ({ counts, lists, helpers, runtime, hasWidget }) => {

    const kpis = (() => {
const singleModule = runtime.singleDirectServiceModule;
        if (singleModule) {
            if (singleModule.key === 'laboratory') {
                const labCounts = counts.laboratory;
                const tatRiskCount = (lists.laboratoryOrders ?? []).filter((order: any) => {
                    const orderedAt = order?.orderedAt ? new Date(order.orderedAt).getTime() : NaN;
                    if (!Number.isFinite(orderedAt)) return false;

                    const priority = String(order?.priority ?? '').trim().toLowerCase();
                    const thresholdMinutes = priority === 'stat' ? 60 : priority === 'urgent' ? 120 : 240;

                    return runtime.nowTick - orderedAt > thresholdMinutes * 60_000;
                }).length;

                return [
                    helpers.metric(
                        'Active lab orders',
                        'All open lab orders still moving through collection, processing, or release.',
                        'flask-conical',
                        helpers.numberValue(labCounts, ['ordered', 'collected', 'in_progress']),
                    ),
                    helpers.metric(
                        'Awaiting collection',
                        'Orders placed but specimen collection is not yet recorded.',
                        'calendar-clock',
                        helpers.numberValue(labCounts, 'ordered'),
                    ),
                    helpers.metric(
                        'Collected / processing',
                        'Specimens collected or actively being processed by the laboratory.',
                        'activity',
                        helpers.numberValue(labCounts, ['collected', 'in_progress']),
                    ),
                    helpers.metric(
                        'TAT risk',
                        'Open orders exceeding priority-aware dashboard turnaround thresholds.',
                        'alert-triangle',
                        tatRiskCount,
                    ),
                ];
            }

            return [
                helpers.metric(
                    `Pending ${singleModule.label.toLowerCase()} orders`,
                    singleModule.subtitle,
                    singleModule.icon,
                    singleModule.active,
                ),
                helpers.metric(
                    singleModule.key === 'pharmacy' ? 'Dispensed orders' : 'Completed orders',
                    `${singleModule.label} work already completed in the current queue scope.`,
                    singleModule.key === 'pharmacy' ? 'pill' : 'check-circle',
                    singleModule.completed,
                ),
            ];
        }

        return [
            ...runtime.directServiceModules.map((module) =>
                helpers.metric(
                    `Pending ${module.label.toLowerCase()} orders`,
                    module.subtitle,
                    module.icon,
                    module.active,
                ),
            ),
            helpers.metric('Service queues in scope', 'Direct-service modules available in this session.', 'building-2', runtime.directServiceModules.length),
        ];
    })();

    const actions = (() => {
return runtime.directServiceModules.map((module, index) => ({
            label: runtime.singleDirectServiceModule ? `${module.label} queue` : module.label,
            icon: module.icon,
            variant: index === 0 ? 'default' : 'outline',
            href: module.href,
        }));
    })();

    const queueRows: DashboardQueueRow[] = (() => {


        const focusedModule = runtime.singleDirectServiceModule ?? runtime.primaryDirectServiceModule;
        const ordersForModule = (moduleKey: DirectServiceModuleKey) => {
            if (moduleKey === 'radiology') return lists.radiologyOrders ?? [];
            if (moduleKey === 'laboratory') return lists.laboratoryOrders ?? [];
            if (moduleKey === 'pharmacy') return lists.pharmacyOrders ?? [];
            return [];
        };

        if (focusedModule) {
            const orders = ordersForModule(focusedModule.key);
            if (orders.length > 0) {
                const rows = runtime.mapDirectServiceOrdersToQueueRows(orders, focusedModule.key);
                if (rows.length > 0) {
                    return rows;
                }
            }

            const activeInScope = Number(focusedModule.active ?? 0);
            if (activeInScope > 0) {
                return [{
                    id: `direct-service-${focusedModule.key}-details-unavailable`,
                    title: `${focusedModule.label} queue details`,
                    subtitle: `${activeInScope} active order${activeInScope === 1 ? '' : 's'} in scope. Open the full queue for patient and requester details.`,
                    meta: 'Patient-level summary not loaded on dashboard',
                    status: focusedModule.queueStatus,
                    href: runtime.directServiceModuleHref(focusedModule),
                    actionLabel: focusedModule.actionLabel,
                    group: `${focusedModule.label} worklist`,
                }];
            }

            return [];
        }

        return runtime.directServiceModules.map((module) => ({
            id: `direct-service-${module.key}`,
            title: `${module.label} queue`,
            subtitle: module.subtitle,
            meta: module.meta,
            status: module.queueStatus,
            href: module.href,
            actionLabel: module.actionLabel,
        }));
    })();

    const handoff = (() => {
const leadModule = runtime.primaryDirectServiceModule;
        const secondaryModule = runtime.singleDirectServiceModule ? null : runtime.directServiceModules[1] ?? null;
        const hasActiveQueue = Number(leadModule?.active ?? 0) > 0;
        const isSingleModule = Boolean(runtime.singleDirectServiceModule);

        return {
            title: leadModule ? `${leadModule.label} handoff` : 'Service handoff',
            note: leadModule
                ? isSingleModule
                    ? `${leadModule.label} queue and status movement`
                    : 'Laboratory, pharmacy, and radiology flow'
                : 'Service queue flow',
            blockerTitle: leadModule
                ? hasActiveQueue
                    ? `${leadModule.label} queue still active`
                    : `${leadModule.label} queue stable`
                : 'No service modules available',
            blockerNote: leadModule
                ? hasActiveQueue
                    ? leadModule.subtitle
                    : `${leadModule.label} queue looks stable for this session.`
                : 'No service modules are available in this session scope.',
            nextAction: leadModule
                ? hasActiveQueue
                    ? `Start from ${leadModule.label.toLowerCase()} so service queue work keeps moving.`
                    : `Open ${leadModule.label.toLowerCase()} to confirm the queue is still clear.`
                : 'Refresh scope or permissions before relying on this dashboard.',
            primaryAction: leadModule
                ? { label: leadModule.actionLabel, href: leadModule.href }
                : { label: 'Refresh dashboard', href: '/dashboard' },
            secondaryAction: secondaryModule
                ? { label: secondaryModule.actionLabel, href: secondaryModule.href }
                : { label: 'Open resources', href: '/dashboard#dashboard-resources' },
            chips: runtime.directServiceModules.slice(0, 3).map((module) => ({
                label: module.label,
                value: module.active,
            })),
        };
    })();

    const watchItems = (() => {
return runtime.directServiceModules.map((module) => ({
            label: `${module.label} active queue`,
            note: module.subtitle,
            value: module.active,
            href: module.href,
            actionLabel: module.actionLabel,
            icon: module.icon,
        }));
    })();

    const queueTitle = (() => { return runtime.singleDirectServiceModule ? `${runtime.singleDirectServiceModule.label} queue` : 'Service queues'; })();
    const queueDescription = (() => { return runtime.singleDirectServiceModule?.subtitle ?? 'Open orders grouped by patient — select a patient to review their full worklist.'; })();
    const searchPlaceholder = (() => { return 'Patient name, MRN, phone, order #, or status'; })();

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
