import {
    inventoryWorkspaceSections,
    type InventoryWorkspaceSection,
} from '@/lib/inventoryProcurement';

export type InventoryProcurementAccess = {
    canRead: boolean;
    canManageItems: boolean;
    canCreateMovement: boolean;
    canReconcileStock: boolean;
    canCreateRequest: boolean;
    canUpdateRequestStatus: boolean;
    canViewAudit: boolean;
    canApproveRequisitions: boolean;
    canManageSuppliers: boolean;
    canManageWarehouses: boolean;
};

/** Storekeepers, inventory officers, and facility admins — full operational workspace. */
export function isInventoryStoreOperations(access: InventoryProcurementAccess): boolean {
    return access.canCreateMovement
        || access.canReconcileStock
        || access.canManageItems
        || access.canUpdateRequestStatus
        || access.canManageSuppliers
        || access.canManageWarehouses;
}

/** Clinical / lab / ward users who request stock but do not run the central store. */
export function isInventoryDepartmentRequester(access: InventoryProcurementAccess): boolean {
    return access.canRead
        && access.canCreateRequest
        && !isInventoryStoreOperations(access);
}

export function visibleInventoryWorkspaceSections(
    access: InventoryProcurementAccess,
): InventoryWorkspaceSection[] {
    if (!access.canRead) {
        return [];
    }

    if (isInventoryStoreOperations(access)) {
        return [...inventoryWorkspaceSections];
    }

    const sections: InventoryWorkspaceSection[] = [];

    if (access.canCreateRequest) {
        sections.push('requisitions', 'procurement', 'msd-orders');
    }

    sections.push('inventory', 'department-stock');

    return sections;
}

export function defaultInventoryWorkspaceSection(
    access: InventoryProcurementAccess,
): InventoryWorkspaceSection {
    const visible = visibleInventoryWorkspaceSections(access);

    if (isInventoryDepartmentRequester(access) && visible.includes('requisitions')) {
        return 'requisitions';
    }

    if (isInventoryStoreOperations(access) && visible.includes('overview')) {
        return 'overview';
    }

    return visible[0] ?? 'requisitions';
}

export function canAccessInventoryWorkspaceSection(
    access: InventoryProcurementAccess,
    section: InventoryWorkspaceSection,
): boolean {
    return visibleInventoryWorkspaceSections(access).includes(section);
}
