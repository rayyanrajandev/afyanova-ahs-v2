/**
 * Hospital supply chain navigation — one domain, task-focused workspaces.
 */

export const INVENTORY_PROCUREMENT_HOME_PATH = '/inventory-procurement';

export const INVENTORY_PROCUREMENT_WORKSPACE_PATH = '/inventory-procurement/workspace';

export const INVENTORY_PROCUREMENT_RECEIVE_PATH = '/inventory-procurement/receive';

export const INVENTORY_PROCUREMENT_ISSUE_PATH = '/inventory-procurement/issue';

export const INVENTORY_PROCUREMENT_COUNT_PATH = '/inventory-procurement/count';

export function procurementGrnPrintHref(procurementRequestId: string): string {
    return `/inventory-procurement/procurement-requests/${encodeURIComponent(procurementRequestId)}/grn`;
}

export function procurementGrnPdfHref(procurementRequestId: string): string {
    return `/inventory-procurement/procurement-requests/${encodeURIComponent(procurementRequestId)}/grn.pdf`;
}

export const inventoryWorkspaceSections = [
    'overview',
    'requisitions',
    'shortage-queue',
    'transfers',
    'inventory',
    'ledger',
    'department-stock',
    'procurement',
    'msd-orders',
    'lead-times',
    'claims',
    'analytics',
] as const;

export type InventoryWorkspaceSection = (typeof inventoryWorkspaceSections)[number];

export function normalizeInventoryWorkspaceSection(value: string): InventoryWorkspaceSection {
    return inventoryWorkspaceSections.includes(value as InventoryWorkspaceSection)
        ? (value as InventoryWorkspaceSection)
        : 'overview';
}

export type InventoryWorkspaceQuery = {
    section?: InventoryWorkspaceSection | string;
    itemId?: string;
    movementType?: string;
    q?: string;
    status?: string;
};

export function inventoryWorkspaceHref(query: InventoryWorkspaceQuery = {}): string {
    const url = new URL(INVENTORY_PROCUREMENT_WORKSPACE_PATH, 'http://local');

    if (query.section) {
        url.searchParams.set('section', normalizeInventoryWorkspaceSection(String(query.section)));
    }

    for (const [key, value] of Object.entries(query)) {
        if (key === 'section' || value == null || String(value).trim() === '') {
            continue;
        }

        url.searchParams.set(key, String(value).trim());
    }

    const built = url.pathname + url.search;

    return built === INVENTORY_PROCUREMENT_WORKSPACE_PATH ? built : built;
}

/** Deep links with section/filters still land on the full workspace (backward compatible). */
export function shouldOpenInventoryWorkspace(search: string): boolean {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);

    if (params.has('section')) {
        return true;
    }

    if (params.has('itemId') || params.has('movementType')) {
        return true;
    }

    return false;
}

export const inventoryWorkspaceSectionLabels: Record<InventoryWorkspaceSection, string> = {
    overview: 'Overview',
    requisitions: 'Department requests',
    'shortage-queue': 'Shortages',
    transfers: 'Transfers',
    inventory: 'Item master',
    ledger: 'Stock ledger',
    'department-stock': 'Department stock',
    procurement: 'Purchase requests',
    'msd-orders': 'MSD orders',
    'lead-times': 'Lead times',
    claims: 'Claims',
    analytics: 'Analytics',
};
