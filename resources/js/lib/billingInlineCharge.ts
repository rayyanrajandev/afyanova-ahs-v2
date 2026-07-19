import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';
import { type EncounterOrderContext } from '@/lib/encounterInlineOrders';

/**
 * Billing inline charge capture — a deliberately separate module from
 * encounterInlineOrders.ts, following the same precedent theatreInlineOrder.ts
 * already set: billing isn't part of the shared EncounterInlineOrderType union
 * (which is also used by the still-live encounters/{id} Workspace.vue page),
 * so this stays additive-only and used only from WorkspaceV2.vue.
 *
 * Unlike a lab/pharmacy/radiology order, there's nothing to "create" here —
 * charge-capture candidates are already-performed clinical activity
 * (consultation/lab/pharmacy/radiology/theatre) surfaced by
 * ListBillingChargeCaptureCandidatesUseCase, and the only action is adding
 * one onto a draft invoice (or opening a new draft) — the exact same
 * find-draft-or-create logic billing/Index.vue's addCandidateToInvoice()
 * already uses, ported here so the encounter workspace doesn't need its own
 * invoice list to do the same thing.
 */

export type BillingChargeCaptureCandidate = {
    id: string;
    sourceWorkflowKind: string;
    sourceWorkflowLabel: string | null;
    serviceName: string | null;
    serviceCode: string | null;
    pricingStatus: 'priced' | 'missing_catalog_price' | 'missing_service_code' | string;
    alreadyInvoiced: boolean;
    currencyCode: string;
    performedAt: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    appointmentId: string | null;
    admissionId: string | null;
    suggestedLineItem: {
        description: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        serviceCode: string | null;
        unit: string;
        notes: string;
        sourceWorkflowKind: string;
        sourceWorkflowId: string;
        sourceWorkflowLabel: string;
        sourcePerformedAt: string | null;
    };
};

type ChargeCaptureCandidatesResponse = { data: BillingChargeCaptureCandidate[] };

export async function fetchEncounterChargeCaptureCandidates(
    context: EncounterOrderContext,
): Promise<BillingChargeCaptureCandidate[]> {
    const response = await apiGet<ChargeCaptureCandidatesResponse>('/billing-invoices/charge-capture-candidates', {
        patientId: context.patientId.trim(),
        encounterId: context.encounterId?.trim() || null,
        includeInvoiced: 'false',
        limit: 100,
    });
    return response.data ?? [];
}

type DraftInvoice = {
    id: string;
    status: string;
    currencyCode: string;
    lineItems: Array<Record<string, unknown>>;
};

type InvoiceListResponse = { data: DraftInvoice[] };

export async function addChargeCandidateToInvoice(
    context: EncounterOrderContext,
    candidate: BillingChargeCaptureCandidate,
): Promise<void> {
    const patientId = context.patientId.trim();
    const lineItem = candidate.suggestedLineItem;

    const invoicesResponse = await apiGet<InvoiceListResponse>('/billing-invoices', {
        patientId,
        perPage: 50,
        sortBy: 'invoiceDate',
        sortDir: 'desc',
    });

    const draftInvoice = invoicesResponse.data.find(
        (invoice) => invoice.status === 'draft' && invoice.currencyCode === candidate.currencyCode,
    );

    if (draftInvoice) {
        await apiPatch(`/billing-invoices/${draftInvoice.id}`, {
            body: {
                lineItems: [...draftInvoice.lineItems, lineItem],
            },
        });
        return;
    }

    await apiPost('/billing-invoices', {
        body: {
            patientId,
            invoiceDate: new Date().toISOString().slice(0, 10),
            currencyCode: candidate.currencyCode || 'TZS',
            subtotalAmount: lineItem.lineTotal ?? 0,
            appointmentId: context.appointmentId?.trim() || candidate.appointmentId || null,
            admissionId: context.admissionId?.trim() || candidate.admissionId || null,
            lineItems: [lineItem],
        },
    });
}
