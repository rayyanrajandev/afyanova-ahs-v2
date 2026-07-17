<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { exportPlatformUserAuditLogsCsv, usePlatformUserAuditLogFilters, usePlatformUserAuditLogs } from '@/composables/platformUsersIndex/usePlatformUserAuditLogs';
import { messageFromUnknown, notifyError } from '@/lib/notify';

const props = defineProps<{
    userId: number | null;
}>();

const userIdRef = computed(() => props.userId);
const filters = usePlatformUserAuditLogFilters();
const auditLogs = usePlatformUserAuditLogs(userIdRef, filters);
const logs = computed(() => auditLogs.data.value?.data ?? []);
const meta = computed(() => auditLogs.data.value?.meta ?? null);

const filtersOpen = ref(false);
const exporting = ref(false);

const allSelectValue = '__all';
const actorTypeSelectValue = computed({
    get: () => filters.actorType || allSelectValue,
    set: (value: string) => {
        filters.actorType = value === allSelectValue ? '' : value;
    },
});

function applyFilters(): void {
    filters.page = 1;
    void auditLogs.refetch();
}

function resetFilters(): void {
    filters.q = '';
    filters.action = '';
    filters.actorType = '';
    filters.actorId = '';
    filters.from = '';
    filters.to = '';
    filters.page = 1;
    void auditLogs.refetch();
}

function prevPage(): void {
    if ((meta.value?.currentPage ?? 1) <= 1) return;
    filters.page -= 1;
}

function nextPage(): void {
    if (!meta.value || meta.value.currentPage >= meta.value.lastPage) return;
    filters.page += 1;
}

async function exportCsv(): Promise<void> {
    if (props.userId === null || exporting.value) return;
    exporting.value = true;
    try {
        await exportPlatformUserAuditLogsCsv(props.userId, filters);
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export audit logs.'));
    } finally {
        exporting.value = false;
    }
}

function formatDateTime(value: string | null): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
</script>

<template>
    <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="sm" @click="filtersOpen = !filtersOpen">
                <AppIcon name="sliders-horizontal" class="mr-1.5 size-3.5" />Filters
            </Button>
            <Button variant="outline" size="sm" :disabled="exporting" @click="exportCsv">
                <AppIcon name="download" class="mr-1.5 size-3.5" />{{ exporting ? 'Exporting…' : 'Export CSV' }}
            </Button>
        </div>

        <div v-if="filtersOpen" class="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-3">
            <Input v-model="filters.q" placeholder="Search" class="col-span-2 h-8 text-xs" @keyup.enter="applyFilters" />
            <Input v-model="filters.action" placeholder="Action" class="h-8 text-xs" />
            <Select v-model="actorTypeSelectValue">
                <SelectTrigger class="h-8 text-xs"><SelectValue placeholder="Actor type" /></SelectTrigger>
                <SelectContent>
                    <SelectItem :value="allSelectValue">Any actor</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                </SelectContent>
            </Select>
            <Input v-model="filters.actorId" placeholder="Actor ID" class="h-8 text-xs" />
            <Input v-model="filters.from" type="date" class="h-8 text-xs" />
            <Input v-model="filters.to" type="date" class="h-8 text-xs" />
            <div class="col-span-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" @click="resetFilters">Reset</Button>
                <Button size="sm" @click="applyFilters">Apply</Button>
            </div>
        </div>

        <div v-if="auditLogs.isPending.value" class="space-y-2">
            <Skeleton class="h-10 w-full" />
            <Skeleton class="h-10 w-full" />
        </div>

        <Alert v-else-if="auditLogs.isError.value" variant="destructive">
            <AlertTitle>Unable to load audit logs</AlertTitle>
            <AlertDescription>{{ auditLogs.error.value?.message }}</AlertDescription>
        </Alert>

        <div v-else-if="logs.length === 0" class="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            No audit log entries found.
        </div>

        <ul v-else class="space-y-1.5">
            <li v-for="log in logs" :key="log.id" class="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div class="min-w-0">
                    <p class="truncate font-medium">{{ log.actionLabel ?? log.action ?? 'Unknown action' }}</p>
                    <p class="text-xs text-muted-foreground">{{ log.actor?.displayName ?? (log.actorType === 'system' ? 'System' : 'Unknown actor') }}</p>
                </div>
                <span class="shrink-0 text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }}</span>
            </li>
        </ul>

        <div v-if="meta && meta.lastPage > 1" class="flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {{ meta.currentPage }} of {{ meta.lastPage }} ({{ meta.total }} total)</span>
            <div class="flex gap-2">
                <Button variant="outline" size="sm" :disabled="meta.currentPage <= 1" @click="prevPage">Previous</Button>
                <Button variant="outline" size="sm" :disabled="meta.currentPage >= meta.lastPage" @click="nextPage">Next</Button>
            </div>
        </div>
    </div>
</template>
