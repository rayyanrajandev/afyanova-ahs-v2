export type DepartmentRequisitionContext = {
    canSelectAnyDepartment: boolean;
    lockedDepartment: { id: string; name: string; code: string | null } | null;
    staffDepartmentName: string | null;
};

export function departmentDisplayName(context: DepartmentRequisitionContext | null | undefined): string | null {
    const locked = context?.lockedDepartment;
    if (locked?.name?.trim()) {
        return locked.name.trim();
    }

    const staffName = context?.staffDepartmentName?.trim();
    if (staffName) {
        return staffName;
    }

    return null;
}

export function departmentCardDescription(context: DepartmentRequisitionContext | null | undefined): string {
    const locked = context?.lockedDepartment;
    if (locked?.name) {
        const code = locked.code?.trim();
        if (code) {
            return `Requisitions and item lookup for ${locked.name} (${code}).`;
        }

        return `Requisitions and item lookup for ${locked.name}.`;
    }

    if (context?.staffDepartmentName?.trim()) {
        return 'Your staff profile department is not linked to the department registry yet. Ask an administrator to align it.';
    }

    return 'Requisitions and item lookup for your assigned unit.';
}

export function departmentRequesterHeaderDescription(
    context: DepartmentRequisitionContext | null | undefined,
): string {
    const name = departmentDisplayName(context);
    if (name) {
        return `Request supplies for ${name} — browse items, raise requisitions, and track procurement.`;
    }

    return 'Request department supplies — browse items, raise requisitions, and track procurement.';
}
