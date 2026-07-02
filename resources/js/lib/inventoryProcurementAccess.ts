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

/** Storekeepers, inventory officers, and facility admins — full operational supply chain surface. */
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
