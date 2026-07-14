<script setup lang="ts">
import { computed } from 'vue';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { TheatreProcedure } from '@/composables/theatreProcedures/useTheatreProcedures';
import { formatEnumLabel } from '@/lib/labels';

const props = defineProps<{
    order: TheatreProcedure | null;
    clinicianNameById: Record<number, string>;
}>();

const open = defineModel<boolean>('open', { required: true });

function clinicianLabel(userId: number | null, fallbackLabel: string): string {
    if (userId === null) return '—';
    return props.clinicianNameById[userId] ?? `${fallbackLabel} #${userId}`;
}

const operatingClinicianLabel = computed(() => clinicianLabel(props.order?.operatingClinicianUserId ?? null, 'Clinician'));
const anesthetistLabel = computed(() => clinicianLabel(props.order?.anesthetistUserId ?? null, 'Clinician'));

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
                <SheetTitle>{{ order.procedureName || order.procedureType || 'Theatre procedure' }}</SheetTitle>
                <SheetDescription>{{ order.procedureNumber || order.id }}</SheetDescription>
            </SheetHeader>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                <div class="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{{ formatEnumLabel(order.status) }}</Badge>
                    <Badge v-if="order.theatreRoomName" variant="secondary">{{ order.theatreRoomName }}</Badge>
                    <Badge v-if="order.entryState" variant="secondary">{{ formatEnumLabel(order.entryState) }}</Badge>
                </div>

                <div class="rounded-lg border bg-muted/10 p-3">
                    <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Procedure</p>
                    <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div>
                            <dt class="text-xs text-muted-foreground">Procedure type</dt>
                            <dd>{{ order.procedureType || '—' }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">Room</dt>
                            <dd>{{ order.theatreRoomName || '—' }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">Operating clinician</dt>
                            <dd>{{ operatingClinicianLabel }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">Anesthetist</dt>
                            <dd>{{ anesthetistLabel }}</dd>
                        </div>
                        <div class="col-span-2">
                            <dt class="text-xs text-muted-foreground">Notes</dt>
                            <dd>{{ order.notes || '—' }}</dd>
                        </div>
                    </dl>
                </div>

                <div class="rounded-lg border bg-muted/10 p-3">
                    <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Timeline</p>
                    <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div>
                            <dt class="text-xs text-muted-foreground">Scheduled for</dt>
                            <dd>{{ formatDateTime(order.scheduledAt) }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">Started at</dt>
                            <dd>{{ formatDateTime(order.startedAt) }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">Completed at</dt>
                            <dd>{{ formatDateTime(order.completedAt) }}</dd>
                        </div>
                        <div>
                            <dt class="text-xs text-muted-foreground">Status reason</dt>
                            <dd>{{ order.statusReason || '—' }}</dd>
                        </div>
                    </dl>
                </div>

                <div class="rounded-lg border bg-muted/10 p-3">
                    <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Patient</p>
                    <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        <div class="col-span-2">
                            <dt class="text-xs text-muted-foreground">Patient</dt>
                            <dd>{{ order.patientLabel || order.patientNumber || '—' }}</dd>
                        </div>
                    </dl>
                </div>
            </div>
        </SheetContent>
    </Sheet>
</template>
