<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { LaboratoryOrder } from '@/composables/laboratoryOrders/useLaboratoryOrders';
import { formatEnumLabel } from '@/lib/labels';

defineProps<{
    order: LaboratoryOrder | null;
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
                <SheetTitle>{{ order.testName || order.testCode || 'Laboratory order' }}</SheetTitle>
                <SheetDescription>{{ order.orderNumber || order.id }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div class="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{{ formatEnumLabel(order.status) }}</Badge>
                    <Badge v-if="order.priority" variant="secondary">{{ formatEnumLabel(order.priority) }}</Badge>
                    <Badge v-if="order.entryState" variant="secondary">{{ formatEnumLabel(order.entryState) }}</Badge>
                    <Badge v-if="order.currentCare?.hasCriticalResult" variant="destructive">Critical result</Badge>
                    <Badge v-else-if="order.currentCare?.hasAbnormalResult" class="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        Abnormal result
                    </Badge>
                </div>

                <div class="rounded-lg border bg-muted/10 p-3">
                    <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Test</p>
                    <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div>
                            <dt class="text-xs text-muted-foreground">Test code</dt>
                            <dd>{{ order.testCode || '—' }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">Specimen type</dt>
                            <dd>{{ order.specimenType || '—' }}</dd>
                        </div>
                        <div class="col-span-2">
                            <dt class="text-xs text-muted-foreground">Clinical notes</dt>
                            <dd>{{ order.clinicalNotes || '—' }}</dd>
                        </div>
                    </dl>
                </div>

                <div class="rounded-lg border bg-muted/10 p-3">
                    <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Result</p>
                    <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div class="col-span-2">
                            <dt class="text-xs text-muted-foreground">Result summary</dt>
                            <dd class="whitespace-pre-line">{{ order.resultSummary || '—' }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">Resulted at</dt>
                            <dd>{{ formatDateTime(order.resultedAt) }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">Verified at</dt>
                            <dd>{{ formatDateTime(order.verifiedAt) }}</dd>
                        </div>
                        <div v-if="order.verificationNote" class="col-span-2">
                            <dt class="text-xs text-muted-foreground">Verification note</dt>
                            <dd>{{ order.verificationNote }}</dd>
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
