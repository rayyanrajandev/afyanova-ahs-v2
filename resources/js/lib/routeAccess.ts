import {
    facilityEntitlementsSatisfied,
    normalizeAppPath,
    pathEntitlementRequirement,
} from '@/config/facilityPageEntitlements';

type RouteAccessRule = {
    pathPrefix: string;
    requiredPermissions: string[];
};

const routeAccessRules: RouteAccessRule[] = [
    {
        pathPrefix: '/inventory-procurement/suppliers',
        requiredPermissions: ['inventory.procurement.read'],
    },
    {
        pathPrefix: '/inventory-procurement/warehouses',
        requiredPermissions: ['inventory.procurement.read'],
    },
    {
        pathPrefix: '/platform/admin/user-approval-cases',
        requiredPermissions: ['platform.users.approval-cases.read'],
    },
    {
        pathPrefix: '/platform/admin/facility-rollouts',
        requiredPermissions: ['platform.multi-facility.read'],
    },
    {
        pathPrefix: '/platform/admin/facility-config',
        requiredPermissions: ['platform.facilities.read'],
    },
    {
        pathPrefix: '/platform/admin/service-plans',
        requiredPermissions: ['platform.subscription-plans.read'],
    },
    {
        pathPrefix: '/platform/admin/clinical-catalogs',
        requiredPermissions: ['platform.clinical-catalog.read'],
    },
    {
        pathPrefix: '/platform/admin/privilege-catalogs',
        requiredPermissions: ['staff.privileges.read'],
    },
    {
        pathPrefix: '/platform/admin/specialties',
        requiredPermissions: ['specialties.read'],
    },
    {
        pathPrefix: '/platform/admin/service-points',
        requiredPermissions: ['platform.resources.read'],
    },
    {
        pathPrefix: '/platform/admin/ward-beds',
        requiredPermissions: ['platform.resources.read'],
    },
    {
        pathPrefix: '/platform/admin/departments',
        requiredPermissions: ['departments.read'],
    },
    {
        pathPrefix: '/platform/admin/branding',
        requiredPermissions: ['platform.settings.manage-branding'],
    },
    {
        pathPrefix: '/platform/admin/users',
        requiredPermissions: ['platform.users.read'],
    },
    {
        pathPrefix: '/platform/admin/roles',
        requiredPermissions: ['platform.rbac.manage-roles'],
    },
    {
        pathPrefix: '/platform/admin/permissions',
        requiredPermissions: ['platform.rbac.manage-roles'],
    },
    {
        pathPrefix: '/staff-credentialing',
        requiredPermissions: ['staff.credentialing.read'],
    },
    {
        pathPrefix: '/staff-privileges',
        requiredPermissions: ['staff.privileges.read'],
    },
    {
        pathPrefix: '/staff',
        requiredPermissions: ['staff.read'],
    },
    {
        pathPrefix: '/billing-cash',
        requiredPermissions: ['billing.cash-accounts.read'],
    },
    {
        pathPrefix: '/pos',
        requiredPermissions: ['pos.registers.read'],
    },
    {
        pathPrefix: '/billing-refunds',
        requiredPermissions: ['billing.refunds.read'],
    },
    {
        pathPrefix: '/billing-discounts',
        requiredPermissions: ['billing.discounts.read'],
    },
    {
        pathPrefix: '/billing-financial-reports',
        requiredPermissions: ['billing.financial-controls.read'],
    },
    {
        pathPrefix: '/billing-payer-contracts',
        requiredPermissions: ['billing.payer-contracts.read'],
    },
    {
        pathPrefix: '/billing-service-catalog',
        requiredPermissions: ['billing.service-catalog.read'],
    },
    {
        pathPrefix: '/billing-invoices',
        requiredPermissions: ['billing.invoices.read'],
    },
    {
        pathPrefix: '/claims-insurance',
        requiredPermissions: ['claims.insurance.read'],
    },
    {
        pathPrefix: '/inventory-procurement',
        requiredPermissions: ['inventory.procurement.read'],
    },
    {
        pathPrefix: '/medical-records',
        requiredPermissions: ['medical.records.read'],
    },
    {
        pathPrefix: '/emergency-triage',
        requiredPermissions: ['emergency.triage.read'],
    },
    {
        pathPrefix: '/inpatient-ward',
        requiredPermissions: ['inpatient.ward.read'],
    },
    {
        pathPrefix: '/theatre-procedures',
        requiredPermissions: ['theatre.procedures.read'],
    },
    {
        pathPrefix: '/laboratory-orders',
        requiredPermissions: ['laboratory.orders.read'],
    },
    {
        pathPrefix: '/pharmacy-orders',
        requiredPermissions: ['pharmacy.orders.read'],
    },
    {
        pathPrefix: '/radiology-orders',
        requiredPermissions: ['radiology.orders.read'],
    },
    {
        pathPrefix: '/patients',
        requiredPermissions: ['patients.read'],
    },
    {
        pathPrefix: '/appointments',
        requiredPermissions: ['appointments.read'],
    },
    {
        pathPrefix: '/admissions',
        requiredPermissions: ['admissions.read'],
    },
];

