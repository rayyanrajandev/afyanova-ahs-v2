<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { ClinicalProcedureOrder } from '@/composables/clinicalProcedureOrders/useClinicalProcedureOrders';
import { formatEnumLabel } from '@/lib/labels';

const props = defineProps<{
    order: ClinicalProcedureOrder | null;
    canCreate?: boolean;
}>();

const emit = defineEmits<{
    reorder: [order: ClinicalProcedureOrder];
    addOn: [order: ClinicalProcedureOrder];
}>();

const open = defineModel<boolean>('open', { required: true });

function requestReorder(): void {
    if (props.order) emit('reorder', props.order);
}

function requestAddOn(): void {
    if (props.order) emit('addOn', props.order);
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
        <SheetContent v-if="order" side="right" variant="form" size="lg">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle>{{ order.procedureDescription || order.procedureCode || 'Clinical procedure order' }}</SheetTitle>
                <SheetDescription>{{ order.orderNumber || order.id }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div class="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{{ formatEnumLabel(order.status) }}</Badge>
                    <Badge v-if="order.procedureSetting" variant="secondary">{{ formatEnumLabel(order.procedureSetting) }}</Badge>
                    <Badge v-if="order.entryState" variant="secondary">{{ formatEnumLabel(order.entryState) }}</Badge>
                    <Badge v-if="order.currentCare?.hasCriticalReport" variant="destructive">Critical report</Badge>
                    <Badge v-else-if="order.currentCare?.hasAbnormalReport" class="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        Abnormal report
                    </Badge>
                </div>

                <div class="rounded-lg border bg-muted/10 p-3">
                    <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Procedure</p>
                    <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div>
                            <dt class="text-xs text-muted-foreground">Procedure code</dt>
                            <dd>{{ order.procedureCode || '—' }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">Scheduled for</dt>
                            <dd>{{ formatDateTime(order.scheduledFor) }}</dd>
                        </div>
                        <div class="col-span-2">
                            <dt class="text-xs text-muted-foreground">Clinical indication</dt>
                            <dd>{{ order.clinicalIndication || '—' }}</dd>
                        </div>
                    </dl>
                </div>

                <div class="rounded-lg border bg-muted/10 p-3">
                    <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Report</p>
                    <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div class="col-span-2">
                            <dt class="text-xs text-muted-foreground">Report summary</dt>
                            <dd class="whitespace-pre-line">{{ order.reportSummary || '—' }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">Completed at</dt>
                            <dd>{{ formatDateTime(order.completedAt) }}</dd>
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

            <SheetFooter v-if="canCreate" class="shrink-0 flex-row justify-end gap-2 border-t px-6 py-3">
                <Button variant="outline" size="sm" @click="requestAddOn">Add linked procedure</Button>
                <Button variant="outline" size="sm" @click="requestReorder">Reorder</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
