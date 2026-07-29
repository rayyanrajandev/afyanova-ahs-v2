<script setup lang="ts">
import { formatPatientName } from '@/lib/patientName';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { PharmacyOrder } from '@/composables/pharmacyOrders/usePharmacyOrders';
import { formatEnumLabel } from '@/lib/labels';

const props = defineProps<{
    order: PharmacyOrder | null;
    canCreate?: boolean;
    loading?: boolean;
    loadError?: string | null;
}>();

const emit = defineEmits<{
    reorder: [order: PharmacyOrder];
    addOn: [order: PharmacyOrder];
}>();

const open = defineModel<boolean>('open', { required: true });

function requestReorder(): void {
    if (props.order) emit('reorder', props.order);
}

function requestAddOn(): void {
    if (props.order) emit('addOn', props.order);
}

function printPrescription(): void {
    if (!props.order?.id) return;
    window.open(`/pharmacy-orders/${props.order.id}/print`, '_blank');
}

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="lg">
            <template v-if="order">
                <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <SheetTitle>{{ order.medicationName || order.medicationCode || 'Pharmacy order' }}</SheetTitle>
                    <SheetDescription>{{ order.orderNumber || order.id }}</SheetDescription>
                </SheetHeader>

                <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                    <div class="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{{ formatEnumLabel(order.status) }}</Badge>
                        <Badge v-if="order.entryState" variant="secondary">{{ formatEnumLabel(order.entryState) }}</Badge>
                        <Badge v-if="order.reconciliationStatus" variant="outline">
                            Reconciliation: {{ formatEnumLabel(order.reconciliationStatus) }}
                        </Badge>
                    </div>

                    <div class="rounded-lg border bg-muted/10 p-3">
                        <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Prescription</p>
                        <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                            <div>
                                <dt class="text-xs text-muted-foreground">Dosage</dt>
                                <dd>{{ order.dosageInstruction || '—' }}</dd>
                            </div>
                            <div>
                                <dt class="text-xs text-muted-foreground">Route</dt>
                                <dd>{{ order.route || '—' }}</dd>
                            </div>
                            <div>
                                <dt class="text-xs text-muted-foreground">Frequency</dt>
                                <dd>{{ order.frequency || '—' }}</dd>
                            </div>
                            <div>
                                <dt class="text-xs text-muted-foreground">Duration</dt>
                                <dd>
                                    <span v-if="order.durationValue">{{ order.durationValue }} {{ order.durationUnit || '' }}</span>
                                    <span v-else>—</span>
                                </dd>
                            </div>
                            <div class="col-span-2">
                                <dt class="text-xs text-muted-foreground">Clinical indication</dt>
                                <dd>{{ order.clinicalIndication || '—' }}</dd>
                            </div>
                        </dl>
                    </div>

                    <div class="rounded-lg border bg-muted/10 p-3">
                        <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Dispensing</p>
                        <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                            <div>
                                <dt class="text-xs text-muted-foreground">Prescribed</dt>
                                <dd>{{ order.quantityPrescribed ?? '—' }} {{ order.prescribedUnit || '' }}</dd>
                            </div>
                            <div>
                                <dt class="text-xs text-muted-foreground">Dispensed</dt>
                                <dd>{{ order.quantityDispensed ?? '—' }} {{ order.dispensedUnit || '' }}</dd>
                            </div>
                            <div>
                                <dt class="text-xs text-muted-foreground">Dispensed at</dt>
                                <dd>{{ formatDateTime(order.dispensedAt) }}</dd>
                            </div>
                            <div>
                                <dt class="text-xs text-muted-foreground">Verified at</dt>
                                <dd>{{ formatDateTime(order.verifiedAt) }}</dd>
                            </div>
                            <div v-if="order.dispensingNotes" class="col-span-2">
                                <dt class="text-xs text-muted-foreground">Dispensing notes</dt>
                                <dd>{{ order.dispensingNotes }}</dd>
                            </div>
                        </dl>
                    </div>

                    <div v-if="order.formularyDecisionStatus || order.substitutionMade" class="rounded-lg border bg-muted/10 p-3">
                        <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Formulary &amp; substitution</p>
                        <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                            <div>
                                <dt class="text-xs text-muted-foreground">Formulary decision</dt>
                                <dd>{{ order.formularyDecisionStatus ? formatEnumLabel(order.formularyDecisionStatus) : '—' }}</dd>
                            </div>
                            <div>
                                <dt class="text-xs text-muted-foreground">Substitution made</dt>
                                <dd>{{ order.substitutionMade ? 'Yes' : 'No' }}</dd>
                            </div>
                            <div v-if="order.substitutionMade" class="col-span-2">
                                <dt class="text-xs text-muted-foreground">Substituted with</dt>
                                <dd>{{ order.substitutedMedicationName || order.substitutedMedicationCode || '—' }}</dd>
                            </div>
                            <div v-if="order.formularyDecisionReason" class="col-span-2">
                                <dt class="text-xs text-muted-foreground">Reason</dt>
                                <dd>{{ order.formularyDecisionReason }}</dd>
                            </div>
                        </dl>
                    </div>

                    <div v-if="order.reconciliationDecision || order.reconciliationNote" class="rounded-lg border bg-muted/10 p-3">
                        <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Reconciliation</p>
                        <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                            <div>
                                <dt class="text-xs text-muted-foreground">Decision</dt>
                                <dd>{{ order.reconciliationDecision ? formatEnumLabel(order.reconciliationDecision) : '—' }}</dd>
                            </div>
                            <div>
                                <dt class="text-xs text-muted-foreground">Reconciled at</dt>
                                <dd>{{ formatDateTime(order.reconciledAt) }}</dd>
                            </div>
                            <div v-if="order.reconciliationNote" class="col-span-2">
                                <dt class="text-xs text-muted-foreground">Note</dt>
                                <dd>{{ order.reconciliationNote }}</dd>
                            </div>
                        </dl>
                    </div>

                    <div class="rounded-lg border bg-muted/10 p-3">
                        <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Order</p>
                        <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                            <div>
                                <dt class="text-xs text-muted-foreground">Ordered by</dt>
                                <dd>{{ order.orderedBy?.name || '—' }}</dd>
                            </div>
                            <div>
                                <dt class="text-xs text-muted-foreground">Ordered at</dt>
                                <dd>{{ formatDateTime(order.orderedAt) }}</dd>
                            </div>
                            <div>
                                <dt class="text-xs text-muted-foreground">Patient</dt>
                                <dd>
                                    {{ formatPatientName(order.patient) || order.patient?.patientNumber || '—' }}
                                </dd>
                            </div>
                            <div>
                                <dt class="text-xs text-muted-foreground">Status reason</dt>
                                <dd>{{ order.statusReason || '—' }}</dd>
                            </div>
                        </dl>
                    </div>
                </div>

                <SheetFooter class="shrink-0 flex-row justify-end gap-2 border-t px-6 py-3">
                    <Button variant="outline" size="sm" @click="printPrescription">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        Preview &amp; Print
                    </Button>
                    <Button v-if="canCreate" variant="outline" size="sm" @click="requestAddOn">Add linked medication</Button>
                    <Button v-if="canCreate" variant="outline" size="sm" @click="requestReorder">Reorder</Button>
                </SheetFooter>
            </template>
            <div v-else class="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm">
                <p v-if="loadError" class="text-destructive">{{ loadError }}</p>
                <p v-else class="text-muted-foreground">Loading order…</p>
            </div>
        </SheetContent>
    </Sheet>
</template>
