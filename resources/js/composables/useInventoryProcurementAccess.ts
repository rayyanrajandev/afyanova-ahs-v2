import { ref } from 'vue';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { apiRequestJson } from '@/lib/apiClient';

export function useInventoryProcurementAccess() {
    const { permissionNames: sharedPermissionNames, isFacilitySuperAdmin } = usePlatformAccess();

    const canRead = ref(false);
    const canManageItems = ref(false);
    const canCreateMovement = ref(false);
    const canSetOpeningStock = ref(false);
    const canReconcileStock = ref(false);
    const canCreateRequest = ref(false);
    const canUpdateRequestStatus = ref(false);
    const canViewAudit = ref(false);
    const canManageSuppliers = ref(false);
    const canManageWarehouses = ref(false);
    const permissionsLoaded = ref(false);

    function apply(names: Iterable<string>, hasSuperAdmin: boolean): void {
        const set = new Set(
            Array.from(names)
                .map((name) => String(name ?? '').trim())
                .filter((name) => name.length > 0),
        );

        canRead.value = hasSuperAdmin || set.has('inventory.procurement.read');
        canManageItems.value = hasSuperAdmin || set.has('inventory.procurement.manage-items');
        canCreateMovement.value = hasSuperAdmin || set.has('inventory.procurement.create-movement');
        canSetOpeningStock.value = hasSuperAdmin || set.has('inventory.procurement.set-opening-stock');
        canReconcileStock.value = hasSuperAdmin
            || set.has('inventory.procurement.reconcile-stock')
            || set.has('inventory.procurement.create-movement');
        canCreateRequest.value = hasSuperAdmin || set.has('inventory.procurement.create-request');
        canUpdateRequestStatus.value = hasSuperAdmin || set.has('inventory.procurement.update-request-status');
        canViewAudit.value = hasSuperAdmin || set.has('inventory.procurement.view-audit-logs');
        canManageSuppliers.value = hasSuperAdmin || set.has('inventory.procurement.manage-suppliers');
        canManageWarehouses.value = hasSuperAdmin || set.has('inventory.procurement.manage-warehouses');
    }

    async function loadPermissions(): Promise<void> {
        apply(sharedPermissionNames.value ?? [], isFacilitySuperAdmin.value);

        try {
            const response = await apiRequestJson<{ data?: Array<{ name?: string }> }>('GET', '/auth/me/permissions');
            apply(
                (response.data ?? []).map((item) => item.name ?? ''),
                isFacilitySuperAdmin.value,
            );
        } catch {
            apply(sharedPermissionNames.value ?? [], isFacilitySuperAdmin.value);
        } finally {
            permissionsLoaded.value = true;
        }
    }

    return {
        canRead,
        canManageItems,
        canCreateMovement,
        canSetOpeningStock,
        canReconcileStock,
        canCreateRequest,
        canUpdateRequestStatus,
        canViewAudit,
        canManageSuppliers,
        canManageWarehouses,
        permissionsLoaded,
        loadPermissions,
    };
}
