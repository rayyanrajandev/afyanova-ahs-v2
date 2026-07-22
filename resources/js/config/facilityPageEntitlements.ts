/**
 * Facility subscription entitlements required to load Inertia pages, aligned with
 * `routes/web.php` `facility.entitlement` / `facility.entitlement.any` middleware (longest path prefix wins).
 * Static rules (below) cover non-module paths; module-derived rules can be appended at runtime
 * via {@link setModulePathRules} from the `config/modules.php` registry.
 * Paths are normalized with {@link normalizeAppPath} before matching.
 */
export type FacilityWebPathRule = {
    pathPrefix: string;
    /** AND: user must have every key. */
    requiredAll?: string[];
    /** OR: user must have at least one key (e.g. admissions page on scheduling or full admissions SKU). */
    requiredAny?: string[];
};

export type PathEntitlementRequirement =
    | { type: 'all'; keys: string[] }
    | { type: 'any'; keys: string[] };

/**
 * Module-derived path rules appended at runtime from the module registry (config/modules.php).
 * Set once during app initialization via {@link setModulePathRules}.
 */
let modulePathRules: readonly FacilityWebPathRule[] = [];

/**
 * Populate the module-derived path rules from the Inertia-shared module registry.
 * Called during app bootstrap (e.g. in the sidebar component or layout).
 */
export function setModulePathRules(rules: readonly FacilityWebPathRule[]): void {
    modulePathRules = rules;
}

/**
 * Ordered longest-prefix-first so nested routes resolve before parents.
 * Includes both static rules and any module-derived rules added at runtime.
 */
export const FACILITY_WEB_PATH_RULES: readonly FacilityWebPathRule[] = [
    { pathPrefix: '/inventory-procurement/warehouse-transfers', requiredAll: ['inventory.transfers'] },
    { pathPrefix: '/inventory-procurement/suppliers', requiredAll: ['inventory.suppliers'] },
    { pathPrefix: '/inventory-procurement/warehouses', requiredAll: ['inventory.warehouses'] },
    { pathPrefix: '/inventory-procurement', requiredAll: ['inventory.procurement'] },
    { pathPrefix: '/inpatient-ward/discharge-checklists', requiredAll: ['inpatient.care_plans'] },
    { pathPrefix: '/inpatient-ward', requiredAll: ['inpatient.ward'] },
    { pathPrefix: '/billing', requiredAll: ['billing.invoices'] },
    { pathPrefix: '/billing', requiredAll: ['billing.invoices'] },
    { pathPrefix: '/billing-payment-plans', requiredAll: ['billing.payment_plans'] },
    { pathPrefix: '/billing-cash', requiredAll: ['billing.cash_accounts'] },
    { pathPrefix: '/billing-refunds', requiredAll: ['billing.discounts_refunds'] },
    { pathPrefix: '/billing-discounts', requiredAll: ['billing.discounts_refunds'] },
    { pathPrefix: '/billing-financial-reports', requiredAll: ['billing.financial_controls'] },
    { pathPrefix: '/billing-corporate', requiredAll: ['billing.payer_contracts'] },
    { pathPrefix: '/billing-payer-contracts', requiredAll: ['billing.payer_contracts'] },
    { pathPrefix: '/billing-service-catalog', requiredAll: ['billing.service_catalog'] },
    { pathPrefix: '/billing-consultation-mappings', requiredAll: ['billing.service_catalog'] },
    { pathPrefix: '/pos/sales', requiredAll: ['pos.sales'] },
    { pathPrefix: '/pos/sessions', requiredAll: ['pos.registers_sessions'] },
    { pathPrefix: '/pos/cafeteria', requiredAll: ['pos.cafeteria'] },
    { pathPrefix: '/pos/frontdesk-quick', requiredAll: ['pos.registers_sessions'] },
    { pathPrefix: '/pos', requiredAll: ['pos.registers_sessions'] },
    { pathPrefix: '/claims-insurance', requiredAll: ['claims.insurance'] },
    { pathPrefix: '/medical-records', requiredAll: ['medical_records.core'] },
    { pathPrefix: '/emergency-triage', requiredAll: ['emergency.triage'] },
    { pathPrefix: '/emergency', requiredAll: ['emergency.triage'] },
    { pathPrefix: '/walk-in-service-requests', requiredAll: ['clinical.walk_in_queue'] },
    { pathPrefix: '/direct-service', requiredAll: ['clinical.walk_in_queue'] },
    { pathPrefix: '/appointments', requiredAll: ['appointments.scheduling'] },
    {
        pathPrefix: '/admissions',
        requiredAny: ['admissions.management', 'appointments.scheduling'],
    },
    { pathPrefix: '/patients', requiredAll: ['patients.search'] },
];

export function normalizeAppPath(href: string): string {
    const trimmed = String(href ?? '').trim();
    const pathOnly = trimmed.split('#', 1)[0]?.split('?', 1)[0] ?? '';
    const withSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
    if (withSlash.length > 1 && withSlash.endsWith('/')) {
        return withSlash.replace(/\/+$/, '');
    }
    return withSlash || '/';
}

function normalizeKeys(keys: readonly string[]): string[] {
    return keys.map((k) => k.toLowerCase());
}

/**
 * @returns Entitlement requirement for this path, or `null` when not gated (e.g. dashboard, platform admin).
 * Checks both static rules and any module-derived rules set via {@link setModulePathRules}.
 */
export function pathEntitlementRequirement(normalizedPath: string): PathEntitlementRequirement | null {
    const path = normalizedPath;
    const allRules = [...FACILITY_WEB_PATH_RULES, ...modulePathRules];
    for (const rule of allRules) {
        if (path === rule.pathPrefix || path.startsWith(`${rule.pathPrefix}/`)) {
            if (rule.requiredAny && rule.requiredAny.length > 0) {
                return { type: 'any', keys: normalizeKeys(rule.requiredAny) };
            }
            if (rule.requiredAll && rule.requiredAll.length > 0) {
                return { type: 'all', keys: normalizeKeys(rule.requiredAll) };
            }
        }
    }
    return null;
}

/** @deprecated Use {@link pathEntitlementRequirement} for OR rules. */
export function requiredEntitlementsForAppPath(normalizedPath: string): string[] | null {
    const req = pathEntitlementRequirement(normalizedPath);
    if (!req) return null;
    if (req.type === 'all') return [...req.keys];
    return [...req.keys];
}

export function facilityEntitlementsSatisfied(
    normalizedPath: string,
    grantedEntitlementLowercase: ReadonlySet<string>,
): boolean {
    const req = pathEntitlementRequirement(normalizedPath);
    if (req === null) {
        return true;
    }
    if (req.type === 'all') {
        return req.keys.every((key) => grantedEntitlementLowercase.has(key));
    }
    return req.keys.some((key) => grantedEntitlementLowercase.has(key));
}

/** Short labels for UI chips / toasts (not exhaustive). */
export function formatEntitlementLabel(key: string): string {
    return key
        .replaceAll('_', ' ')
        .replace(/\./g, ' · ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
