<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '../helpers';
import type {
    BillingInvoiceAuditLog,
    BillingInvoiceAuditLogListResponse,
} from '../types';

type AuditMetadataPreviewItem = {
    key: string;
    value: string;
};

interface Props {
    logs: BillingInvoiceAuditLog[];
    logsMeta: BillingInvoiceAuditLogListResponse['meta'] | null;
    logsLoading: boolean;
    logsError: string | null;
    auditLogActionLabel: (log: BillingInvoiceAuditLog) => string;
    auditLogActorLabel: (log: BillingInvoiceAuditLog) => string;
    auditActorTypeLabel: (log: BillingInvoiceAuditLog) => string;
    auditChangeSummary: (log: BillingInvoiceAuditLog) => string | null;
    auditChangeKeys: (log: BillingInvoiceAuditLog) => string[];
    auditMetadataPreview: (log: BillingInvoiceAuditLog) => AuditMetadataPreviewItem[];
    auditLogEntries: (
        value: Record<string, unknown> | unknown[] | null,
    ) => Array<[string, unknown]>;
    formatAuditLogJson: (value: unknown) => string;
    isAuditLogExpanded: (logId: string) => boolean;
}

defineProps<Props>();

const emit = defineEmits<{
    'toggle-log-expanded': [logId: string];
    'prev-page': [];
    'next-page': [];
}>();
</script>

<template>
    <Alert
        v-if="logsError"
        variant="destructive"
        class="mt-3"
    >
        <AlertTitle>Audit trail unavailable</AlertTitle>
        <AlertDescription>{{ logsError }}</AlertDescription>
    </Alert>

    <div
        v-else-if="logsLoading"
        class="mt-3 space-y-2"
    >
        <Skeleton class="h-16 w-full" />
        <Skeleton class="h-16 w-full" />
    </div>
    <div
        v-else-if="logs.length === 0"
        class="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground"
    >
        No audit trail entries yet.
    </div>
    <div
        v-else
        class="mt-3 space-y-2"
    >
        <div
            v-for="log in logs"
            :key="log.id"
            class="rounded-md border p-2.5"
        >
            <div
                class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
            >
                <div class="min-w-0 space-y-2">
                    <div class="flex flex-wrap items-center gap-2">
                        <p class="font-medium">
                            {{ auditLogActionLabel(log) }}
                        </p>
                        <Badge variant="secondary">
                            {{ auditActorTypeLabel(log) }}
                        </Badge>
                        <Badge
                            v-if="auditChangeSummary(log)"
                            variant="outline"
                        >
                            {{ auditChangeSummary(log) }}
                        </Badge>
                    </div>
                    <p class="text-xs text-muted-foreground">
                        Actor: {{ auditLogActorLabel(log) }}
                    </p>
                    <div
                        v-if="auditChangeKeys(log).length"
                        class="flex flex-wrap gap-1.5"
                    >
                        <Badge
                            v-for="changeKey in auditChangeKeys(log)"
                            :key="`${log.id}-change-${changeKey}`"
                            variant="outline"
                            class="text-[10px]"
                        >
                            {{ changeKey }}
                        </Badge>
                    </div>
                    <div
                        v-if="auditMetadataPreview(log).length"
                        class="flex flex-wrap gap-2 text-xs text-muted-foreground"
                    >
                        <span
                            v-for="item in auditMetadataPreview(log)"
                            :key="`${log.id}-meta-${item.key}`"
                        >
                            {{ item.key }}: {{ item.value }}
                        </span>
                    </div>
                </div>
                <div class="flex items-center gap-2 self-start">
                    <p class="text-xs text-muted-foreground sm:text-right">
                        {{ formatDateTime(log.createdAt) }}
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        class="h-8 px-2"
                        @click="emit('toggle-log-expanded', log.id)"
                    >
                        {{
                            isAuditLogExpanded(log.id)
                                ? 'Hide details'
                                : 'Show details'
                        }}
                    </Button>
                </div>
            </div>
            <div
                v-if="isAuditLogExpanded(log.id)"
                class="mt-3 grid gap-3 md:grid-cols-2"
            >
                <div
                    v-if="auditLogEntries(log.changes).length"
                    class="space-y-1"
                >
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Changes
                    </p>
                    <pre class="overflow-x-auto rounded-md border bg-muted/20 p-3 text-[11px] leading-5 text-foreground">{{ formatAuditLogJson(log.changes) }}</pre>
                </div>
                <div
                    v-if="auditLogEntries(log.metadata).length"
                    class="space-y-1"
                >
                    <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Metadata
                    </p>
                    <pre class="overflow-x-auto rounded-md border bg-muted/20 p-3 text-[11px] leading-5 text-foreground">{{ formatAuditLogJson(log.metadata) }}</pre>
                </div>
            </div>
        </div>

        <div class="flex items-center justify-between border-t pt-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                :disabled="
                    !logsMeta ||
                    logsMeta.currentPage <= 1 ||
                    logsLoading
                "
                @click="emit('prev-page')"
            >
                Previous
            </Button>
            <p class="text-xs text-muted-foreground">
                Page
                {{ logsMeta?.currentPage ?? 1 }}
                of
                {{ logsMeta?.lastPage ?? 1 }}
            </p>
            <Button
                type="button"
                variant="outline"
                size="sm"
                :disabled="
                    !logsMeta ||
                    logsMeta.currentPage >= logsMeta.lastPage ||
                    logsLoading
                "
                @click="emit('next-page')"
            >
                Next
            </Button>
        </div>
    </div>
</template>
