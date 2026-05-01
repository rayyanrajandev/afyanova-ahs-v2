import { computed } from 'vue';
import { usePlatformAccess } from './usePlatformAccess';
import { detectPrimaryRole, ROLE_LABELS, ROLE_DASHBOARD_ROUTES, MOBILE_FIRST_ROLES, DESKTOP_FIRST_ROLES, type HISRole } from '@/lib/roles';

/**
 * Composable for managing user roles and role-based context
 */
export function useUserRole() {
    const { permissionNames } = usePlatformAccess();

    /**
     * Detect primary role from permissions
     */
    const primaryRole = computed<HISRole | null>(() =>
        detectPrimaryRole(permissionNames.value),
    );

    /**
     * Get label for primary role
     */
    const primaryRoleLabel = computed<string>(() =>
        primaryRole.value ? ROLE_LABELS[primaryRole.value] : 'Guest',
    );

    /**
     * Get dashboard route for primary role
     */
    const dashboardRoute = computed<string>(() =>
        primaryRole.value ? ROLE_DASHBOARD_ROUTES[primaryRole.value] : '/dashboard',
    );

    /**
     * Check if role is mobile-first (clinical)
     */
    const isMobileFirst = computed<boolean>(() =>
        primaryRole.value ? MOBILE_FIRST_ROLES.has(primaryRole.value) : false,
    );

    /**
     * Check if role is desktop-first (admin)
     */
    const isDesktopFirst = computed<boolean>(() =>
        primaryRole.value ? DESKTOP_FIRST_ROLES.has(primaryRole.value) : false,
    );

    /**
     * Check if user is clinical role
     */
    const isClinicalRole = computed<boolean>(() => {
        if (!primaryRole.value) return false;
        const clinicalRoles = ['registration_clerk', 'nurse', 'doctor', 'lab_technician', 'radiologist'];
        return clinicalRoles.includes(primaryRole.value);
    });

    /**
     * Check if user is administrative role
     */
    const isAdministrativeRole = computed<boolean>(() => {
        if (!primaryRole.value) return false;
        const adminRoles = ['ward_manager', 'billing_officer', 'it_admin', 'hospital_admin', 'executive'];
        return adminRoles.includes(primaryRole.value);
    });

    return {
        primaryRole,
        primaryRoleLabel,
        dashboardRoute,
        isMobileFirst,
        isDesktopFirst,
        isClinicalRole,
        isAdministrativeRole,
    };
}
