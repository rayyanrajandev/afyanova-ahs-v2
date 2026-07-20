<script setup lang="ts">
import { ref, computed } from 'vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { notifyError, notifySuccess } from '@/lib/notify';
import { formatEnumLabel } from '@/lib/labels';
import type { ChargeCaptureCandidate, BillingInvoice } from '@/composables/billingCashierQueue/useBillingPatientInvoices';

const props = defineProps<{
    charges: ChargeCaptureCandidate[];
    invoices: BillingInvoice[];
    patientId: string;
    addChargeCandidateToDraft: (input: { draftInvoiceId: string; lineItems: Record<string, unknown>[] }) => Promise<any>;
    createInvoiceFromCandidate: (body: Record<string, unknown>) => Promise<any>;
    invalidate: (patientId: string | null) => void;
}>();

const capturingIds = ref<Set<string>>(new Set());

const pricedCharges = computed(() =>
    props.charges.filter((c) => c.pricingStatus === 'priced' && !c.alreadyInvoiced),
);
const unpricedCharges = computed(() =>
    props.charges.filter((c) => c.pricingStatus !== 'priced' && !c.alreadyInvoiced),
);

function formatMoney(amount: number | undefined | null, currency?: string | null): string {
    const val = amount || 0;
    const formatted = new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    return `${formatted} ${currency || 'TZS'}`;
}

function buildLineItem(candidate: ChargeCaptureCandidate): Record<string, unknown> {
    return {
        ...candidate.suggestedLineItem,
        sourceWorkflowKind: candidate.sourceWorkflowKind,
        sourceWorkflowId: candidate.id,
        sourceWorkflowLabel: candidate.sourceWorkflowLabel,
    };
}

async function addToInvoice(candidate: ChargeCaptureCandidate): Promise<void> {
    capturingIds.value = new Set([...capturingIds.value, candidate.id]);
    try {
        const lineItem = buildLineItem(candidate);
        const draftInvoice = props.invoices.find(
            (inv) => inv.status === 'draft' && inv.currencyCode === (candidate.currencyCode || 'TZS'),
        );
        if (draftInvoice) {
            await props.addChargeCandidateToDraft({
                draftInvoiceId: draftInvoice.id,
                lineItems: [...(draftInvoice.lineItems || []), lineItem],
            });
        } else {
            await props.createInvoiceFromCandidate({
                patientId: props.patientId,
                invoiceDate: new Date().toISOString().slice(0, 10),
                currencyCode: candidate.currencyCode || 'TZS',
                subtotalAmount: candidate.lineTotal ?? 0,
                appointmentId: candidate.appointmentId ?? null,
                admissionId: candidate.admissionId ?? null,
                lineItems: [lineItem],
            });
        }
        notifySuccess('Service added to invoice.');
        props.invalidate(props.patientId);
    } catch (error) {
        notifyError(error instanceof Error ? error.message : 'Unable to add to invoice.');
    } finally {
        capturingIds.value = new Set([...capturingIds.value].filter((id) => id !== candidate.id));
    }
}

function pricingBadgeVariant(status: string): 'secondary' | 'outline' | 'destructive' {
    if (status === 'missing_service_code') return 'destructive';
    if (status === 'missing_catalog_price') return 'outline';
    return 'secondary';
}

function pricingBadgeLabel(status: string): string {
    if (status === 'missing_service_code') return 'Missing code';
    if (status === 'missing_catalog_price') return 'Needs pricing';
    return 'Ready';
}
</script>

<template>
    <div class="space-y-4">
        <div v-if="pricedCharges.length > 0">
            <h3 class="mb-2 text-xs font-medium text-muted-foreground">Ready to bill ({{ pricedCharges.length }})</h3>
            <div class="space-y-2">
                <div
                    v-for="candidate in pricedCharges"
                    :key="candidate.id"
                    class="rounded-lg border p-3 transition-colors"
                >
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex-1">
                            <div class="flex items-center gap-2">
                                <p class="text-sm font-medium">{{ candidate.serviceName || 'Unnamed service' }}</p>
                                <Badge v-if="candidate.serviceType" variant="secondary" class="text-[10px]">
                                    {{ formatEnumLabel(candidate.serviceType) }}
                                </Badge>
                                <Badge v-if="candidate.sourceWorkflowLabel" variant="outline" class="text-[10px]">
                                    {{ candidate.sourceWorkflowLabel }}
                                </Badge>
                            </div>
                            <p v-if="candidate.performedAt" class="mt-0.5 text-xs text-muted-foreground">{{ candidate.performedAt }}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-sm font-semibold tabular-nums">{{ formatMoney(candidate.lineTotal, candidate.currencyCode) }}</p>
                            <p v-if="candidate.unitPrice" class="text-xs text-muted-foreground tabular-nums">{{ candidate.unitPrice }} each</p>
                        </div>
                    </div>
                    <div class="mt-2 flex justify-end">
                        <Button
                            size="sm"
                            :disabled="capturingIds.has(candidate.id)"
                            @click="addToInvoice(candidate)"
                        >
                            {{ capturingIds.has(candidate.id) ? 'Adding...' : 'Add to invoice' }}
                        </Button>
                    </div>
                </div>
            </div>
        </div>

        <Separator v-if="pricedCharges.length > 0 && unpricedCharges.length > 0" />

        <div v-if="unpricedCharges.length > 0">
            <h3 class="mb-2 text-xs font-medium text-muted-foreground">Needs pricing ({{ unpricedCharges.length }})</h3>
            <div class="space-y-2">
                <div
                    v-for="candidate in unpricedCharges"
                    :key="candidate.id"
                    class="rounded-lg border border-dashed p-3 opacity-60"
                >
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex-1">
                            <div class="flex items-center gap-2">
                                <p class="text-sm font-medium">{{ candidate.serviceName || 'Unnamed service' }}</p>
                                <Badge :variant="pricingBadgeVariant(candidate.pricingStatus)" class="text-[10px]">
                                    {{ pricingBadgeLabel(candidate.pricingStatus) }}
                                </Badge>
                            </div>
                            <p v-if="candidate.performedAt" class="mt-0.5 text-xs text-muted-foreground">{{ candidate.performedAt }}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div
            v-if="charges.length === 0"
            class="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
            No unbilled services found for this patient.
        </div>
    </div>
</template>
