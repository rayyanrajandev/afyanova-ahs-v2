import { formatEnumLabel } from '@/lib/labels';

export type DirectServiceModuleKey = 'radiology' | 'laboratory' | 'pharmacy' | 'clinical_procedure';

export type EmbeddedPatientSummary = {
    id?: string | null;
    patientNumber?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    phone?: string | null;
};

export type DirectServiceOrderLike = {
    id?: string | null;
    patientId?: string | null;
    patient?: EmbeddedPatientSummary | null;
    orderedBy?: { id?: number | string | null; name?: string | null } | null;
    orderNumber?: string | null;
    status?: string | null;
    orderedAt?: string | null;
    studyDescription?: string | null;
    procedureCode?: string | null;
    procedureDescription?: string | null;
    modality?: string | null;
    testCode?: string | null;
    testName?: string | null;
    medicationCode?: string | null;
    medicationName?: string | null;
    priority?: string | null;
};

export type PatientOrderGroup<T extends DirectServiceOrderLike = DirectServiceOrderLike> = {
    patientId: string;
    patientLabel: string;
    patientMeta: string;
    orders: T[];
    summarySubtitle: string;
    summaryMeta: string;
    summaryStatus: string;
    searchHaystack: string;
};

const OPEN_STATUS_PRIORITY: Record<DirectServiceModuleKey, Record<string, number>> = {
    radiology: {
        ordered: 1,
        scheduled: 2,
        in_progress: 3,
    },
    laboratory: {
        ordered: 1,
        collected: 2,
        in_progress: 3,
    },
    pharmacy: {
        pending: 1,
        in_preparation: 2,
        partially_dispensed: 3,
    },
    clinical_procedure: {
        ordered: 1,
        scheduled: 2,
        in_progress: 3,
    },
};

export function embeddedPatientSummary(order: DirectServiceOrderLike): EmbeddedPatientSummary | null {
    const patient = order.patient;
    if (!patient) {
        return null;
    }

    const hasContent = [
        patient.firstName,
        patient.middleName,
        patient.lastName,
        patient.patientNumber,
        patient.phone,
    ].some((value) => String(value ?? '').trim() !== '');

    return hasContent ? patient : null;
}

export function patientLabelFromOrder(order: DirectServiceOrderLike, fallbackPatientId?: string): string {
    const embedded = embeddedPatientSummary(order);
    if (embedded) {
        const fullName = [embedded.firstName, embedded.middleName, embedded.lastName]
            .filter(Boolean)
            .join(' ')
            .trim();
        if (fullName) {
            return fullName;
        }
        if (embedded.patientNumber) {
            return String(embedded.patientNumber).trim();
        }
    }

    const patientId = String(fallbackPatientId ?? order.patientId ?? '').trim();
    return patientId !== '' ? `Patient ${patientId.slice(0, 8)}` : 'Unknown patient';
}

export function patientMetaFromOrder(order: DirectServiceOrderLike): string {
    const embedded = embeddedPatientSummary(order);
    if (!embedded) {
        return '';
    }

    return [embedded.patientNumber, embedded.phone].filter(Boolean).join(' | ');
}

export function directServicePatientWorklistHref(
    moduleKey: DirectServiceModuleKey,
    patientId: string,
): string {
    const base =
        moduleKey === 'radiology'
            ? '/radiology-orders'
            : moduleKey === 'laboratory'
                ? '/laboratory-orders'
                : moduleKey === 'clinical_procedure'
                    ? '/clinical-procedure-orders'
                    : '/pharmacy-orders';

    const params = new URLSearchParams({
        patientId,
        worklistScope: 'open',
        groupByPatient: '1',
    });

    return `${base}?${params.toString()}`;
}

function orderDetailLabel(order: DirectServiceOrderLike, moduleKey: DirectServiceModuleKey): string {
    if (moduleKey === 'radiology') {
        return (
            String(order.studyDescription ?? order.procedureCode ?? order.modality ?? '').trim()
            || 'Imaging study'
        );
    }

    if (moduleKey === 'laboratory') {
        const code = String(order.testCode ?? '').trim();
        const name = String(order.testName ?? '').trim();
        if (code && name) return `${code} - ${name}`;
        return name || code || 'Laboratory test';
    }

    if (moduleKey === 'clinical_procedure') {
        const code = String(order.procedureCode ?? '').trim();
        const name = String(order.procedureDescription ?? '').trim();
        if (code && name) return `${code} - ${name}`;
        return name || code || 'Clinical procedure';
    }

    const code = String(order.medicationCode ?? '').trim();
    const name = String(order.medicationName ?? '').trim();
    if (code && name) return `${code} - ${name}`;
    return name || code || 'Medication order';
}

function statusRank(status: string, moduleKey: DirectServiceModuleKey): number {
    return OPEN_STATUS_PRIORITY[moduleKey][status.toLowerCase()] ?? 99;
}

