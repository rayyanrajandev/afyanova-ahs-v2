export const operationalFacilityScopePathPrefixes = [
    '/patients',
    '/appointments',
    '/admissions',
    '/medical-records',
    '/laboratory-orders',
    '/pharmacy-orders',
    '/radiology-orders',
    '/emergency-triage',
    '/inpatient-ward',
    '/theatre-procedures',
    '/billing',
    '/billing-cash',
    '/billing-invoices',
    '/billing-payment-plans',
    '/billing-refunds',
    '/billing-discounts',
    '/billing-financial-reports',
    '/billing-corporate',
    '/billing-payer-contracts',
    '/billing-service-catalog',
    '/pos',
    '/claims-insurance',
    '/inventory-procurement',
    '/staff',
    '/staff-credentialing',
    '/staff-privileges',
    '/setup-center',
];

export function normalizePlatformPath(url: string | undefined): string {
    const candidate = String(url ?? '').split('#', 1)[0]?.split('?', 1)[0] ?? '';

    return candidate.startsWith('/') ? candidate : `/${candidate}`;
}

export function isPlatformAdminPath(path: string): boolean {
    return path === '/platform/admin' || path.startsWith('/platform/admin/');
}

export function isOperationalFacilityScopePath(path: string): boolean {
    return operationalFacilityScopePathPrefixes.some((prefix) =>
        path === prefix || path.startsWith(`${prefix}/`),
    );
}
