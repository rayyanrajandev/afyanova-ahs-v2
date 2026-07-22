import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * One billable service captured for an encounter — a "charge capture candidate"
 * from GET /billing/charge-capture-candidates. Each row is a priced
 * service (consultation, lab, radiology, pharmacy, theatre) sourced from the
 * encounter's own orders/appointment, flagged pending vs. already-invoiced.
 * Shape mirrors ListBillingChargeCaptureCandidatesUseCase::buildCandidate().
 */
export type EncounterChargeCandidate = {
    id: string;
    sourceWorkflowKind: string;
    sourceWorkflowLabel: string | null;
    sourceNumber: string | null;
    serviceCode: string | null;
    serviceName: string;
    serviceType: string;
    performedAt: string | null;
    quantity: number;
    unit: string;
    unitPrice: number;
    lineTotal: number;
    currencyCode: string;
    pricingStatus: 'priced' | 'missing_catalog_price' | 'missing_service_code' | string;
    alreadyInvoiced: boolean;
    invoiceId: string | null;
    invoiceNumber: string | null;
    invoiceStatus: string | null;
};

export type EncounterChargesMeta = {
    currencyCode: string;
    includeInvoiced: boolean;
    total: number;
    pending: number;
    alreadyInvoiced: number;
    priced: number;
    missingPrice: number;
};

export type EncounterChargesResponse = {
    data: EncounterChargeCandidate[];
    meta: EncounterChargesMeta;
};

/**
 * Lists every billable service for one encounter (priced, with pending vs.
 * invoiced status) — backs the Encounter Workspace "Charges" tab. Reuses the
 * existing encounter-scoped charge-capture endpoint (gated by
 * billing.invoices.create), the same engine the workspace's close-readiness
 * billing summary already consumes. No backend change. `enabled` requires both
 * ids and a billing gate the caller passes in.
 */
export function useEncounterCharges(
    patientId: MaybeRefOrGetter<string | null | undefined>,
    encounterId: MaybeRefOrGetter<string | null | undefined>,
    enabled: MaybeRefOrGetter<boolean>,
): UseQueryReturnType<EncounterChargesResponse, Error> {
    const isEnabled = computed(
        () =>
            Boolean(toValue(enabled)) &&
            Boolean(toValue(patientId)) &&
            Boolean(toValue(encounterId)),
    );

    return useQuery({
        queryKey: [
            'encounter-charges',
            computed(() => toValue(patientId)),
            computed(() => toValue(encounterId)),
        ],
        queryFn: () => {
            const pid = toValue(patientId);
            const eid = toValue(encounterId);
            if (!pid || !eid) {
                throw new Error(
                    'A patient id and encounter id are required to load charges.',
                );
            }

            return apiGet<EncounterChargesResponse>(
                '/billing/charge-capture-candidates',
                { patientId: pid, encounterId: eid, includeInvoiced: true },
            );
        },
        enabled: isEnabled,
    });
}