function normalizePath(href: string): string {
    const trimmed = String(href ?? '').trim();
    if (trimmed === '') return '';

    const pathOnly = trimmed.split('#', 1)[0]?.split('?', 1)[0] ?? '';

    return pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
}

export function matchingRouteAccessRule(href: string): RouteAccessRule | undefined {
    const path = normalizePath(href);
    if (path === '') {
        return undefined;
    }

    const matches = routeAccessRules.filter(
        (rule) => path === rule.pathPrefix || path.startsWith(`${rule.pathPrefix}/`),
    );

    matches.sort((left, right) => right.pathPrefix.length - left.pathPrefix.length);

    return matches[0];
}

export function permissionsForHref(href: string): string[] {
    return matchingRouteAccessRule(href)?.requiredPermissions ?? [];
}

function permissionMatchesPrefixRule(userPermission: string, rule: string): boolean {
    if (rule.endsWith('.')) {
        return userPermission.startsWith(rule);
    }

    return userPermission === rule;
}

/**
 * Sidebar catalog items declare coarse permissionPrefixes; routes also have explicit guards in routeAccessRules.
 * Explicit rules win; prefixes only apply when no route rule matched (avoids leaking items like branding).
 */
function grantedEntitlementSet(facilityEntitlementNames: readonly string[] | null | undefined): ReadonlySet<string> {
    const raw = facilityEntitlementNames ?? [];
    return new Set(raw.map((k) => String(k).trim().toLowerCase()).filter(Boolean));
}

export function sidebarNavCatalogItemVisible(
    item: { href: string; permissionPrefixes: readonly string[] },
    permissionNames: readonly string[],
    facilityEntitlementNames?: readonly string[] | null,
): boolean {
    const explicit = permissionsForHref(item.href);

    let permissionOk: boolean;
    if (explicit.length > 0) {
        permissionOk = explicit.some((permission) => permissionNames.includes(permission));
    } else if (item.permissionPrefixes.length === 0) {
        permissionOk = false;
    } else {
        permissionOk = item.permissionPrefixes.some((rule) =>
            permissionNames.some((perm) => permissionMatchesPrefixRule(perm, rule)),
        );
    }

    if (!permissionOk) {
        return false;
    }

    if (facilityEntitlementNames === undefined) {
        return true;
    }

    const path = normalizeAppPath(item.href);
    return facilityEntitlementsSatisfied(path, grantedEntitlementSet(facilityEntitlementNames));
}

export function filterSidebarNavCatalogItems<
    T extends { href: string; permissionPrefixes: readonly string[] },
>(
    items: T[],
    permissionNames: readonly string[] | null | undefined,
    hasUnrestrictedAccess = false,
    facilityEntitlementNames?: readonly string[] | null,
): T[] {
    if (hasUnrestrictedAccess) {
        return items.slice();
    }

    const perms = permissionNames ?? [];

    return items.filter((entry) => sidebarNavCatalogItemVisible(entry, perms, facilityEntitlementNames));
}

export function hasRouteAccess(
    href: string,
    permissionNames: string[] | null | undefined,
    hasUnrestrictedAccess = false,
    facilityEntitlementNames?: readonly string[] | null,
): boolean {
    if (hasUnrestrictedAccess) {
        return true;
    }

    const perms = permissionNames ?? [];

    const requiredPermissions = permissionsForHref(href);
    const permissionOk =
        requiredPermissions.length === 0
            ? true
            : requiredPermissions.some((permission) => perms.includes(permission));

    if (!permissionOk) {
        return false;
    }

    if (facilityEntitlementNames === undefined) {
        return true;
    }

    const path = normalizeAppPath(href);
    return facilityEntitlementsSatisfied(path, grantedEntitlementSet(facilityEntitlementNames));
}

export function filterItemsByRouteAccess<T extends { href: string }>(
    items: T[],
    permissionNames: string[] | null | undefined,
    hasUnrestrictedAccess = false,
    facilityEntitlementNames?: readonly string[] | null,
): T[] {
    return items.filter((item) =>
        hasRouteAccess(item.href, permissionNames, hasUnrestrictedAccess, facilityEntitlementNames),
    );
}

/** When a link is hidden by RBAC vs missing plan SKU (for tooltips / diagnostics). */
export function routeAccessDenialReason(
    href: string,
    permissionNames: readonly string[] | null | undefined,
    facilityEntitlementNames: readonly string[] | null | undefined,
): 'permission' | 'plan' | null {
    const perms = permissionNames ?? [];
    const requiredPermissions = permissionsForHref(href);
    const permissionOk =
        requiredPermissions.length === 0
            ? true
            : requiredPermissions.some((permission) => perms.includes(permission));
    if (!permissionOk) {
        return 'permission';
    }
    const path = normalizeAppPath(href);
    const req = pathEntitlementRequirement(path);
    if (req === null) {
        return null;
    }
    const set = grantedEntitlementSet(facilityEntitlementNames);
    const planOk =
        req.type === 'all'
            ? req.keys.every((k) => set.has(k))
            : req.keys.some((k) => set.has(k));
    return planOk ? null : 'plan';
}