function worstStatus(orders: DirectServiceOrderLike[], moduleKey: DirectServiceModuleKey): string {
    const sorted = orders
        .map((order) => String(order.status ?? '').trim().toLowerCase())
        .filter(Boolean)
        .sort((left, right) => statusRank(left, moduleKey) - statusRank(right, moduleKey));

    return sorted[0] ?? 'ordered';
}

function earliestOrderedAt(orders: DirectServiceOrderLike[]): string | null {
    const timestamps = orders
        .map((order) => order.orderedAt)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());

    return timestamps[0] ?? null;
}

function uniqueOrderDetailPreview(orders: DirectServiceOrderLike[], moduleKey: DirectServiceModuleKey): string[] {
    const seen = new Set<string>();
    const labels: string[] = [];

    for (const order of orders) {
        const label = orderDetailLabel(order, moduleKey);
        const normalized = label.toLowerCase();
        if (seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        labels.push(label);
    }

    return labels;
}

function buildSearchHaystack(
    patientLabel: string,
    patientMeta: string,
    orders: DirectServiceOrderLike[],
    moduleKey: DirectServiceModuleKey,
): string {
    const orderHaystack = orders.flatMap((order) => [
        order.orderNumber,
        order.orderedBy?.name,
        orderDetailLabel(order, moduleKey),
        order.status,
        order.patientId,
        patientLabel,
        patientMeta,
    ]);

    return orderHaystack
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join(' ');
}

export function groupDirectServiceOrdersByPatient<T extends DirectServiceOrderLike>(
    orders: T[],
    moduleKey: DirectServiceModuleKey,
): PatientOrderGroup<T>[] {
    const buckets = new Map<string, T[]>();

    for (const order of orders) {
        const resolvedPatientId = String(order.patientId ?? order.patient?.id ?? '').trim();
        const bucketKey =
            resolvedPatientId !== ''
                ? resolvedPatientId
                : `__orphan__:${String(order.id ?? '').trim()}`;

        const existing = buckets.get(bucketKey) ?? [];
        existing.push(order);
        buckets.set(bucketKey, existing);
    }

    const groups: PatientOrderGroup<T>[] = [];

    for (const [patientId, patientOrders] of buckets.entries()) {
        const isOrphanGroup = patientId.startsWith('__orphan__:');
        const sortedOrders = [...patientOrders].sort((left, right) => {
            const leftRank = statusRank(String(left.status ?? ''), moduleKey);
            const rightRank = statusRank(String(right.status ?? ''), moduleKey);
            if (leftRank !== rightRank) {
                return leftRank - rightRank;
            }

            const leftTime = left.orderedAt ? new Date(left.orderedAt).getTime() : Number.MAX_SAFE_INTEGER;
            const rightTime = right.orderedAt ? new Date(right.orderedAt).getTime() : Number.MAX_SAFE_INTEGER;
            return leftTime - rightTime;
        });

        const patientLabel = isOrphanGroup
            ? 'Unknown patient'
            : patientLabelFromOrder(sortedOrders[0], patientId);
        const patientMeta = isOrphanGroup ? '' : patientMetaFromOrder(sortedOrders[0]);
        const detailPreview = uniqueOrderDetailPreview(sortedOrders, moduleKey);
        const previewHead = detailPreview.slice(0, 2).join(', ');
        const previewTail = detailPreview.length > 2 ? ` +${detailPreview.length - 2} more` : '';
        const orderCountLabel = `${sortedOrders.length} open order${sortedOrders.length === 1 ? '' : 's'}`;
        const worst = worstStatus(sortedOrders, moduleKey);
        const earliest = earliestOrderedAt(sortedOrders);

        groups.push({
            patientId,
            patientLabel,
            patientMeta,
            orders: sortedOrders,
            summarySubtitle: [orderCountLabel, previewHead ? `${previewHead}${previewTail}` : null]
                .filter(Boolean)
                .join(' · '),
            summaryMeta: patientMeta,
            summaryStatus: formatEnumLabel(worst),
            searchHaystack: buildSearchHaystack(patientLabel, patientMeta, sortedOrders, moduleKey),
        });
    }

    return groups.sort((left, right) => {
        const leftRank = statusRank(worstStatus(left.orders, moduleKey), moduleKey);
        const rightRank = statusRank(worstStatus(right.orders, moduleKey), moduleKey);
        if (leftRank !== rightRank) {
            return leftRank - rightRank;
        }

        const leftEarliest = earliestOrderedAt(left.orders);
        const rightEarliest = earliestOrderedAt(right.orders);
        if (leftEarliest && rightEarliest) {
            return new Date(leftEarliest).getTime() - new Date(rightEarliest).getTime();
        }

        return left.patientLabel.localeCompare(right.patientLabel);
    });
}

export function shouldDefaultExpandPatientGroup(
    patientId: string,
    focusPatientId: string,
    totalGroups: number,
): boolean {
    const normalizedFocus = focusPatientId.trim();
    if (normalizedFocus !== '') {
        return patientId === normalizedFocus;
    }

    return totalGroups === 1;
}
