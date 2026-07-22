<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceCatalogAuditLogFilters } from '@/composables/serviceCatalogWorkspace/useServiceCatalogAuditLogFilters';
import { useServiceCatalogAuditLogs } from '@/composables/serviceCatalogWorkspace/useServiceCatalogAuditLogs';
import { apiGetBlob } from '@/lib/apiClient';
import {
    datePartFromDateTimeInput,
    formatDateTime,
    mergeDateAndTimeInput,
    timePartFromDateTimeInput,
    toApiDateTime,
    type CatalogItem,
} from '@/lib/billingServiceCatalog';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

const props = defineProps<{
    item: CatalogItem;
}>();

const itemId = computed(() => String(props.item.id ?? ''));
const filters = useServiceCatalogAuditLogFilters();
const auditLogs = useServiceCatalogAuditLogs(() => itemId.value, filters, true);
const auditExporting = ref(false);

const actorTypeSelectValue = computed({
    get: () => filters.actorType || '__all__',
    set: (value: string) => { filters.actorType = value === '__all__' ? '' : value; },
});
const perPageSelectValue = computed({
    get: () => String(filters.perPage),
    set: (value: string) => { filters.perPage = Number.parseInt(value, 10) || 20; },
});

const fromDate = computed({
    get: () => datePartFromDateTimeInput(filters.from),
    set: (value: string) => { filters.from = mergeDateAndTimeInput(value, timePartFromDateTimeInput(filters.from), '00:00'); },
});
const fromTime = computed({
    get: () => timePartFromDateTimeInput(filters.from),
    set: (value: string) => { filters.from = mergeDateAndTimeInput(datePartFromDateTimeInput(filters.from), value, '00:00'); },
});
const toDate = computed({
    get: () => datePartFromDateTimeInput(filters.to),
    set: (value: string) => { filters.to = mergeDateAndTimeInput(value, timePartFromDateTimeInput(filters.to), '23:59'); },
});
const toTime = computed({
    get: () => timePartFromDateTimeInput(filters.to),
    set: (value: string) => { filters.to = mergeDateAndTimeInput(datePartFromDateTimeInput(filters.to), value, '23:59'); },
});

function resetFilters(): void {
    Object.assign(filters, { q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });
}

function applyFilters(): void {
    filters.page = 1;
    void auditLogs.refetch();
}

function goToPage(page: number): void {
    filters.page = page;
}

async function exportAuditLogs(): Promise<void> {
    if (auditExporting.value) return;
    auditExporting.value = true;

    try {
        const { blob, filename } = await apiGetBlob(`/billing-service-catalog/items/${itemId.value}/audit-logs/export`, {
            query: {
                q: filters.q.trim() || null,
                action: filters.action.trim() || null,
                actorType: filters.actorType || null,
                actorId: filters.actorId.trim() || null,
                from: toApiDateTime(filters.from),
                to: toApiDateTime(filters.to),
            },
            entitlementContext: 'Billing service catalog audit export',
        });

        const downloadName = filename ?? `billing-service-catalog-audit-${itemId.value}.csv`;
        const objectUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = downloadName;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(objectUrl);

        notifySuccess('Audit CSV prepared.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export audit CSV.'));
    } finally {
        auditExporting.value = false;
    }
}
</script>

