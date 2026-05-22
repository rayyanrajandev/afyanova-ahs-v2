import { formatEnumLabel } from '@/lib/labels';

export type EncounterOrderProgressStep = {
    key: string;
    label: string;
    detail: string | null;
    state: 'complete' | 'current' | 'upcoming' | 'cancelled';
};

type TimestampedOrder = {
    status?: string | null;
    orderedAt?: string | null;
    resultedAt?: string | null;
    dispensedAt?: string | null;
    completedAt?: string | null;
    enteredInErrorAt?: string | null;
    resultSummary?: string | null;
    reportSummary?: string | null;
};

type TheatreProcedureProgressOrder = {
    status?: string | null;
    scheduledAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    enteredInErrorAt?: string | null;
    theatreRoomName?: string | null;
    notes?: string | null;
};

function normalizeStatus(status?: string | null): string {
    return (status ?? '').trim().toLowerCase();
}

function formatTimestamp(value?: string | null): string | null {
    const normalized = (value ?? '').trim();
    return normalized || null;
}

function isTerminalCancelledStatus(status: string): boolean {
    return status === 'cancelled' || status === 'entered_in_error';
}

function stepState(options: {
    index: number;
    currentIndex: number;
    cancelled: boolean;
}): EncounterOrderProgressStep['state'] {
    if (options.cancelled && options.index > options.currentIndex) {
        return 'cancelled';
    }
    if (options.index < options.currentIndex) return 'complete';
    if (options.index === options.currentIndex) return 'current';
    return 'upcoming';
}

export function encounterOrderResultPreview(
    orderType: 'laboratory' | 'pharmacy' | 'radiology' | 'theatre',
    order: TimestampedOrder & TheatreProcedureProgressOrder,
): string | null {
    if (orderType === 'laboratory') {
        return (order.resultSummary ?? '').trim() || null;
    }

    if (orderType === 'radiology') {
        return (order.reportSummary ?? '').trim() || null;
    }

    if (orderType === 'theatre') {
        const notes = (order.notes ?? '').trim();
        if (notes) {
            return notes;
        }

        const room = (order.theatreRoomName ?? '').trim();
        if (room && normalizeStatus(order.status) === 'completed') {
            return `Completed in ${room}`;
        }

        return null;
    }

    return null;
}

export function buildLaboratoryOrderProgressSteps(
    order: TimestampedOrder,
    formatDateTime: (value: string | null | undefined) => string,
): EncounterOrderProgressStep[] {
    const status = normalizeStatus(order.status);
    const cancelled = isTerminalCancelledStatus(status);
    const resultedAt = formatTimestamp(order.resultedAt);
    const orderedAt = formatTimestamp(order.orderedAt);
    const currentIndex = resultedAt
        ? 2
        : status === 'completed' || status === 'resulted'
          ? 2
          : status === 'in_progress' || status === 'collected'
            ? 1
            : 0;

    return [
        {
            key: 'ordered',
            label: 'Ordered',
            detail: orderedAt ? formatDateTime(orderedAt) : null,
            state: stepState({ index: 0, currentIndex, cancelled }),
        },
        {
            key: 'processing',
            label: 'Processing',
            detail:
                status && !['ordered', 'completed', 'resulted'].includes(status)
                    ? formatEnumLabel(status)
                    : null,
            state: stepState({ index: 1, currentIndex, cancelled }),
        },
        {
            key: 'resulted',
            label: 'Result available',
            detail: resultedAt ? formatDateTime(resultedAt) : null,
            state: stepState({ index: 2, currentIndex, cancelled }),
        },
    ];
}

