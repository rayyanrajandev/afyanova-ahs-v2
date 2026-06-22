import type { DashboardQueueRow } from '@/lib/dashboardOperationsQueue';
import { formatEnumLabel } from '@/lib/labels';

export function mapProcurementRequestToQueueRow(request: Record<string, unknown>): DashboardQueueRow {
    const id = String(request.id ?? '').trim();
    const title = String(request.requestNumber ?? request.reference ?? `Request ${id || ''}`).trim() || 'Procurement request';
    const department = String(request.departmentName ?? request.department ?? '').trim();
    const status = formatEnumLabel(String(request.status ?? 'pending'));
    const itemLabel = String(request.itemName ?? request.primaryItemName ?? '').trim();

    return {
        id: id || `procurement-${Math.random()}`,
        title,
        subtitle: [department, itemLabel].filter(Boolean).join(' · ') || 'Department requisition',
        meta: request.neededBy ? `Needed by ${String(request.neededBy)}` : 'Awaiting procurement action',
        status,
        href: '/inventory-procurement',
        actionLabel: 'Open procurement',
        group: 'Open requests',
        searchHaystack: [title, department, itemLabel, status].filter(Boolean).join(' '),
    };
}
