<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { type EncounterOrderContext } from '@/lib/encounterInlineOrders';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import {
    addChargeCandidateToInvoice,
    fetchEncounterChargeCaptureCandidates,
    type BillingChargeCaptureCandidate,
} from '@/lib/billingInlineCharge';

/**
 * Billing inline charge capture — modeled on TheatreInlineOrderForm.vue's
 * standalone pattern (self-contained section, page-local state in
 * WorkspaceV2.vue, not part of the shared EncounterInlineOrderPanel.vue
 * union). Unlike lab/pharmacy/radiology/theatre, there's nothing to "place"
 * here — it's a picker over already-performed, not-yet-invoiced charges for
 * this visit (ListBillingChargeCaptureCandidatesUseCase), mirroring
 * billing/Index.vue's "Unbilled Services" tab exactly, scoped to this
 * encounter.
 */

const props = defineProps<{
    context: EncounterOrderContext;
}>();

const emit = defineEmits<{
    close: [];
    created: [];
}>();

const candidatesLoading = ref(false);
const candidatesError = ref<string | null>(null);
const candidates = ref<BillingChargeCaptureCandidate[]>([]);
const capturingCandidateIds = ref<Set<string>>(new Set());

const pricedCandidates = computed(() =>
    candidates.value.filter((c) => c.pricingStatus === 'priced' && !c.alreadyInvoiced),
);

const unpricedCandidates = computed(() =>
    candidates.value.filter((c) => c.pricingStatus !== 'priced' && !c.alreadyInvoiced),
);

async function loadCandidates(): Promise<void> {
    candidatesLoading.value = true;
    candidatesError.value = null;
    try {
        candidates.value = await fetchEncounterChargeCaptureCandidates(props.context);
    } catch (error) {
        candidates.value = [];
        candidatesError.value = messageFromUnknown(error, 'Unable to load unbilled charges for this visit.');
    } finally {
        candidatesLoading.value = false;
    }
}

void loadCandidates();

function formatMoney(amount: number, currencyCode: string): string {
    return new Intl.NumberFormat('en-TZ', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount) + ` ${currencyCode}`;
}

async function addToInvoice(candidate: BillingChargeCaptureCandidate): Promise<void> {
    if (capturingCandidateIds.value.has(candidate.id)) return;

    capturingCandidateIds.value = new Set(capturingCandidateIds.value).add(candidate.id);

    try {
        await addChargeCandidateToInvoice(props.context, candidate);
        notifySuccess(`${candidate.serviceName || candidate.sourceWorkflowLabel} added to invoice.`);
        emit('created');
        await loadCandidates();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to add charge to invoice.'));
    } finally {
        const next = new Set(capturingCandidateIds.value);
        next.delete(candidate.id);
        capturingCandidateIds.value = next;
    }
}
</script>

<template>
    <section class="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div class="mb-4 flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-1">
                <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Unbilled charges
                </p>
                <p class="text-sm font-medium text-foreground">Billing</p>
                <p class="text-xs text-muted-foreground">
                    Add already-performed services for this visit onto a draft invoice.
                    Manual/exception charges remain available on the full billing page.
                </p>
            </div>
            <Button variant="ghost" size="sm" class="h-8 w-8 shrink-0 p-0" @click="emit('close')">
                <AppIcon name="x" class="size-4" />
                <span class="sr-only">Close billing panel</span>
            </Button>
        </div>

        <Alert v-if="candidatesError" variant="destructive" class="mb-4">
            <AlertTitle>Unable to load charges</AlertTitle>
            <AlertDescription>{{ candidatesError }}</AlertDescription>
        </Alert>

        <div v-if="candidatesLoading" class="py-6 text-sm text-muted-foreground">
            Loading unbilled charges…
        </div>

        <div v-else-if="pricedCandidates.length === 0 && unpricedCandidates.length === 0" class="py-6 text-sm text-muted-foreground">
            No unbilled charges for this visit yet.
        </div>

        <div v-else class="space-y-3">
            <div v-if="pricedCandidates.length > 0">
                <p class="text-xs font-medium text-muted-foreground mb-2">
                    Ready to bill ({{ pricedCandidates.length }})
                </p>
                <div
                    v-for="candidate in pricedCandidates"
                    :key="candidate.id"
                    class="rounded-lg border p-3"
                >
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <p class="text-sm font-medium">{{ candidate.serviceName || candidate.sourceWorkflowLabel }}</p>
                            <div class="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" class="text-[10px]">
                                    {{ formatEnumLabel(candidate.sourceWorkflowKind) }}
                                </Badge>
                                <span v-if="candidate.performedAt" class="text-xs text-muted-foreground">
                                    {{ candidate.performedAt }}
                                </span>
                            </div>
                        </div>
                        <p class="text-sm font-semibold tabular-nums">
                            {{ formatMoney(candidate.lineTotal || candidate.unitPrice || 0, candidate.currencyCode) }}
                        </p>
                    </div>
                    <div class="mt-2 flex justify-end">
                        <Button
                            size="sm"
                            class="gap-1.5"
                            :disabled="capturingCandidateIds.has(candidate.id)"
                            @click="void addToInvoice(candidate)"
                        >
                            <AppIcon
                                :name="capturingCandidateIds.has(candidate.id) ? 'loader-circle' : 'plus'"
                                class="size-3.5"
                                :class="{ 'animate-spin': capturingCandidateIds.has(candidate.id) }"
                            />
                            {{ capturingCandidateIds.has(candidate.id) ? 'Adding…' : 'Add to invoice' }}
                        </Button>
                    </div>
                </div>
            </div>

            <div v-if="unpricedCandidates.length > 0">
                <Separator v-if="pricedCandidates.length > 0" class="my-3" />
                <p class="text-xs font-medium text-muted-foreground mb-2">
                    Needs pricing ({{ unpricedCandidates.length }})
                </p>
                <div
                    v-for="candidate in unpricedCandidates"
                    :key="candidate.id"
                    class="rounded-lg border border-dashed p-3 opacity-60"
                >
                    <div class="flex items-start justify-between gap-2">
                        <div>
                            <p class="text-sm font-medium">{{ candidate.serviceName || candidate.sourceWorkflowLabel }}</p>
                            <Badge variant="outline" class="text-[10px] mt-0.5">
                                {{ formatEnumLabel(candidate.sourceWorkflowKind) }}
                            </Badge>
                        </div>
                        <Badge variant="secondary" class="text-[10px]">No price</Badge>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
