<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { PharmacyOrder } from '@/composables/pharmacyOrders/usePharmacyOrders';
import { formatEnumLabel } from '@/lib/labels';

defineProps<{
    order: PharmacyOrder | null;
}>();

const open = defineModel<boolean>('open', { required: true });

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
        <SheetContent v-if="order" side="right" variant="form" size="lg">
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
                                {{
                                    [order.patient?.firstName, order.patient?.lastName].filter(Boolean).join(' ')
                                        || order.patient?.patientNumber
                                        || '—'
                                }}
                            </dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">Status reason</dt>
                            <dd>{{ order.statusReason || '—' }}</dd>
                        </div>
                    </dl>
                </div>
            </div>
        </SheetContent>
    </Sheet>
</template>
