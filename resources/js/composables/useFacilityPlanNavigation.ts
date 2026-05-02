import { computed } from 'vue';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import {
    facilityEntitlementsSatisfied,
    formatEntitlementLabel,
    normalizeAppPath,
    pathEntitlementRequirement,
} from '@/config/facilityPageEntitlements';

/**
 * Plan-aware navigation helpers: RBAC is separate; this layer reflects the active facility subscription SKU.
 */
export function useFacilityPlanNavigation() {
    const { facilityEntitlementNames, hasUniversalAdminAccess } = usePlatformAccess();

    const grantedSet = computed(() => new Set(facilityEntitlementNames.value.map((k) => String(k).trim().toLowerCase())));

    function canAccessAppPath(href: string): boolean {
        if (hasUniversalAdminAccess.value) return true;
        return facilityEntitlementsSatisfied(normalizeAppPath(href), grantedSet.value);
    }

    function missingEntitlementsForPath(href: string): string[] {
        const req = pathEntitlementRequirement(normalizeAppPath(href));
        if (!req) return [];
        if (req.type === 'all') {
            return req.keys.filter((k) => !grantedSet.value.has(k));
        }
        const hasAny = req.keys.some((k) => grantedSet.value.has(k));
        if (hasAny) return [];
        return [...req.keys];
    }

    function missingEntitlementLabelsForPath(href: string): string[] {
        return missingEntitlementsForPath(href).map((k) => formatEntitlementLabel(k));
    }

    return {
        canAccessAppPath,
        missingEntitlementsForPath,
        missingEntitlementLabelsForPath,
    };
}
