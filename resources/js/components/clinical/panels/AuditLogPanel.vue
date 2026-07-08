<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { auditActionDisplayLabel, auditActorDisplayName } from '@/lib/audit';
import { useMedicalRecordAuditLog } from '@/composables/clinical/useMedicalRecordAuditLog';
import { formatDateTime } from '@/composables/clinical/useEncounterOrdering';

const props = defineProps<{
    recordId: string;
}>();

const audit = useMedicalRecordAuditLog(() => props.recordId);
</script>

<template>
    <section class="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
        <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Audit log
            </p>
            <Badge v-if="audit.meta.value" variant="outline" class="text-[11px]">
                {{ audit.meta.value.total }} entr{{ audit.meta.value.total === 1 ? 'y' : 'ies' }}
            </Badge>
        </div>

        <div class="flex flex-wrap items-center gap-2">
            <Input
                v-model="audit.filters.q"
                placeholder="Search…"
                class="h-8 w-40 text-sm"
            />
            <Input
                v-model="audit.filters.action"
                placeholder="Action"
                class="h-8 w-36 text-sm"
            />
            <Button size="sm" variant="ghost" class="h-8" @click="audit.resetFilters()">
                Clear filters
            </Button>
            <Button size="sm" variant="outline" class="h-8" @click="audit.exportCsv()">
                Export CSV
            </Button>
        </div>

        <div v-if="audit.isLoading.value" class="space-y-2">
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
        </div>

        <p v-else-if="audit.error.value" class="text-sm text-destructive">
            Unable to load the audit log.
        </p>

        <p v-else-if="!audit.logs.value.length" class="text-sm text-muted-foreground">
            No audit entries match these filters.
        </p>

        <ul v-else class="space-y-2">
            <li v-for="log in audit.logs.value" :key="log.id" class="rounded-md border p-2 text-sm">
                <div class="flex items-center justify-between gap-2">
                    <p class="font-medium">{{ auditActionDisplayLabel(log) }}</p>
                    <p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }}</p>
                </div>
                <p class="text-xs text-muted-foreground">{{ auditActorDisplayName(log) }}</p>
            </li>
        </ul>

        <div
            v-if="audit.meta.value && audit.meta.value.lastPage > 1"
            class="flex items-center justify-between pt-1"
        >
            <Button
                size="sm"
                variant="outline"
                :disabled="audit.filters.page <= 1"
                @click="audit.goToPage(audit.filters.page - 1)"
            >
                Previous
            </Button>
            <p class="text-xs text-muted-foreground">
                Page {{ audit.meta.value.currentPage }} of {{ audit.meta.value.lastPage }}
            </p>
            <Button
                size="sm"
                variant="outline"
                :disabled="audit.filters.page >= audit.meta.value.lastPage"
                @click="audit.goToPage(audit.filters.page + 1)"
            >
                Next
            </Button>
        </div>
    </section>
</template>
