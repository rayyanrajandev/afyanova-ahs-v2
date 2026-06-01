/**
 * Hospital supply chain navigation — one domain, task-focused workspaces.
 */

export const INVENTORY_PROCUREMENT_HOME_PATH = '/inventory-procurement';

export const INVENTORY_PROCUREMENT_WORKSPACE_PATH = '/inventory-procurement/workspace';

export const INVENTORY_PROCUREMENT_RECEIVE_PATH = '/inventory-procurement/receive';

export const INVENTORY_PROCUREMENT_ISSUE_PATH = '/inventory-procurement/issue';

export const INVENTORY_PROCUREMENT_COUNT_PATH = '/inventory-procurement/count';

export const inventoryWorkspaceSections = [
    'inventory',
    'procurement',
    'ledger',
    'department-stock',
    'requisitions',
    'shortage-queue',
    'lead-times',
    'transfers',
    'claims',
    'msd-orders',
    'analytics',
] as const;

export type InventoryWorkspaceSection = (typeof inventoryWorkspaceSections)[number];

export function normalizeInventoryWorkspaceSection(value: string): InventoryWorkspaceSection {
    return inventoryWorkspaceSections.includes(value as InventoryWorkspaceSection)
        ? (value as InventoryWorkspaceSection)
        : 'inventory';
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
    inventory: 'Item master',
    procurement: 'Procurement',
    ledger: 'Stock ledger',
    'department-stock': 'Department stock',
    requisitions: 'Requisitions',
    'shortage-queue': 'Shortage queue',
    'lead-times': 'Lead times',
    transfers: 'Transfers',
    claims: 'Claims',
    'msd-orders': 'MSD orders',
    analytics: 'Analytics',
};
