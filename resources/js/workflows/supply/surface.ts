import { mapProcurementRequestToQueueRow } from '@/lib/dashboardSupplyQueue';
import type { WorkflowSurface, WorkflowSurfaceBuilder } from '@/workflows/surfaceTypes';

export const buildSupplySurface: WorkflowSurfaceBuilder = ({ counts, lists, helpers, hasWidget }) => {
    const { numberValue, metric } = helpers;
    const lowStock = numberValue(counts.inventoryStockAlerts, 'low');
    const outOfStock = numberValue(counts.inventoryStockAlerts, 'out_of_stock');
    const procurementCount = Array.isArray(lists.procurementRequests) ? lists.procurementRequests.length : 0;

    const kpis = [
        hasWidget('stock_alerts')
            ? metric(
                  'Low stock alerts',
                  'SKUs flagged below replenishment thresholds.',
                  'package',
                  lowStock,
              )
            : null,
        hasWidget('stock_alerts')
            ? metric(
                  'Out of stock',
                  'Items with zero available quantity.',
                  'alert-triangle',
                  outOfStock,
              )
            : null,
        hasWidget('stock_alerts')
            ? metric(
                  'Reorder suggested',
                  'Items with suggested reorder quantities.',
                  'package',
                  numberValue(counts.inventoryStockAlerts, 'reorder'),
              )
            : null,
        hasWidget('stock_alerts')
            ? metric(
                  'Expiring soon',
                  'Stock batches nearing expiry windows.',
                  'calendar-clock',
                  numberValue(counts.inventoryStockAlerts, 'expiring_soon'),
              )
            : null,
    ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const queueRows = hasWidget('procurement')
        ? (Array.isArray(lists.procurementRequests) ? lists.procurementRequests : [])
              .slice(0, 8)
              .map((item: Record<string, unknown>) => mapProcurementRequestToQueueRow(item))
        : [];

    return {
        kpis,
        actions: [{ label: 'Supply chain', icon: 'package', variant: 'default', href: '/inventory-procurement' }],
        queueRows,
        handoff: {
            title: 'Supply chain handoff',
            note: 'Inventory alerts and procurement follow-up',
            blockerTitle:
                Number(outOfStock ?? 0) > 0
                    ? 'Out-of-stock SKUs need replenishment'
                    : Number(lowStock ?? 0) > 0
                      ? 'Low stock alerts open'
                      : procurementCount > 0
                        ? 'Open procurement requests'
                        : 'No critical supply blockers',
            blockerNote:
                Number(outOfStock ?? 0) > 0
                    ? 'Zero-quantity items may block clinical or ward workflows.'
                    : Number(lowStock ?? 0) > 0
                      ? 'SKUs are below replenishment thresholds — review reorder suggestions.'
                      : procurementCount > 0
                        ? 'Department requisitions are waiting for storekeeper action.'
                        : 'Stock levels and procurement queues look stable for the next shift.',
            nextAction:
                Number(outOfStock ?? 0) > 0
                    ? 'Prioritize out-of-stock items that block downstream care.'
                    : procurementCount > 0
                      ? 'Review open procurement requests by needed-by date.'
                      : 'Confirm low-stock alerts and expiring batches.',
            primaryAction: {
                label: Number(outOfStock ?? 0) > 0 ? 'Open stock alerts' : 'Open procurement',
                href: '/inventory-procurement',
            },
            secondaryAction: { label: 'Supply chain workspace', href: '/inventory-procurement/workspace' },
            chips: [
                { label: 'Low stock', value: lowStock },
                { label: 'Out of stock', value: outOfStock },
                { label: 'Open requests', value: procurementCount },
            ],
        },
        watchItems: [
            {
                label: 'Out of stock',
                note: 'SKUs with zero available quantity.',
                value: outOfStock,
                href: '/inventory-procurement',
                actionLabel: 'Open inventory',
                icon: 'alert-triangle',
            },
            {
                label: 'Low stock alerts',
                note: 'Items below replenishment thresholds.',
                value: lowStock,
                href: '/inventory-procurement',
                actionLabel: 'Review alerts',
                icon: 'package',
            },
            {
                label: 'Open procurement requests',
                note: 'Department requisitions awaiting storekeeper action.',
                value: procurementCount,
                href: '/inventory-procurement',
                actionLabel: 'Open procurement',
                icon: 'layout-list',
            },
        ],
        queueTitle: 'Procurement request preview',
        queueDescription:
            'Open requisitions sorted by recent activity — pair with stock alert KPIs for replenishment planning.',
        searchPlaceholder: 'Request #, department, item, or status',
    };
};
