<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import { billingAuditActionOptions, billingAuditActorTypeOptions } from '../constants';
import type {
    AuditExportJobStatusSummary,
    BillingInvoiceAuditExportJob,
    BillingInvoiceAuditExportJobListResponse,
    BillingInvoiceAuditLog,
    BillingInvoiceAuditLogListResponse,
    InvoiceDetailsAuditExportJobsFilterForm,
    InvoiceDetailsAuditLogsFilterForm,
} from '../types';
import InvoiceDetailsAuditExportJobsPanel from './InvoiceDetailsAuditExportJobsPanel.vue';
import InvoiceDetailsAuditLogsPanel from './InvoiceDetailsAuditLogsPanel.vue';

type AuditSummary = {
    total: number;
    userEntries: number;
    systemEntries: number;
    exportJobs: number;
};

type AuditActiveFilter = {
    key: string;
    label: string;
};

type AuditMetadataPreviewItem = {
    key: string;
    value: string;
};

interface Props {
    canViewBillingInvoiceAuditLogs: boolean;
    auditSummary: AuditSummary;
    auditHasActiveFilters: boolean;
    auditActiveFilters: AuditActiveFilter[];
    auditFiltersOpen: boolean;
    auditLogsFilters: InvoiceDetailsAuditLogsFilterForm;
    auditLogsLoading: boolean;
    auditLogsExporting: boolean;
    auditLogsError: string | null;
    auditLogs: BillingInvoiceAuditLog[];
    auditLogsMeta: BillingInvoiceAuditLogListResponse['meta'] | null;
    auditExportJobsFilters: InvoiceDetailsAuditExportJobsFilterForm;
    auditExportJobsLoading: boolean;
    auditExportJobsError: string | null;
    auditExportJobs: BillingInvoiceAuditExportJob[];
    auditExportJobsMeta: BillingInvoiceAuditExportJobListResponse['meta'] | null;
    auditExportJobSummary: AuditExportJobStatusSummary;
    auditExportOpsHint: string | null;
    auditExportHandoffMessage: string | null;
    auditExportHandoffError: boolean;
    auditExportPinnedHandoffJob: BillingInvoiceAuditExportJob | null;
    auditExportFocusJobId: string | null;
    auditExportRetryingJobId: string | null;
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
    'refresh-audit-logs': [];
    'toggle-audit-filters': [];
    'submit-audit-logs-filters': [];
    'reset-audit-logs-filters': [];
    'export-audit-logs-csv': [];
    'refresh-audit-export-jobs': [];
    'submit-audit-export-jobs-filters': [];
    'reset-audit-export-jobs-filters': [];
    'download-audit-export-job': [job: BillingInvoiceAuditExportJob];
    'retry-audit-export-job': [job: BillingInvoiceAuditExportJob];
    'prev-audit-export-jobs-page': [];
    'next-audit-export-jobs-page': [];
    'toggle-audit-log-expanded': [logId: string];
    'prev-audit-logs-page': [];
    'next-audit-logs-page': [];
}>();
</script>

