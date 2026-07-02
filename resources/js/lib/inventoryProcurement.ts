/**
 * Hospital supply chain navigation — one domain, task-focused pages.
 */

export const INVENTORY_PROCUREMENT_HOME_PATH = '/inventory-procurement';

export const INVENTORY_PROCUREMENT_STOCK_CONTROL_PATH = '/inventory-procurement/stock-control';

export const INVENTORY_PROCUREMENT_PROCUREMENT_PATH = '/inventory-procurement/procurement';

export const INVENTORY_PROCUREMENT_REQUESTS_FULFILMENT_PATH = '/inventory-procurement/requests-fulfilment';

export const INVENTORY_PROCUREMENT_REVIEW_PATH = '/inventory-procurement/review';

export const INVENTORY_PROCUREMENT_RECEIVE_PATH = '/inventory-procurement/receive';

export const INVENTORY_PROCUREMENT_ISSUE_PATH = '/inventory-procurement/issue';

export const INVENTORY_PROCUREMENT_COUNT_PATH = '/inventory-procurement/count';

export function procurementGrnPrintHref(procurementRequestId: string): string {
    return `/inventory-procurement/procurement-requests/${encodeURIComponent(procurementRequestId)}/grn`;
}

export function procurementGrnPdfHref(procurementRequestId: string): string {
    return `/inventory-procurement/procurement-requests/${encodeURIComponent(procurementRequestId)}/grn.pdf`;
}

export const supplyChainSections = [
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

export type SupplyChainSection = (typeof supplyChainSections)[number];

export function normalizeSupplyChainSection(value: string): SupplyChainSection {
    return supplyChainSections.includes(value as SupplyChainSection)
        ? (value as SupplyChainSection)
        : 'overview';
}

export type SupplyChainRouteQuery = {
    section?: SupplyChainSection | string;
    itemId?: string;
    movementType?: string;
    q?: string;
    status?: string;
};

export function supplyChainSectionHref(section: SupplyChainSection): string {
    const pageMap: Record<SupplyChainSection, string> = {
        overview: INVENTORY_PROCUREMENT_REQUESTS_FULFILMENT_PATH,
        requisitions: INVENTORY_PROCUREMENT_REQUESTS_FULFILMENT_PATH,
        'shortage-queue': INVENTORY_PROCUREMENT_REQUESTS_FULFILMENT_PATH,
        transfers: INVENTORY_PROCUREMENT_REQUESTS_FULFILMENT_PATH,
        inventory: INVENTORY_PROCUREMENT_STOCK_CONTROL_PATH,
        ledger: INVENTORY_PROCUREMENT_STOCK_CONTROL_PATH,
        'department-stock': INVENTORY_PROCUREMENT_STOCK_CONTROL_PATH,
        procurement: INVENTORY_PROCUREMENT_PROCUREMENT_PATH,
        'msd-orders': INVENTORY_PROCUREMENT_PROCUREMENT_PATH,
        'lead-times': INVENTORY_PROCUREMENT_PROCUREMENT_PATH,
        claims: INVENTORY_PROCUREMENT_REVIEW_PATH,
        analytics: INVENTORY_PROCUREMENT_REVIEW_PATH,
    };
    return pageMap[section] ?? INVENTORY_PROCUREMENT_STOCK_CONTROL_PATH;
}

/** Maps legacy section-based URLs to the dedicated supply chain pages. */
export function supplyChainHref(query: SupplyChainRouteQuery = {}): string {
    if (query.section) {
        const section = normalizeSupplyChainSection(String(query.section));
        return supplyChainSectionHref(section);
    }
    return INVENTORY_PROCUREMENT_STOCK_CONTROL_PATH;
}

export const supplyChainSectionLabels: Record<SupplyChainSection, string> = {
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
