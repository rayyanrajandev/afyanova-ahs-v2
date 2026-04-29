<script setup lang="ts">
import { ref, watch } from 'vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    auditActionDisplayLabel,
    auditActorDisplayName,
    buildAuditMetadataPreview,
    type AuditActorSummary,
} from '@/lib/audit';
import { formatEnumLabel } from '@/lib/labels';

type AuditTimelineLog = {
    id: string | number;
    actorId?: number | null;
    actorType?: string | null;
    actor?: AuditActorSummary | null;
    action?: string | null;
    actionLabel?: string | null;
    changes?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    createdAt?: string | null;
};

const props = withDefaults(
    defineProps<{
        logs: AuditTimelineLog[];
        formatDateTime: (value: string | null | undefined) => string;
        emptyMessage?: string;
        actorFallbackLabel?: string;
        metadataPreviewLimit?: number;
        showChangeKeyChips?: boolean;
        changeKeyLabel?: (key: string) => string;
        actorBadgeLabel?: (log: AuditTimelineLog) => string;
    }>(),
    {
        emptyMessage: 'No audit logs found for current filters.',
        actorFallbackLabel: 'User',
        metadataPreviewLimit: 4,
        showChangeKeyChips: true,
    },
);

const expandedLogIds = ref<string[]>([]);

watch(
    () => props.logs.map((log) => String(log.id)).join('|'),
    () => {
        expandedLogIds.value = [];
    },
);

function logId(log: AuditTimelineLog): string {
    return String(log.id);
}

function objectEntries(
    value: Record<string, unknown> | null | undefined,
): Array<[string, unknown]> {
    if (!value) return [];

    return Object.entries(value).filter(([, entryValue]) => {
        if (entryValue === null || entryValue === undefined) return false;
        if (typeof entryValue === 'string' && entryValue.trim() === '') {
            return false;
        }
        if (Array.isArray(entryValue) && entryValue.length === 0) return false;

        return true;
    });
}

function changeCount(log: AuditTimelineLog): number {
    return objectEntries(log.changes).length;
}

function metadataCount(log: AuditTimelineLog): number {
    return objectEntries(log.metadata).length;
}

function hasExpandedDetails(log: AuditTimelineLog): boolean {
    return changeCount(log) > 0 || metadataCount(log) > 0;
}

function changeKeyChips(log: AuditTimelineLog): string[] {
    return objectEntries(log.changes)
        .map(([key]) => props.changeKeyLabel?.(key) ?? formatEnumLabel(key))
        .slice(0, 6);
}

function metadataPreview(log: AuditTimelineLog): Array<{ key: string; value: string }> {
    return buildAuditMetadataPreview(log, props.metadataPreviewLimit);
}

function actorLabel(log: AuditTimelineLog): string {
    return auditActorDisplayName(log, props.actorFallbackLabel);
}

function actorBadgeLabel(log: AuditTimelineLog): string {
    if (props.actorBadgeLabel) {
        return props.actorBadgeLabel(log);
    }

    return log.actorType === 'system' || log.actorId === null || log.actorId === undefined
        ? 'System'
        : 'User';
}

function actionLabel(log: AuditTimelineLog): string {
    return auditActionDisplayLabel(log);
}

function toggleExpanded(log: AuditTimelineLog): void {
    const id = logId(log);

    expandedLogIds.value = expandedLogIds.value.includes(id)
        ? expandedLogIds.value.filter((entry) => entry !== id)
        : [...expandedLogIds.value, id];
}

function isExpanded(log: AuditTimelineLog): boolean {
    return expandedLogIds.value.includes(logId(log));
}

function formatJson(value: unknown): string {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || 'N/A';
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}
</script>

<template>
    <p v-if="logs.length === 0" class="text-muted-foreground">
        {{ emptyMessage }}
    </p>
    <div v-else class="space-y-2">
        <div
            v-for="log in logs"
            :key="logId(log)"
            class="rounded-lg border p-3 text-sm"
        >
            <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <p class="font-medium">
                            {{ actionLabel(log) }}
                        </p>
                        <Badge variant="outline">
                            {{ actorBadgeLabel(log) }}
                        </Badge>
                        <Badge v-if="changeCount(log) > 0" variant="secondary">
                            {{ changeCount(log) }}
                            {{ changeCount(log) === 1 ? 'change' : 'changes' }}
                        </Badge>
                        <Badge v-if="metadataCount(log) > 0" variant="outline">
                            {{ metadataCount(log) }} metadata
                        </Badge>
                    </div>
                    <p class="text-xs text-muted-foreground">
                        {{ formatDateTime(log.createdAt) }} |
                        {{ actorLabel(log) }}
                    </p>
                    <div
                        v-if="showChangeKeyChips && changeKeyChips(log).length > 0"
                        class="flex flex-wrap gap-1.5 pt-1"
                    >
                        <Badge
                            v-for="field in changeKeyChips(log)"
                            :key="`${logId(log)}-change-${field}`"
                            variant="outline"
                            class="text-[10px]"
                        >
                            {{ field }}
                        </Badge>
                    </div>
                    <div
                        v-if="metadataPreview(log).length > 0"
                        class="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground"
                    >
                        <span
                            v-for="item in metadataPreview(log)"
                            :key="`${logId(log)}-meta-${item.key}`"
                        >
                            {{ item.key }}: {{ item.value }}
                        </span>
                    </div>
                </div>
                <Button
                    v-if="hasExpandedDetails(log)"
                    size="sm"
                    variant="outline"
                    @click="toggleExpanded(log)"
                >
                    {{ isExpanded(log) ? 'Hide details' : 'Show details' }}
                </Button>
            </div>
            <div v-if="isExpanded(log)" class="mt-3 space-y-3">
                <div
                    v-if="changeCount(log) > 0"
                    class="rounded-md border bg-muted/20 p-3"
                >
                    <p
                        class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                        Changes
                    </p>
                    <pre
                        class="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs"
                    >{{ formatJson(log.changes) }}</pre>
                </div>
                <div
                    v-if="metadataCount(log) > 0"
                    class="rounded-md border bg-muted/20 p-3"
                >
                    <p
                        class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                        Metadata
                    </p>
                    <pre
                        class="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs"
                    >{{ formatJson(log.metadata) }}</pre>
                </div>
            </div>
        </div>
    </div>
</template>
