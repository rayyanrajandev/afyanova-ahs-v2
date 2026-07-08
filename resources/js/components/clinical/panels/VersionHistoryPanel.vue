<script setup lang="ts">
import { computed } from 'vue';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    formatDiffValue,
    useMedicalRecordVersions,
    versionLabel,
} from '@/composables/clinical/useMedicalRecordVersions';
import { formatDateTime } from '@/composables/clinical/useEncounterOrdering';

const props = defineProps<{
    recordId: string;
}>();

const PREVIOUS_VERSION_VALUE = '__previous_version__';

const versions = useMedicalRecordVersions(() => props.recordId);

const againstVersionModel = computed({
    get: () => versions.againstVersionId.value || PREVIOUS_VERSION_VALUE,
    set: (value: string) => {
        versions.againstVersionId.value = value === PREVIOUS_VERSION_VALUE ? '' : value;
    },
});
</script>

<template>
    <section class="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
        <div class="flex items-center justify-between gap-2">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Version history
            </p>
            <Badge v-if="versions.versions.value.length" variant="outline" class="text-[11px]">
                {{ versions.versions.value.length }} version{{ versions.versions.value.length === 1 ? '' : 's' }}
            </Badge>
        </div>

        <div v-if="versions.isLoading.value" class="space-y-2">
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-16 w-full" />
        </div>

        <p v-else-if="!versions.versions.value.length" class="text-sm text-muted-foreground">
            No saved versions yet.
        </p>

        <div v-else class="space-y-3">
            <div class="grid gap-2 sm:grid-cols-2">
                <div class="space-y-1">
                    <label class="text-xs text-muted-foreground">Version</label>
                    <Select v-model="versions.selectedVersionId.value">
                        <SelectTrigger class="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem
                                v-for="version in versions.versions.value"
                                :key="version.id"
                                :value="version.id"
                            >
                                {{ versionLabel(version, formatDateTime) }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div class="space-y-1">
                    <label class="text-xs text-muted-foreground">Compare against</label>
                    <Select v-model="againstVersionModel">
                        <SelectTrigger class="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem :value="PREVIOUS_VERSION_VALUE">Previous version</SelectItem>
                            <SelectItem
                                v-for="version in versions.versions.value"
                                :key="version.id"
                                :value="version.id"
                            >
                                {{ versionLabel(version, formatDateTime) }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div v-if="versions.isDiffLoading.value" class="text-sm text-muted-foreground">
                Loading diff…
            </div>
            <p v-else-if="versions.diffError.value" class="text-sm text-destructive">
                Unable to load version diff.
            </p>
            <div v-else-if="versions.diff.value" class="space-y-2">
                <p class="text-xs text-muted-foreground">
                    {{ versions.diff.value.summary.changedFieldCount }} field{{
                        versions.diff.value.summary.changedFieldCount === 1 ? '' : 's'
                    }}
                    changed
                </p>
                <div
                    v-if="!versions.diff.value.diff.length"
                    class="rounded-md bg-muted/25 px-3 py-2 text-sm text-muted-foreground"
                >
                    No field differences between these versions.
                </div>
                <div
                    v-for="row in versions.diff.value.diff"
                    :key="row.field ?? ''"
                    class="rounded-md border p-2 text-sm"
                >
                    <p class="font-medium">{{ row.field }}</p>
                    <p class="text-destructive/80 line-through">{{ formatDiffValue(row.before) }}</p>
                    <p class="text-emerald-700 dark:text-emerald-400">{{ formatDiffValue(row.after) }}</p>
                </div>
            </div>
        </div>
    </section>
</template>
