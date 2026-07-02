<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatEnumLabel } from '@/lib/labels';
import { auditExportStatusGroupOptions } from '../constants';
import { formatDateTime } from '../helpers';
import type {
    AuditExportJobStatusSummary,
    BillingInvoiceAuditExportJob,
    BillingInvoiceAuditExportJobListResponse,
    InvoiceDetailsAuditExportJobsFilterForm,
} from '../types';

interface Props {
    jobs: BillingInvoiceAuditExportJob[];
    jobsMeta: BillingInvoiceAuditExportJobListResponse['meta'] | null;
    jobsFilters: InvoiceDetailsAuditExportJobsFilterForm;
    jobsLoading: boolean;
    jobsError: string | null;
    jobSummary: AuditExportJobStatusSummary;
    opsHint: string | null;
    handoffMessage: string | null;
    handoffError: boolean;
    pinnedHandoffJob: BillingInvoiceAuditExportJob | null;
    focusJobId: string | null;
    retryingJobId: string | null;
}

defineProps<Props>();

const emit = defineEmits<{
    refresh: [];
    'submit-filters': [];
    'reset-filters': [];
    'download-job': [job: BillingInvoiceAuditExportJob];
    'retry-job': [job: BillingInvoiceAuditExportJob];
    'prev-page': [];
    'next-page': [];
}>();
</script>

