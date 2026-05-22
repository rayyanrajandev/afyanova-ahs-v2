export type EncounterLifecycleTargetKind =
    | 'laboratory'
    | 'pharmacy'
    | 'radiology'
    | 'theatre';

export type EncounterLifecycleAction =
    | 'cancel'
    | 'discontinue'
    | 'entered_in_error';

type LifecycleEntry = {
    enteredInErrorAt?: string | null;
    lifecycleReasonCode?: string | null;
};

type LinkageEntry = {
    replacesOrderId?: string | null;
    addOnToOrderId?: string | null;
};

export function shortEncounterId(value: string | null | undefined): string {
    if (!value) return 'N/A';
    return value.length > 10 ? `${value.slice(0, 8)}...` : value;
}

export function encounterLifecycleLinkageText(
    entry: LinkageEntry,
    label: string,
): string | null {
    const replacesOrderId = String(entry.replacesOrderId ?? '').trim();
    if (replacesOrderId !== '') {
        return `Replacement for ${label} ${shortEncounterId(replacesOrderId)}.`;
    }

    const addOnToOrderId = String(entry.addOnToOrderId ?? '').trim();
    if (addOnToOrderId !== '') {
        return `Linked follow-up to ${label} ${shortEncounterId(addOnToOrderId)}.`;
    }

    return null;
}

export function isEncounterOrderEnteredInError(entry: LifecycleEntry | null): boolean {
    if (!entry) return false;

    return Boolean(
        String(entry.enteredInErrorAt ?? '').trim()
        || String(entry.lifecycleReasonCode ?? '').trim().toLowerCase() === 'entered_in_error',
    );
}

export function canApplyLaboratoryEncounterLifecycleAction(
    order: { status?: string | null } & LifecycleEntry | null,
    action: 'cancel' | 'entered_in_error',
    canCreate: boolean,
): boolean {
    if (!order || !canCreate || isEncounterOrderEnteredInError(order)) {
        return false;
    }

    if (action === 'cancel') {
        return order.status !== 'cancelled' && order.status !== 'completed';
    }

    return true;
}

export function canApplyPharmacyEncounterLifecycleAction(
    order: { status?: string | null; quantityDispensed?: string | number | null } & LifecycleEntry | null,
    action: 'cancel' | 'discontinue' | 'entered_in_error',
    canCreate: boolean,
): boolean {
    if (!order || !canCreate || isEncounterOrderEnteredInError(order)) {
        return false;
    }

    const quantityDispensed = Number(order.quantityDispensed ?? 0);
    if (action === 'cancel') {
        return order.status !== 'cancelled' && order.status !== 'dispensed' && quantityDispensed <= 0;
    }

    if (action === 'discontinue') {
        return order.status !== 'cancelled' && order.status !== 'dispensed';
    }

    return true;
}

export function canApplyRadiologyEncounterLifecycleAction(
    order: { status?: string | null } & LifecycleEntry | null,
    action: 'cancel' | 'entered_in_error',
    canCreate: boolean,
): boolean {
    if (!order || !canCreate || isEncounterOrderEnteredInError(order)) {
        return false;
    }

    if (action === 'cancel') {
        return order.status !== 'cancelled' && order.status !== 'completed';
    }

    return true;
}

export function canApplyTheatreEncounterLifecycleAction(
    procedure: { status?: string | null } & LifecycleEntry | null,
    action: 'cancel' | 'entered_in_error',
    canCreate: boolean,
): boolean {
    if (!procedure || !canCreate || isEncounterOrderEnteredInError(procedure)) {
        return false;
    }

    if (action === 'cancel') {
        return procedure.status !== 'cancelled' && procedure.status !== 'completed';
    }

    return true;
}

export function encounterLifecycleActionLabel(
    action: EncounterLifecycleAction | null,
): string {
    if (action === 'cancel') return 'Cancel';
    if (action === 'discontinue') return 'Discontinue';
    if (action === 'entered_in_error') return 'Mark Entered In Error';
    return 'Apply';
}

export function encounterLifecycleActionSuccessMessage(
    action: EncounterLifecycleAction | null,
): string {
    if (action === 'cancel') return 'Order cancelled.';
    if (action === 'discontinue') return 'Order discontinued.';
    if (action === 'entered_in_error') return 'Order marked entered in error.';
    return 'Lifecycle action applied.';
}

export function encounterLifecycleActionPath(
    kind: EncounterLifecycleTargetKind,
    id: string,
): string {
    if (kind === 'laboratory') return `/laboratory-orders/${id}/lifecycle`;
    if (kind === 'pharmacy') return `/pharmacy-orders/${id}/lifecycle`;
    if (kind === 'radiology') return `/radiology-orders/${id}/lifecycle`;
    return `/theatre-procedures/${id}/lifecycle`;
}
