import { computed } from 'vue';
import { usePage } from '@inertiajs/vue3';
import type { SharedPlatformContext, SharedPlatformScope } from '@/types';

export type PermissionState = 'unknown' | 'allowed' | 'denied';

const TENANT_SCOPE_COOKIE = 'platform_tenant_code';
const FACILITY_SCOPE_COOKIE = 'platform_facility_code';

type SharedAuthProps = {
    permissions?: string[];
    isFacilitySuperAdmin?: boolean;
};

type SharedPageProps = {
    auth?: SharedAuthProps;
    platform?: Partial<SharedPlatformContext> & {
        scope?: SharedPlatformScope;
    };
};

function cookieValue(name: string): string | null {
    if (typeof document === 'undefined') return null;

    const token = `${name}=`;
    const match = document.cookie
        .split(';')
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(token));

    if (!match) return null;
    const value = decodeURIComponent(match.slice(token.length)).trim();

    return value === '' ? null : value;
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

function clearCookie(name: string): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function setScopeCookies(tenantCode: string | null, facilityCode: string | null): void {
    const ttl = 60 * 60 * 24 * 30;

    if (tenantCode && tenantCode.trim() !== '') {
        setCookie(TENANT_SCOPE_COOKIE, tenantCode.trim().toUpperCase(), ttl);
    } else {
        clearCookie(TENANT_SCOPE_COOKIE);
    }

    if (facilityCode && facilityCode.trim() !== '') {
        setCookie(FACILITY_SCOPE_COOKIE, facilityCode.trim().toUpperCase(), ttl);
    } else {
        clearCookie(FACILITY_SCOPE_COOKIE);
    }
}

export function clearScopeCookies(): void {
    clearCookie(TENANT_SCOPE_COOKIE);
    clearCookie(FACILITY_SCOPE_COOKIE);
}

export function usePlatformAccess() {
    const page = usePage<SharedPageProps>();

    const permissionNames = computed<string[] | null>(() => {
        const candidate = page.props.auth?.permissions;
        if (!Array.isArray(candidate)) return null;

        return candidate
            .map((name) => String(name ?? '').trim())
            .filter((name) => name.length > 0);
    });

    const permissionSet = computed(() =>
        new Set(permissionNames.value ?? []),
    );

    const isFacilitySuperAdmin = computed<boolean>(() =>
        Boolean(page.props.auth?.isFacilitySuperAdmin),
    );

    const scope = computed<SharedPlatformScope>(
        () => page.props.platform?.scope ?? null,
    );

    const multiTenantIsolationEnabled = computed<boolean>(() =>
        Boolean(page.props.platform?.featureFlags?.multiTenantIsolation),
    );

    const multiFacilityScopingEnabled = computed<boolean>(() =>
        Boolean(page.props.platform?.featureFlags?.multiFacilityScoping),
    );

    const mail = computed(() => page.props.platform?.mail ?? null);

    const effectiveTenantCode = computed<string | null>(() => {
        const cookie = cookieValue(TENANT_SCOPE_COOKIE);
        if (cookie) return cookie;

        const headerCode = scope.value?.headers?.tenantCode;
        if (typeof headerCode === 'string' && headerCode.trim() !== '') {
            return headerCode.trim().toUpperCase();
        }

        const scopedCode = scope.value?.tenant?.code;
        if (typeof scopedCode === 'string' && scopedCode.trim() !== '') {
            return scopedCode.trim().toUpperCase();
        }

        return null;
    });

    const effectiveFacilityCode = computed<string | null>(() => {
        const cookie = cookieValue(FACILITY_SCOPE_COOKIE);
        if (cookie) return cookie;

        const headerCode = scope.value?.headers?.facilityCode;
        if (typeof headerCode === 'string' && headerCode.trim() !== '') {
            return headerCode.trim().toUpperCase();
        }

        const scopedCode = scope.value?.facility?.code;
        if (typeof scopedCode === 'string' && scopedCode.trim() !== '') {
            return scopedCode.trim().toUpperCase();
        }

        return null;
    });

    function permissionState(name: string): PermissionState {
        const normalized = name.trim();
        if (!normalized) return 'denied';
        if (isFacilitySuperAdmin.value) return 'allowed';
        if (!permissionNames.value) return 'unknown';
        return permissionSet.value.has(normalized) ? 'allowed' : 'denied';
    }

    function hasPermission(name: string): boolean {
        return permissionState(name) === 'allowed';
    }

    return {
        permissionNames,
        isFacilitySuperAdmin,
        permissionState,
        hasPermission,
        scope,
        multiTenantIsolationEnabled,
        multiFacilityScopingEnabled,
        mail,
        effectiveTenantCode,
        effectiveFacilityCode,
    };
}


