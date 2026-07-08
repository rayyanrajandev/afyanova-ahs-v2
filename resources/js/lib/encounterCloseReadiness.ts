export type EncounterCloseReadinessItemDetail = {
    id: string;
    label: string;
    meta?: string | null;
};

export type EncounterCloseReadinessItem = {
    id: string;
    label: string;
    severity: 'block' | 'warn' | 'pass' | string;
    status: 'pass' | 'fail' | string;
    message: string;
    count: number | null;
    /**
     * C-5 acknowledgement-quality fix (reports/clinical-note-audit/15-critical-system-integrity-review.md):
     * the specific outstanding items behind `count`, not just the number —
     * bounded server-side, so `count` may exceed `details.length`.
     */
    details: EncounterCloseReadinessItemDetail[];
};

export type EncounterBillingSummary = {
    pendingCandidates: number;
    alreadyInvoiced: number;
    totalCandidates: number;
    currencyCode: string | null;
};

export type EncounterCloseReadiness = {
    canClose: boolean;
    requiresAcknowledgement: boolean;
    blockingCount: number;
    warningCount: number;
    items: EncounterCloseReadinessItem[];
    billingSummary: EncounterBillingSummary;
};

export function encounterCloseReadinessHasWarnings(
    readiness: EncounterCloseReadiness | null | undefined,
): boolean {
    return Boolean(readiness?.requiresAcknowledgement);
}

export function encounterCloseReadinessBlockingItems(
    readiness: EncounterCloseReadiness | null | undefined,
): EncounterCloseReadinessItem[] {
    return (readiness?.items ?? []).filter(
        (item) => item.severity === 'block' && item.status === 'fail',
    );
}

export function encounterCloseReadinessWarningItems(
    readiness: EncounterCloseReadiness | null | undefined,
): EncounterCloseReadinessItem[] {
    return (readiness?.items ?? []).filter(
        (item) => item.severity === 'warn' && item.status === 'fail',
    );
}
