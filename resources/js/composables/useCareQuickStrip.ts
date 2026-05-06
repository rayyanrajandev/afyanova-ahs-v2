import { computed } from 'vue';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import type { AppIconName } from '@/lib/icons';
import { hasRouteAccess } from '@/lib/routeAccess';

export type CareQuickLink = {
    label: string;
    href: string;
    icon: AppIconName;
};

/**
 * Sticky fast paths for common care workflows.
 * Links are filtered by RBAC + facility plan entitlements.
 */
export function useCareQuickStrip() {
    const { permissionNames, facilityEntitlementNames, hasUniversalAdminAccess } = usePlatformAccess();

    const todayIso = () => new Date().toISOString().slice(0, 10);

    const quickLinks = computed<CareQuickLink[]>(() => {
        const perms = permissionNames.value ?? [];
        const ents = facilityEntitlementNames.value;
        const un = hasUniversalAdminAccess.value;
        const day = todayIso();
        const out: CareQuickLink[] = [];

        const push = (label: string, href: string, icon: AppIconName) => {
            if (hasRouteAccess(href, perms, un, ents)) {
                out.push({ label, href, icon });
            }
        };

        push('Patients', '/patients', 'users');
        push('Appointments', `/appointments?view=queue&from=${day}`, 'calendar-clock');
        push('Admissions', '/admissions?view=queue', 'bed-double');
        push('Ward', '/inpatient-ward', 'clipboard-list');

        return out;
    });

    const hasLinks = computed(() => quickLinks.value.length > 0);
    const showStrip = computed(() => hasLinks.value);

    return { showStrip, quickLinks, hasLinks };
}