<template>
    <div class="space-y-3">
        <Card class="rounded-lg border">
            <CardHeader class="pb-3">
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <CardTitle class="text-base">Audit timeline</CardTitle>
                        <CardDescription>Search lifecycle logs, then narrow only when you need deeper trace details.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" class="gap-1.5" :disabled="auditExporting" @click="exportAuditLogs">
                        <AppIcon :name="auditExporting ? 'loader-circle' : 'download'" :class="auditExporting ? 'size-3.5 animate-spin' : 'size-3.5'" />
                        {{ auditExporting ? 'Preparing...' : 'Export CSV' }}
                    </Button>
                </div>
            </CardHeader>
            <CardContent class="space-y-3">
                <div class="grid gap-3">
                    <FormFieldShell input-id="audit-search" label="Text search">
                        <Input id="audit-search" v-model="filters.q" placeholder="created, updated, status.updated..." />
                    </FormFieldShell>
                    <div class="grid gap-3 rounded-lg border bg-muted/10 p-3 sm:grid-cols-2 lg:grid-cols-3">
                        <FormFieldShell input-id="audit-action" label="Action">
                            <Input id="audit-action" v-model="filters.action" />
                        </FormFieldShell>
                        <FormFieldShell input-id="audit-actor-type" label="Actor type">
                            <Select v-model="actorTypeSelectValue">
                                <SelectTrigger id="audit-actor-type" class="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">All</SelectItem>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="system">System</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormFieldShell>
                        <FormFieldShell input-id="audit-actor-id" label="Actor ID">
                            <Input id="audit-actor-id" v-model="filters.actorId" inputmode="numeric" />
                        </FormFieldShell>
                        <SingleDatePopoverField input-id="audit-from-date" label="From date" v-model="fromDate" />
                        <TimePopoverField input-id="audit-from-time" label="From time" v-model="fromTime" />
                        <SingleDatePopoverField input-id="audit-to-date" label="To date" v-model="toDate" />
                        <TimePopoverField input-id="audit-to-time" label="To time" v-model="toTime" />
                        <FormFieldShell input-id="audit-per-page" label="Per page">
                            <Select v-model="perPageSelectValue">
                                <SelectTrigger id="audit-per-page" class="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormFieldShell>
                    </div>
                </div>
                <div class="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p class="text-xs text-muted-foreground">Export respects the current audit filters.</p>
                    <div class="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" class="gap-1.5" :disabled="auditLogs.isFetching.value" @click="resetFilters">
                            <AppIcon name="rotate-ccw" class="size-3.5" />
                            Reset
                        </Button>
                        <Button size="sm" class="gap-1.5" :disabled="auditLogs.isFetching.value" @click="applyFilters">
                            <AppIcon :name="auditLogs.isFetching.value ? 'loader-circle' : 'search'" :class="auditLogs.isFetching.value ? 'size-3.5 animate-spin' : 'size-3.5'" />
                            {{ auditLogs.isFetching.value ? 'Applying...' : 'Apply filters' }}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Alert v-if="auditLogs.isError.value" variant="destructive">
            <AlertTitle>Audit load issue</AlertTitle>
            <AlertDescription>{{ messageFromUnknown(auditLogs.error.value, 'Unable to load audit logs.') }}</AlertDescription>
        </Alert>
        <div v-else-if="auditLogs.isLoading.value" class="space-y-2"><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /></div>
        <div v-else-if="(auditLogs.data.value?.data.length ?? 0) === 0" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No audit logs found.
        </div>
        <div v-else class="space-y-2">
            <div v-for="log in auditLogs.data.value?.data ?? []" :key="log.id" class="rounded-lg border p-3 text-sm">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div class="space-y-1">
                        <p class="font-medium">{{ log.action || 'event' }}</p>
                        <p class="text-xs text-muted-foreground">{{ formatDateTime(log.createdAt) }} | {{ log.actorId === null ? 'System' : `User #${log.actorId}` }}</p>
                    </div>
                    <Badge variant="outline">{{ log.actorId === null ? 'System' : 'User' }}</Badge>
                </div>
            </div>
        </div>

        <div class="flex items-center justify-between border-t pt-2">
            <Button variant="outline" size="sm" class="gap-1.5" :disabled="auditLogs.isFetching.value || (auditLogs.data.value?.meta?.currentPage ?? 1) <= 1" @click="goToPage((auditLogs.data.value?.meta?.currentPage ?? 1) - 1)">
                <AppIcon name="chevron-left" class="size-3.5" />
                Previous
            </Button>
            <p class="text-xs text-muted-foreground">Page {{ auditLogs.data.value?.meta?.currentPage ?? 1 }} of {{ auditLogs.data.value?.meta?.lastPage ?? 1 }}</p>
            <Button
                variant="outline"
                size="sm"
                class="gap-1.5"
                :disabled="auditLogs.isFetching.value || !auditLogs.data.value?.meta || auditLogs.data.value.meta.currentPage >= auditLogs.data.value.meta.lastPage"
                @click="goToPage((auditLogs.data.value?.meta?.currentPage ?? 1) + 1)"
            >
                Next
                <AppIcon name="chevron-right" class="size-3.5" />
            </Button>
        </div>
    </div>
</template>