<template>
    <div class="mt-3 space-y-2 rounded-lg bg-muted/30 p-3">
        <div
            class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div>
                <p class="text-xs font-medium">Export Jobs</p>
                <p class="text-[11px] text-muted-foreground">
                    Recent audit CSV jobs for this invoice.
                </p>
            </div>
            <div class="flex items-center gap-2">
                <Badge variant="outline">
                    {{ jobsMeta?.total ?? 0 }} jobs
                </Badge>
                <Badge
                    v-if="jobSummary.backlog > 0"
                    variant="secondary"
                >
                    {{ jobSummary.backlog }} backlog
                </Badge>
                <Badge
                    v-if="jobSummary.failed > 0"
                    variant="destructive"
                >
                    {{ jobSummary.failed }} failed
                </Badge>
                <Badge
                    v-if="jobSummary.completed > 0"
                    variant="outline"
                >
                    {{ jobSummary.completed }} completed
                </Badge>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    :disabled="jobsLoading"
                    @click="emit('refresh')"
                >
                    {{ jobsLoading ? 'Refreshing...' : 'Refresh Jobs' }}
                </Button>
            </div>
        </div>

        <div
            class="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,180px)_auto] sm:items-end"
        >
            <div class="grid gap-2">
                <Label for="bil-details-audit-export-status">
                    Job status
                </Label>
                <Select v-model="jobsFilters.statusGroup">
                    <SelectTrigger class="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem
                        v-for="option in auditExportStatusGroupOptions"
                        :key="`bil-audit-export-status-${option.value}`"
                        :value="option.value"
                    >
                        {{ option.label }}
                    </SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div class="grid gap-2">
                <Label for="bil-details-audit-export-per-page">
                    Results per page
                </Label>
                <Select v-model="jobsFilters.perPage">
                    <SelectTrigger class="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="12">12</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div class="flex flex-wrap gap-2">
                <Button
                    type="button"
                    size="sm"
                    :disabled="jobsLoading"
                    @click="emit('submit-filters')"
                >
                    Apply Job Filters
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    :disabled="jobsLoading"
                    @click="emit('reset-filters')"
                >
                    Reset Job Filters
                </Button>
            </div>
        </div>

        <Alert
            v-if="
                !jobsLoading &&
                !jobsError &&
                opsHint
            "
            :variant="jobSummary.failed > 0 ? 'destructive' : 'default'"
        >
            <AlertTitle>Export queue status</AlertTitle>
            <AlertDescription>
                {{ opsHint }}
            </AlertDescription>
        </Alert>

        <Alert
            v-if="handoffMessage"
            :variant="handoffError ? 'destructive' : 'default'"
        >
            <AlertTitle>Retry handoff</AlertTitle>
            <AlertDescription>
                {{ handoffMessage }}
            </AlertDescription>
        </Alert>

        <Alert
            v-if="jobsError"
            variant="destructive"
        >
            <AlertTitle>Export jobs unavailable</AlertTitle>
            <AlertDescription>
                {{ jobsError }}
            </AlertDescription>
        </Alert>

        <div
            v-else-if="jobsLoading"
            class="space-y-2"
        >
            <Skeleton class="h-12 w-full" />
            <Skeleton class="h-12 w-full" />
        </div>

        <div
            v-else-if="jobs.length === 0"
            class="rounded-md border border-dashed p-3 text-xs text-muted-foreground"
        >
            No export jobs yet.
        </div>

        <div v-else class="space-y-2">
            <div
                v-if="pinnedHandoffJob"
                :id="`bil-audit-export-job-handoff-${pinnedHandoffJob.id}`"
                :class="[
                    'rounded-md border border-dashed p-2',
                    focusJobId === pinnedHandoffJob.id
                        ? 'border-destructive/60 ring-1 ring-destructive/40'
                        : '',
                ]"
            >
                <div
                    class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                >
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <Badge variant="outline">Handoff Target</Badge>
                            <p class="text-xs font-medium">
                                {{
                                    formatEnumLabel(
                                        pinnedHandoffJob.status || 'unknown',
                                    )
                                }}
                            </p>
                        </div>
                        <p class="text-[11px] text-muted-foreground">
                            Created
                            {{ formatDateTime(pinnedHandoffJob.createdAt) }}
                            | Rows
                            {{ pinnedHandoffJob.rowCount ?? 0 }}
                        </p>
                        <p
                            v-if="pinnedHandoffJob.errorMessage"
                            class="text-[11px] text-destructive break-words"
                        >
                            {{ pinnedHandoffJob.errorMessage }}
                        </p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <Button
                            v-if="pinnedHandoffJob.downloadUrl"
                            type="button"
                            size="sm"
                            variant="outline"
                            @click="emit('download-job', pinnedHandoffJob)"
                        >
                            Download
                        </Button>
                        <Button
                            v-if="pinnedHandoffJob.status === 'failed'"
                            type="button"
                            size="sm"
                            variant="outline"
                            :data-audit-export-retry-job-id="pinnedHandoffJob.id"
                            :disabled="retryingJobId === pinnedHandoffJob.id"
                            @click="emit('retry-job', pinnedHandoffJob)"
                        >
                            {{
                                retryingJobId === pinnedHandoffJob.id
                                    ? 'Retrying...'
                                    : 'Retry'
                            }}
                        </Button>
                    </div>
                </div>
            </div>

            <div
                v-for="job in jobs"
                :key="`bil-audit-export-job-${job.id}`"
                :id="`bil-audit-export-job-${job.id}`"
                :class="[
                    'rounded-md border p-2',
                    focusJobId === job.id
                        ? 'border-destructive/60 ring-1 ring-destructive/40'
                        : '',
                ]"
            >
                <div
                    class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                >
                    <div class="space-y-1">
                        <p class="text-xs font-medium">
                            {{ formatEnumLabel(job.status || 'unknown') }}
                        </p>
                        <p class="text-[11px] text-muted-foreground">
                            Created {{ formatDateTime(job.createdAt) }} | Rows {{ job.rowCount ?? 0 }}
                        </p>
                        <p
                            v-if="job.errorMessage"
                            class="text-[11px] text-destructive break-words"
                        >
                            {{ job.errorMessage }}
                        </p>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <Button
                            v-if="job.downloadUrl"
                            type="button"
                            size="sm"
                            variant="outline"
                            @click="emit('download-job', job)"
                        >
                            Download
                        </Button>
                        <Button
                            v-if="job.status === 'failed'"
                            type="button"
                            size="sm"
                            variant="outline"
                            :data-audit-export-retry-job-id="job.id"
                            :disabled="retryingJobId === job.id"
                            @click="emit('retry-job', job)"
                        >
                            {{
                                retryingJobId === job.id
                                    ? 'Retrying...'
                                    : 'Retry'
                            }}
                        </Button>
                    </div>
                </div>
            </div>

            <div
                class="flex flex-wrap items-center justify-between gap-2 border-t pt-2"
            >
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    :disabled="
                        jobsLoading ||
                        !jobsMeta ||
                        jobsMeta.currentPage <= 1
                    "
                    @click="emit('prev-page')"
                >
                    Previous
                </Button>
                <span class="text-[11px] text-muted-foreground">
                    Page {{ jobsMeta?.currentPage ?? 1 }}
                    of {{ jobsMeta?.lastPage ?? 1 }}
                </span>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    :disabled="
                        jobsLoading ||
                        !jobsMeta ||
                        jobsMeta.currentPage >= jobsMeta.lastPage
                    "
                    @click="emit('next-page')"
                >
                    Next
                </Button>
            </div>
        </div>
    </div>
</template>
