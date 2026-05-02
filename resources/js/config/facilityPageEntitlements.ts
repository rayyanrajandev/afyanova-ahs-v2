/**
 * Facility subscription entitlements required to load Inertia pages, aligned with
 * `routes/web.php` `facility.entitlement:*` middleware (longest path prefix wins).
 * Paths are normalized with {@link normalizeAppPath} before matching.
 */
export type FacilityWebPathRule = {
    pathPrefix: string;
    /** User must have every entitlement (AND). Keys are lowercase entitlement_key values from the plan catalog. */
    requiredAll: string[];
};

/**
 * Ordered longest-prefix-first so nested routes resolve before parents.
 */
export const FACILITY_WEB_PATH_RULES: readonly FacilityWebPathRule[] = [
    { pathPrefix: '/inventory-procurement/warehouse-transfers', requiredAll: ['inventory.transfers'] },
    { pathPrefix: '/inventory-procurement/suppliers', requiredAll: ['inventory.suppliers'] },
    { pathPrefix: '/inventory-procurement/warehouses', requiredAll: ['inventory.warehouses'] },
    { pathPrefix: '/inventory-procurement', requiredAll: ['inventory.procurement'] },
    { pathPrefix: '/inpatient-ward/discharge-checklists', requiredAll: ['inpatient.care_plans'] },
    { pathPrefix: '/inpatient-ward', requiredAll: ['inpatient.ward'] },
    { pathPrefix: '/billing-invoices', requiredAll: ['billing.invoices'] },
    { pathPrefix: '/billing-payment-plans', requiredAll: ['billing.payment_plans'] },
    { pathPrefix: '/billing-cash', requiredAll: ['billing.cash_accounts'] },
    { pathPrefix: '/billing-refunds', requiredAll: ['billing.discounts_refunds'] },
    { pathPrefix: '/billing-discounts', requiredAll: ['billing.discounts_refunds'] },
    { pathPrefix: '/billing-financial-reports', requiredAll: ['billing.financial_controls'] },
    { pathPrefix: '/billing-corporate', requiredAll: ['billing.payer_contracts'] },
    { pathPrefix: '/billing-payer-contracts', requiredAll: ['billing.payer_contracts'] },
    { pathPrefix: '/billing-service-catalog', requiredAll: ['billing.service_catalog'] },
    { pathPrefix: '/pos/sales', requiredAll: ['pos.sales'] },
    { pathPrefix: '/pos/sessions', requiredAll: ['pos.registers_sessions'] },
    { pathPrefix: '/pos', requiredAll: ['pos.registers_sessions'] },
    { pathPrefix: '/claims-insurance', requiredAll: ['claims.insurance'] },
    { pathPrefix: '/staff-credentialing', requiredAll: ['staff.credentialing'] },
    { pathPrefix: '/staff-privileges', requiredAll: ['staff.privileges'] },
    { pathPrefix: '/staff', requiredAll: ['staff.profiles'] },
    { pathPrefix: '/medical-records', requiredAll: ['medical_records.core'] },
    { pathPrefix: '/emergency-triage', requiredAll: ['emergency.triage'] },
    { pathPrefix: '/theatre-procedures', requiredAll: ['theatre.procedures'] },
    { pathPrefix: '/radiology-orders', requiredAll: ['radiology.orders'] },
    { pathPrefix: '/pharmacy-orders', requiredAll: ['pharmacy.orders'] },
    { pathPrefix: '/laboratory-orders', requiredAll: ['laboratory.orders'] },
    { pathPrefix: '/appointments', requiredAll: ['appointments.scheduling'] },
    { pathPrefix: '/admissions', requiredAll: ['admissions.management'] },
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

/**
 * @returns Required entitlement keys, or `null` when this path is not gated by a facility plan SKU
 * (e.g. dashboard, platform admin, help).
 */
export function requiredEntitlementsForAppPath(normalizedPath: string): string[] | null {
    const path = normalizedPath;
    for (const rule of FACILITY_WEB_PATH_RULES) {
        if (path === rule.pathPrefix || path.startsWith(`${rule.pathPrefix}/`)) {
            return [...rule.requiredAll];
        }
    }
    return null;
}

export function facilityEntitlementsSatisfied(
    normalizedPath: string,
    grantedEntitlementLowercase: ReadonlySet<string>,
): boolean {
    const required = requiredEntitlementsForAppPath(normalizedPath);
    if (required === null) {
        return true;
    }
    return required.every((key) => grantedEntitlementLowercase.has(key.toLowerCase()));
}

/** Short labels for UI chips / toasts (not exhaustive). */
export function formatEntitlementLabel(key: string): string {
    return key
        .replaceAll('_', ' ')
        .replace(/\./g, ' · ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
