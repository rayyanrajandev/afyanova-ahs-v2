<script setup lang="ts">
import { computed, ref } from 'vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePatientAuditLogs, type PatientAuditLogWithInvoice } from '@/composables/billingWorkspace/usePatientAuditLogs';
import {
    formatDateTime,
} from '@/pages/billing/invoices/helpers';
import {
    billingAuditActionOptions,
} from '@/pages/billing/invoices/constants';
import { auditActorDisplayName, auditActionDisplayLabel } from '@/lib/audit';
import type { BillingInvoice } from '@/composables/billingCashierQueue/useBillingPatientInvoices';

const props = defineProps<{
    invoices: BillingInvoice[];
    patientId: string;
}>();

const { data: auditLogs, isLoading } = usePatientAuditLogs(
    computed(() => props.patientId),
    computed(() => props.invoices),
);

const actionFilter = ref('');
const searchFilter = ref('');

const filteredLogs = computed(() => {
    let logs = auditLogs.value ?? [];
    if (actionFilter.value) {
        logs = logs.filter((l) => l.action === actionFilter.value);
    }
    if (searchFilter.value.trim()) {
        const q = searchFilter.value.trim().toLowerCase();
        logs = logs.filter(
            (l) =>
                (l.invoiceNumber ?? '').toLowerCase().includes(q) ||
                (l.action ?? '').toLowerCase().includes(q) ||
                (auditActorDisplayName(l, 'User') ?? '').toLowerCase().includes(q),
        );
    }
    return logs;
});

function actorTypeBadge(actorType: string | null): 'secondary' | 'outline' | 'default' {
    if (actorType === 'system') return 'secondary';
    if (actorType === 'user') return 'default';
    return 'outline';
}

function actorTypeLabel(actorType: string | null): string {
    if (actorType === 'system') return 'System';
    if (actorType === 'user') return 'User';
    return actorType ?? 'Unknown';
}
</script>

<template>
    <div class="space-y-3">
        <div class="flex items-end gap-2">
            <div class="flex-1">
                <Label for="audit-action-filter" class="text-xs">Action</Label>
                <Select v-model="actionFilter">
                    <SelectTrigger id="audit-action-filter" class="mt-1 h-8"><SelectValue placeholder="All actions" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value=" ">All actions</SelectItem>
                        <SelectItem v-for="opt in billingAuditActionOptions" :key="opt.value" :value="opt.value">
                            {{ opt.label }}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div class="flex-1">
                <Label for="audit-search" class="text-xs">Search</Label>
                <Input id="audit-search" v-model="searchFilter" class="mt-1 h-8" placeholder="Search logs..." />
            </div>
        </div>

        <div v-if="isLoading" class="space-y-2">
            <div v-for="i in 4" :key="i" class="h-14 animate-pulse rounded-lg bg-muted" />
        </div>
        <div
            v-else-if="filteredLogs.length === 0"
            class="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
            No audit logs found.
        </div>
        <div v-else class="space-y-2">
            <div
                v-for="log in filteredLogs"
                :key="log.id"
                class="rounded-lg border p-3"
            >
                <div class="flex items-start justify-between gap-2">
                    <div class="flex-1">
                        <div class="flex items-center gap-2">
                            <p class="text-sm font-medium">{{ auditActionDisplayLabel(log) }}</p>
                            <Badge :variant="actorTypeBadge(log.actorType)" class="text-[10px]">
                                {{ actorTypeLabel(log.actorType) }}
                            </Badge>
                        </div>
                        <div class="mt-0.5 text-xs text-muted-foreground">
                            <span>{{ log.invoiceNumber || 'Invoice' }}</span>
                            <span v-if="log.actor"> &middot; {{ auditActorDisplayName(log, 'User') }}</span>
                            <span> &middot; {{ formatDateTime(log.createdAt) }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
