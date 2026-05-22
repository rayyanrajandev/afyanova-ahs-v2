import { formatEnumLabel } from '@/lib/labels';

export type EncounterCareState = 'loading' | 'active' | 'issue' | 'empty';

export type CreateEncounterCareSectionId =
    | 'laboratory-orders'
    | 'pharmacy-orders'
    | 'radiology-orders'
    | 'theatre-procedures';

export type CreateEncounterCareSummary = {
    id: CreateEncounterCareSectionId;
    label: string;
    singularLabel: string;
    pluralLabel: string;
    description: string;
    icon: string;
    count: number;
    state: EncounterCareState;
};

export type EncounterCareLaboratoryOrder = {
    id: string;
    orderNumber: string | null;
    orderedAt: string | null;
    testName: string | null;
    priority: string | null;
    resultSummary: string | null;
    resultedAt: string | null;
    status: string | null;
    statusReason: string | null;
    replacesOrderId?: string | null;
    addOnToOrderId?: string | null;
};

export type EncounterCarePharmacyOrder = {
    id: string;
    orderNumber: string | null;
    orderedAt: string | null;
    medicationName: string | null;
    dosageInstruction: string | null;
    quantityPrescribed: string | number | null;
    quantityDispensed?: string | number | null;
    dispensedAt: string | null;
    status: string | null;
    statusReason: string | null;
    replacesOrderId?: string | null;
    addOnToOrderId?: string | null;
};

export type EncounterCareRadiologyOrder = {
    id: string;
    orderNumber: string | null;
    orderedAt: string | null;
    modality?: string | null;
    studyDescription: string | null;
    reportSummary?: string | null;
    completedAt?: string | null;
    status: string | null;
    statusReason: string | null;
    replacesOrderId?: string | null;
    addOnToOrderId?: string | null;
};

export type EncounterCareTheatreProcedure = {
    id: string;
    procedureNumber: string | null;
    procedureType: string | null;
    procedureName: string | null;
    theatreRoomName: string | null;
    scheduledAt: string | null;
    startedAt?: string | null;
    completedAt: string | null;
    status: string | null;
    statusReason: string | null;
    notes: string | null;
    replacesOrderId?: string | null;
    addOnToOrderId?: string | null;
};

type DateTimeFormatter = (value: string | null | undefined) => string;

export function encounterCareState(
    count: number,
    loading: boolean,
    error?: string | null,
): EncounterCareState {
    if (loading) return 'loading';
    if (error) return 'issue';
    if (count > 0) return 'active';
    return 'empty';
}

export function encounterCareStateLabel(state: EncounterCareState): string {
    switch (state) {
        case 'loading':
            return 'Loading';
        case 'active':
            return 'Has records';
        case 'issue':
            return 'Issue';
        default:
            return 'Empty';
    }
}

export function encounterCareStateVariant(
    state: EncounterCareState,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (state) {
        case 'active':
            return 'secondary';
        case 'issue':
            return 'destructive';
        case 'loading':
            return 'outline';
        default:
            return 'outline';
    }
}

export function laboratoryOrderStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'ordered':
        case 'collected':
        case 'in_progress':
            return 'default';
        case 'completed':
            return 'secondary';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

export function pharmacyOrderStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'pending':
        case 'in_preparation':
        case 'partially_dispensed':
            return 'default';
        case 'dispensed':
        case 'reconciliation_completed':
            return 'secondary';
        case 'cancelled':
        case 'reconciliation_exception':
            return 'destructive';
        default:
            return 'outline';
    }
}

export function radiologyOrderStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'ordered':
        case 'scheduled':
        case 'in_progress':
            return 'default';
        case 'completed':
            return 'secondary';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

export function theatreProcedureStatusVariant(status: string | null | undefined) {
    switch ((status ?? '').toLowerCase()) {
        case 'planned':
        case 'in_preop':
        case 'in_progress':
            return 'default';
        case 'completed':
            return 'secondary';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

export function laboratoryOrderSummaryText(
    order: EncounterCareLaboratoryOrder,
    formatDateTime: DateTimeFormatter,
): string {
    if ((order.resultSummary ?? '').trim() !== '') {
        const resultedAt = (order.resultedAt ?? '').trim();
        if (resultedAt !== '') {
            return `${order.resultSummary} · Resulted ${formatDateTime(resultedAt)}`;
        }

        return order.resultSummary as string;
    }

    if ((order.priority ?? '').trim() !== '') {
        return `Priority: ${formatEnumLabel(order.priority)}`;
    }

    return 'Awaiting collection or processing.';
}

export function pharmacyOrderSummaryText(
    order: EncounterCarePharmacyOrder,
    formatDateTime: DateTimeFormatter,
): string {
    if ((order.dosageInstruction ?? '').trim() !== '') {
        return order.dosageInstruction as string;
    }

    if ((order.dispensedAt ?? '').trim() !== '') {
        return `Dispensed ${formatDateTime(order.dispensedAt)}`;
    }

    return 'Awaiting pharmacy preparation.';
}

export function pharmacyOrderQuantityLabel(
    quantity: string | number | null | undefined,
): string | null {
    if (quantity === null || quantity === undefined) return null;

    const normalized = String(quantity).trim();
    if (normalized === '') return null;

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return `Qty ${normalized}`;

    return `Qty ${Number.isInteger(parsed) ? parsed.toString() : parsed.toString()}`;
}

export function radiologyOrderSummaryText(
    order: EncounterCareRadiologyOrder,
    formatDateTime: DateTimeFormatter,
): string {
    if ((order.reportSummary ?? '').trim() !== '') {
        return order.reportSummary as string;
    }

    if ((order.modality ?? '').trim() !== '') {
        return `Modality: ${formatEnumLabel(order.modality)}`;
    }

    if ((order.completedAt ?? '').trim() !== '') {
        return `Reported ${formatDateTime(order.completedAt)}`;
    }

    return 'Awaiting imaging scheduling or execution.';
}

export function theatreProcedureSummaryText(
    procedure: EncounterCareTheatreProcedure,
    formatDateTime: DateTimeFormatter,
): string {
    if ((procedure.statusReason ?? '').trim() !== '') {
        return procedure.statusReason as string;
    }

    if ((procedure.notes ?? '').trim() !== '') {
        return procedure.notes as string;
    }

    if ((procedure.theatreRoomName ?? '').trim() !== '') {
        return `Room: ${procedure.theatreRoomName}`;
    }

    if ((procedure.completedAt ?? '').trim() !== '') {
        return `Completed ${formatDateTime(procedure.completedAt)}`;
    }

    return 'Awaiting theatre scheduling and procedure progression.';
}