export function buildPharmacyOrderProgressSteps(
    order: TimestampedOrder,
    formatDateTime: (value: string | null | undefined) => string,
): EncounterOrderProgressStep[] {
    const status = normalizeStatus(order.status);
    const cancelled = isTerminalCancelledStatus(status);
    const dispensedAt = formatTimestamp(order.dispensedAt);
    const orderedAt = formatTimestamp(order.orderedAt);
    const currentIndex = dispensedAt
        ? 2
        : ['dispensed', 'completed'].includes(status)
          ? 2
          : ['preparing', 'ready', 'in_progress'].includes(status)
            ? 1
            : 0;

    return [
        {
            key: 'ordered',
            label: 'Prescribed',
            detail: orderedAt ? formatDateTime(orderedAt) : null,
            state: stepState({ index: 0, currentIndex, cancelled }),
        },
        {
            key: 'preparing',
            label: 'Pharmacy prep',
            detail:
                status && !['ordered', 'dispensed', 'completed'].includes(status)
                    ? formatEnumLabel(status)
                    : null,
            state: stepState({ index: 1, currentIndex, cancelled }),
        },
        {
            key: 'dispensed',
            label: 'Dispensed',
            detail: dispensedAt ? formatDateTime(dispensedAt) : null,
            state: stepState({ index: 2, currentIndex, cancelled }),
        },
    ];
}

export function buildTheatreProcedureProgressSteps(
    order: TheatreProcedureProgressOrder,
    formatDateTime: (value: string | null | undefined) => string,
): EncounterOrderProgressStep[] {
    const status = normalizeStatus(order.status);
    const cancelled =
        isTerminalCancelledStatus(status) ||
        Boolean(formatTimestamp(order.enteredInErrorAt));
    const scheduledAt = formatTimestamp(order.scheduledAt);
    const startedAt = formatTimestamp(order.startedAt);
    const completedAt = formatTimestamp(order.completedAt);

    const currentIndex = completedAt || status === 'completed'
        ? 3
        : status === 'in_progress' || startedAt
          ? 2
          : status === 'in_preop'
            ? 1
            : cancelled && startedAt
              ? 2
              : cancelled && scheduledAt
                ? 0
                : 0;

    return [
        {
            key: 'booked',
            label: 'Booked',
            detail: scheduledAt ? formatDateTime(scheduledAt) : null,
            state: stepState({ index: 0, currentIndex, cancelled }),
        },
        {
            key: 'preop',
            label: 'Pre-op',
            detail: status === 'in_preop' ? formatEnumLabel(status) : null,
            state: stepState({ index: 1, currentIndex, cancelled }),
        },
        {
            key: 'in_theatre',
            label: 'In theatre',
            detail: startedAt ? formatDateTime(startedAt) : null,
            state: stepState({ index: 2, currentIndex, cancelled }),
        },
        {
            key: 'completed',
            label: 'Completed',
            detail: completedAt ? formatDateTime(completedAt) : null,
            state: stepState({ index: 3, currentIndex, cancelled }),
        },
    ];
}

export function buildRadiologyOrderProgressSteps(
    order: TimestampedOrder,
    formatDateTime: (value: string | null | undefined) => string,
): EncounterOrderProgressStep[] {
    const status = normalizeStatus(order.status);
    const cancelled = isTerminalCancelledStatus(status);
    const completedAt = formatTimestamp(order.completedAt);
    const orderedAt = formatTimestamp(order.orderedAt);
    const currentIndex = completedAt
        ? 2
        : status === 'completed'
          ? 2
          : ['scheduled', 'in_progress'].includes(status)
            ? 1
            : 0;

    return [
        {
            key: 'ordered',
            label: 'Ordered',
            detail: orderedAt ? formatDateTime(orderedAt) : null,
            state: stepState({ index: 0, currentIndex, cancelled }),
        },
        {
            key: 'imaging',
            label: 'Imaging',
            detail:
                status && !['ordered', 'completed'].includes(status)
                    ? formatEnumLabel(status)
                    : null,
            state: stepState({ index: 1, currentIndex, cancelled }),
        },
        {
            key: 'reported',
            label: 'Reported',
            detail: completedAt ? formatDateTime(completedAt) : null,
            state: stepState({ index: 2, currentIndex, cancelled }),
        },
    ];
}