<template>
    <TabsContent value="audit" class="mt-0 space-y-4">
        <div class="rounded-lg border p-3">
            <div
                class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
                <div>
                    <p class="text-sm font-medium">Audit Trail</p>
                    <p class="text-xs text-muted-foreground">
                        Immutable workflow events for invoice lifecycle actions.
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <Badge
                        v-if="canViewBillingInvoiceAuditLogs"
                        variant="outline"
                    >
                        {{ auditLogsMeta?.total ?? 0 }} entries
                    </Badge>
                    <Badge v-else variant="secondary">Audit Restricted</Badge>
                    <Button
                        v-if="canViewBillingInvoiceAuditLogs"
                        type="button"
                        size="sm"
                        variant="outline"
                        :disabled="auditLogsLoading"
                        @click="emit('refresh-audit-logs')"
                    >
                        {{
                            auditLogsLoading
                                ? 'Refreshing...'
                                : 'Refresh Audit'
                        }}
                    </Button>
                    <Button
                        v-if="canViewBillingInvoiceAuditLogs"
                        type="button"
                        size="sm"
                        variant="secondary"
                        class="gap-1.5"
                        @click="emit('toggle-audit-filters')"
                    >
                        <AppIcon
                            name="sliders-horizontal"
                            class="size-3.5"
                        />
                        {{
                            auditFiltersOpen
                                ? 'Hide Filters'
                                : 'Show Filters'
                        }}
                    </Button>
                </div>
            </div>

            <div
                v-if="canViewBillingInvoiceAuditLogs"
                class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
                <div class="rounded-lg bg-muted/30 p-3">
                    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Audit entries
                    </p>
                    <p class="mt-2 text-xl font-semibold">
                        {{ auditSummary.total }}
                    </p>
                </div>
                <div class="rounded-lg bg-muted/30 p-3">
                    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        User actions
                    </p>
                    <p class="mt-2 text-xl font-semibold">
                        {{ auditSummary.userEntries }}
                    </p>
                </div>
                <div class="rounded-lg bg-muted/30 p-3">
                    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Export jobs
                    </p>
                    <p class="mt-2 text-xl font-semibold">
                        {{ auditSummary.exportJobs }}
                    </p>
                </div>
                <div class="rounded-lg bg-muted/30 p-3">
                    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Current view
                    </p>
                    <p class="mt-2 text-sm font-medium">
                        {{
                            auditHasActiveFilters
                                ? 'Filtered'
                                : 'All audit events'
                        }}
                    </p>
                </div>
            </div>

            <div
                v-if="auditActiveFilters.length"
                class="mt-3 flex flex-wrap gap-2"
            >
                <Badge
                    v-for="filter in auditActiveFilters"
                    :key="`bil-audit-filter-${filter.key}`"
                    variant="outline"
                >
                    {{ filter.label }}
                </Badge>
            </div>

            <Alert
                v-if="!canViewBillingInvoiceAuditLogs"
                class="mt-3"
            >
                <AlertTitle>Audit trail restricted</AlertTitle>
                <AlertDescription>
                    You do not have permission to view billing invoice audit logs.
                </AlertDescription>
            </Alert>

            <div
                v-if="
                    canViewBillingInvoiceAuditLogs &&
                    auditFiltersOpen
                "
                class="mt-3 space-y-3 rounded-lg bg-muted/30 p-3"
            >
                <div class="grid gap-3 sm:grid-cols-2">
                    <div class="grid gap-2 sm:col-span-2">
                        <Label for="bil-details-audit-q">
                            Action Search
                        </Label>
                        <Input
                            id="bil-details-audit-q"
                            v-model="auditLogsFilters.q"
                            placeholder="Search action text"
                            @keyup.enter="emit('submit-audit-logs-filters')"
                        />
                    </div>
                    <div class="grid gap-2">
                        <Label for="bil-details-audit-action">
                            Action
                        </Label>
                        <Select v-model="auditLogsFilters.action">
                            <SelectTrigger class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="">
                                All
                            </SelectItem>
                            <SelectItem
                                v-for="option in billingAuditActionOptions"
                                :key="`bil-audit-action-${option.value}`"
                                :value="option.value"
                            >
                                {{ option.label }}
                            </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="grid gap-2">
                        <Label for="bil-details-audit-actor-type">
                            Actor Type
                        </Label>
                        <Select v-model="auditLogsFilters.actorType">
                            <SelectTrigger class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem
                                v-for="option in billingAuditActorTypeOptions"
                                :key="`bil-audit-actor-type-${option.value || 'all'}`"
                                :value="option.value"
                            >
                                {{ option.label }}
                            </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="grid gap-2">
                        <Label for="bil-details-audit-actor-id">
                            Actor user ID
                        </Label>
                        <Input
                            id="bil-details-audit-actor-id"
                            v-model="auditLogsFilters.actorId"
                            inputmode="numeric"
                            placeholder="e.g. 12"
                            @keyup.enter="emit('submit-audit-logs-filters')"
                        />
                    </div>
                    <div class="grid gap-2 sm:col-span-2">
                        <DateRangeFilterPopover
                            input-base-id="bil-details-audit-date-range"
                            title="Audit Date"
                            helper-text="Filter audit events by created timestamp."
                            from-label="From"
                            to-label="To"
                            v-model:from="auditLogsFilters.from"
                            v-model:to="auditLogsFilters.to"
                        />
                    </div>
                </div>
                <div
                    class="grid gap-3 sm:grid-cols-[minmax(0,180px)_auto] sm:items-end"
                >
                    <div class="grid gap-2">
                        <Label for="bil-details-audit-per-page">
                            Results per page
                        </Label>
                        <Select v-model="auditLogsFilters.perPage">
                            <SelectTrigger class="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            size="sm"
                            :disabled="auditLogsLoading"
                            @click="emit('submit-audit-logs-filters')"
                        >
                            Apply Audit Filters
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            :disabled="auditLogsLoading"
                            @click="emit('reset-audit-logs-filters')"
                        >
                            Reset Audit Filters
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            :disabled="
                                auditLogsLoading ||
                                auditLogsExporting
                            "
                            @click="emit('export-audit-logs-csv')"
                        >
                            {{
                                auditLogsExporting
                                    ? 'Exporting CSV...'
                                    : 'Export CSV'
                            }}
                        </Button>
                    </div>
                </div>
            </div>

            <InvoiceDetailsAuditExportJobsPanel
                v-if="canViewBillingInvoiceAuditLogs"
                :jobs="auditExportJobs"
                :jobs-meta="auditExportJobsMeta"
                :jobs-filters="auditExportJobsFilters"
                :jobs-loading="auditExportJobsLoading"
                :jobs-error="auditExportJobsError"
                :job-summary="auditExportJobSummary"
                :ops-hint="auditExportOpsHint"
                :handoff-message="auditExportHandoffMessage"
                :handoff-error="auditExportHandoffError"
                :pinned-handoff-job="auditExportPinnedHandoffJob"
                :focus-job-id="auditExportFocusJobId"
                :retrying-job-id="auditExportRetryingJobId"
                @refresh="emit('refresh-audit-export-jobs')"
                @submit-filters="emit('submit-audit-export-jobs-filters')"
                @reset-filters="emit('reset-audit-export-jobs-filters')"
                @download-job="(job) => emit('download-audit-export-job', job)"
                @retry-job="(job) => emit('retry-audit-export-job', job)"
                @prev-page="emit('prev-audit-export-jobs-page')"
                @next-page="emit('next-audit-export-jobs-page')"
            />

            <InvoiceDetailsAuditLogsPanel
                v-if="canViewBillingInvoiceAuditLogs"
                :logs="auditLogs"
                :logs-meta="auditLogsMeta"
                :logs-loading="auditLogsLoading"
                :logs-error="auditLogsError"
                :audit-log-action-label="auditLogActionLabel"
                :audit-log-actor-label="auditLogActorLabel"
                :audit-actor-type-label="auditActorTypeLabel"
                :audit-change-summary="auditChangeSummary"
                :audit-change-keys="auditChangeKeys"
                :audit-metadata-preview="auditMetadataPreview"
                :audit-log-entries="auditLogEntries"
                :format-audit-log-json="formatAuditLogJson"
                :is-audit-log-expanded="isAuditLogExpanded"
                @toggle-log-expanded="(logId) => emit('toggle-audit-log-expanded', logId)"
                @prev-page="emit('prev-audit-logs-page')"
                @next-page="emit('next-audit-logs-page')"
            />
        </div>
    </TabsContent>
</template>
