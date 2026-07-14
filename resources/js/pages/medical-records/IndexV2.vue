<script setup lang="ts">
import { Head, Link, router } from '@inertiajs/vue3';
import { computed, onMounted, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import PatientQuickSearchField from '@/components/patients/PatientQuickSearchField.vue';
import { type PatientQuickSearchResult } from '@/composables/patients/usePatientQuickSearch';
import EncounterHistorySheet from '@/components/clinical/panels/EncounterHistorySheet.vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiGet } from '@/lib/apiClient';
import { formatEnumLabel } from '@/lib/labels';
import { encounterWorkspaceHrefForRecord, encounterWorkspaceLegacyAppointmentHref } from '@/lib/encounterWorkspace';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import {
    useMedicalRecordList,
    useMedicalRecordStatusCounts,
    type MedicalRecordListItem,
} from '@/composables/medicalRecordsIndex/useMedicalRecordList';
import { useMedicalRecordListFilters } from '@/composables/medicalRecordsIndex/useMedicalRecordListFilters';
import { usePatientDirectory } from '@/composables/medicalRecordsIndex/usePatientDirectory';
import { useMedicalRecordStatusAction } from '@/composables/medicalRecordsIndex/useMedicalRecordStatusAction';
import { MEDICAL_RECORD_NOTE_TYPE_OPTIONS, medicalRecordNoteTypeLabel } from '@/pages/medical-records/noteTypes';
import { type BreadcrumbItem } from '@/types';

/**
 * Phase 1-2 of the Medical Records Index rebuild
 * (reports/medical-records-index-rebuild-plan.md): foundation, list/filters,
 * status actions (finalize/amend/archive), and the detail sheet (version
 * history/signer attestation/audit log, reused as-is from Phase 4 of the
 * note-composer rebuild via EncounterHistorySheet.vue — that component is
 * generic despite its name, not WorkspaceV2-specific). Reachable only via
 * /medical-records/v2 when FRONTEND_MEDICAL_RECORDS_INDEX_V2_ENABLED=true;
 * the existing /medical-records page is completely unaffected.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canReadMedicalRecords = computed(() => hasAccess('medical.records.read'));
const canFinalizeMedicalRecords = computed(() => hasAccess('medical.records.finalize'));
const canAmendMedicalRecords = computed(() => hasAccess('medical.records.amend'));
const canArchiveMedicalRecords = computed(() => hasAccess('medical.records.archive'));
const canAttestMedicalRecords = computed(() => hasAccess('medical.records.attest'));
const canViewMedicalRecordAuditLogs = computed(() => hasAccess('medical-records.view-audit-logs'));

const filters = useMedicalRecordListFilters();
const listQuery = useMedicalRecordList(filters);
const statusCountsQuery = useMedicalRecordStatusCounts(filters);

const records = computed(() => listQuery.data.value?.data ?? []);
const meta = computed(() => listQuery.data.value?.meta ?? null);
const statusCounts = computed(() => statusCountsQuery.data.value ?? null);

const visiblePatientIds = computed(() => records.value.map((record) => record.patientId).filter((id): id is string => Boolean(id)));
const patientDirectory = usePatientDirectory(visiblePatientIds);

function patientLabel(patientId: string | null): string {
    if (!patientId) return 'Not linked';
    const summary = patientDirectory.directory.value[patientId];
    if (!summary) return 'Loading…';

    const name = [summary.firstName, summary.middleName, summary.lastName].filter(Boolean).join(' ').trim();
    return name || summary.patientNumber || patientId;
}

const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'finalized', label: 'Finalized' },
    { value: 'amended', label: 'Amended' },
    { value: 'archived', label: 'Archived' },
];

function statusCount(status: string): number | null {
    if (!statusCounts.value) return null;
    if (status === 'all') return statusCounts.value.total ?? null;
    return statusCounts.value[status as keyof typeof statusCounts.value] ?? null;
}

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}

const { scrollContainerHeight } = useStickyScrollContainer();

function statusBadgeVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'finalized':
            return 'secondary';
        case 'amended':
            return 'default';
        case 'archived':
            return 'outline';
        default:
            return 'outline';
    }
}

function formatDateTime(value: string | null): string {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

const patientSearchQuery = ref('');

/**
 * PatientQuickSearchField, not PatientLookupField — a filter row (narrow
 * the list) doesn't need PatientLookupField's selected-patient summary
 * card (name/PT number/status/phone/demographics), which pushes this
 * whole filter grid down. Matches Reception Queue's own convention for
 * this kind of dense filter search.
 */
function onPatientSelected(patient: PatientQuickSearchResult | null): void {
    filters.patientId = patient?.id ?? '';
    filters.page = 1;
}

function resetFilters(): void {
    filters.q = '';
    filters.status = '';
    filters.recordType = '';
    filters.patientId = '';
    patientSearchQuery.value = '';
    filters.encounterId = '';
    filters.appointmentId = '';
    filters.appointmentReferralId = '';
    filters.admissionId = '';
    filters.theatreProcedureId = '';
    filters.from = '';
    filters.to = '';
    filters.page = 1;
}

function goToPage(page: number): void {
    filters.page = page;
}

const historySheetOpen = ref(false);
const historySheetTab = ref('versions');
const historySheetRecordId = ref<string | null>(null);

function openHistorySheet(record: MedicalRecordListItem, initialTab: string = 'versions'): void {
    historySheetRecordId.value = record.id;
    historySheetTab.value = initialTab;
    historySheetOpen.value = true;
}

const statusAction = useMedicalRecordStatusAction({
    canFinalize: () => canFinalizeMedicalRecords.value,
    canAmend: () => canAmendMedicalRecords.value,
    canArchive: () => canArchiveMedicalRecords.value,
    onChanged: (updated) => {
        void listQuery.refetch();
        void statusCountsQuery.refetch();

        // Matches the old page's post-finalize follow-up: jump straight to
        // the attestation tab so signing off doesn't require a second click.
        if (updated.status === 'finalized') {
            openHistorySheet(updated, 'attestations');
        }
    },
});

function encounterWorkspaceLink(record: MedicalRecordListItem): string {
    return encounterWorkspaceHrefForRecord(record, { from: 'medical-records' });
}

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

function appointmentsEntryHref(patientIdValue?: string): string {
    const params = new URLSearchParams();
    if (patientIdValue) params.set('patientId', patientIdValue);
    params.set('from', 'medical-records');
    return `/appointments?${params.toString()}`;
}

async function openRecordFromDeepLink(recordId: string): Promise<void> {
    try {
        const response = await apiGet<{ data: MedicalRecordListItem }>(`/medical-records/${recordId}`);
        openHistorySheet(response.data);
    } catch {
        // Non-blocking — the record may have been removed or is inaccessible; the registry still loads normally.
    }
}

/**
 * Ports the old page's redirect-on-mount behavior (reports/medical-records-index-rebuild-plan.md
 * §9.3): visiting with ?tab=new or an appointment/admission context means the
 * caller wants to *create* a note, which is already fully delegated to the
 * Encounter Workspace / appointment-entry flow — this registry page must not
 * grow note-creation back into itself.
 *
 * Fix applied here (§8 decision) for the admission-only edge case: the old
 * page's redirect silently fell through to an unfiltered registry view when
 * admissionId was present but appointmentId/patientId were both empty and
 * tab !== 'new' — confirmed in Phase 0 as unreachable in practice (no real
 * link constructs this URL shape) and, more importantly, there's no route
 * that resolves an encounter workspace from admissionId alone to redirect to.
 * Rather than reproduce the silent fallthrough, this applies admissionId as
 * a registry filter instead — a deliberate, correct behavior, not a guess at
 * a route that doesn't exist.
 */
onMounted(() => {
    const tab = queryParam('tab');
    const appointmentId = queryParam('appointmentId');
    const admissionId = queryParam('admissionId');
    const patientId = queryParam('patientId');
    const recordId = queryParam('recordId');

    if (tab === 'new' || appointmentId || admissionId) {
        if (appointmentId) {
            router.visit(encounterWorkspaceLegacyAppointmentHref(appointmentId, { from: 'medical-records' }), { replace: true });
            return;
        }

        if (patientId) {
            router.visit(appointmentsEntryHref(patientId), { replace: true });
            return;
        }

        if (tab === 'new') {
            router.visit(appointmentsEntryHref(), { replace: true });
            return;
        }

        filters.admissionId = admissionId;
    }

    if (patientId) {
        filters.patientId = patientId;
    }

    if (recordId) {
        void openRecordFromDeepLink(recordId);
    }
});

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Medical Records', href: '/medical-records/v2' }];
</script>

<template>
    <Head title="Medical Records" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <Tabs :model-value="filters.status || 'all'" class="contents" @update:model-value="setStatus">
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Medical Records</h1>
                        <p class="text-xs text-muted-foreground">Health Information: search and govern clinical notes across all patients — finalize, amend, archive.</p>
                    </div>
                    <Badge v-if="statusCounts" variant="secondary">{{ statusCounts.total }} notes</Badge>
                </div>

                <div v-if="canReadMedicalRecords" class="mt-3 grid grid-cols-5 gap-2">
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCount('all') ?? '—' }}</p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Draft</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCount('draft') ?? '—' }}</p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Finalized</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCount('finalized') ?? '—' }}</p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Amended</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCount('amended') ?? '—' }}</p>
                    </div>
                    <div class="rounded-md bg-muted/30 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Archived</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCount('archived') ?? '—' }}</p>
                    </div>
                </div>

                <TabsList v-if="canReadMedicalRecords" class="mt-3 grid w-full grid-cols-5">
                    <TabsTrigger
                        v-for="option in statusOptions"
                        :key="option.value"
                        :value="option.value"
                        class="inline-flex items-center gap-1.5"
                    >
                        {{ option.label }}
                        <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                            {{ statusCount(option.value) ?? '—' }}
                        </Badge>
                    </TabsTrigger>
                </TabsList>
            </div>

            <div class="space-y-4 px-6 pb-6">
            <Alert v-if="!canReadMedicalRecords" variant="destructive">
                <AlertTitle>Access required</AlertTitle>
                <AlertDescription>Viewing the clinical note registry requires <code>medical.records.read</code>.</AlertDescription>
            </Alert>

            <template v-else>
                <div class="rounded-lg border bg-background p-4">
                    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div class="grid gap-1.5 xl:col-span-2">
                            <Label for="mri-search">Search</Label>
                            <Input id="mri-search" v-model="filters.q" placeholder="Record number, assessment, plan, diagnosis code" @keyup.enter="filters.page = 1" />
                        </div>
                        <div class="grid gap-1.5">
                            <Label for="mri-patient">Patient</Label>
                            <PatientQuickSearchField
                                v-model:query="patientSearchQuery"
                                input-id="mri-patient"
                                placeholder="Search patient by name, MRN, or phone…"
                                @selected="onPatientSelected"
                            />
                        </div>
                        <div class="grid gap-1.5">
                            <Label for="mri-record-type">Note type</Label>
                            <select
                                id="mri-record-type"
                                v-model="filters.recordType"
                                class="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                @change="filters.page = 1"
                            >
                                <option value="">All note types</option>
                                <option v-for="option in MEDICAL_RECORD_NOTE_TYPE_OPTIONS" :key="option.value" :value="option.value">
                                    {{ option.label }}
                                </option>
                            </select>
                        </div>
                        <div class="grid gap-1.5 xl:col-span-2">
                            <DateRangeFilterPopover
                                input-base-id="mri-date-range"
                                title="Encounter date range"
                                :from="filters.from"
                                :to="filters.to"
                                @update:from="(value) => { filters.from = value; filters.page = 1; }"
                                @update:to="(value) => { filters.to = value; filters.page = 1; }"
                            />
                        </div>
                        <div class="flex items-end">
                            <Button variant="outline" size="sm" @click="resetFilters">Reset filters</Button>
                        </div>
                    </div>
                </div>

                <div v-if="listQuery.isPending.value" class="space-y-2">
                    <Skeleton class="h-10 w-full" />
                    <Skeleton class="h-10 w-full" />
                    <Skeleton class="h-10 w-full" />
                </div>

                <Alert v-else-if="listQuery.isError.value" variant="destructive">
                    <AlertTitle>Unable to load clinical notes</AlertTitle>
                    <AlertDescription>{{ (listQuery.error.value as Error | null)?.message ?? 'Unknown error.' }}</AlertDescription>
                </Alert>

                <div v-else-if="records.length === 0" class="rounded-lg border border-dashed px-5 py-5">
                    <p class="text-base font-medium text-foreground">No clinical notes match these filters</p>
                    <p class="mt-1 text-sm text-muted-foreground">Adjust the search, patient, or date range filters above.</p>
                </div>

                <div v-else class="overflow-x-auto rounded-lg border">
                    <table class="w-full text-sm">
                        <thead class="border-b bg-muted/30 text-xs text-muted-foreground uppercase">
                            <tr>
                                <th class="px-3 py-2 text-left">Record</th>
                                <th class="px-3 py-2 text-left">Patient</th>
                                <th class="px-3 py-2 text-left">Type</th>
                                <th class="px-3 py-2 text-left">Status</th>
                                <th class="px-3 py-2 text-left">Encounter date</th>
                                <th class="px-3 py-2 text-left">Diagnosis</th>
                                <th class="px-3 py-2 text-left">Author</th>
                                <th class="px-3 py-2 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="record in records" :key="record.id" class="border-b last:border-b-0 hover:bg-muted/20">
                                <td class="px-3 py-2 font-medium text-foreground">{{ record.recordNumber || 'Pending number' }}</td>
                                <td class="px-3 py-2">{{ patientLabel(record.patientId) }}</td>
                                <td class="px-3 py-2 text-muted-foreground">{{ medicalRecordNoteTypeLabel(record.recordType ?? '') }}</td>
                                <td class="px-3 py-2">
                                    <Badge :variant="statusBadgeVariant(record.status)">{{ formatEnumLabel(record.status ?? 'draft') }}</Badge>
                                </td>
                                <td class="px-3 py-2 text-muted-foreground">{{ formatDateTime(record.encounterAt) }}</td>
                                <td class="px-3 py-2 text-muted-foreground">{{ record.diagnosisCode || 'N/A' }}</td>
                                <td class="px-3 py-2 text-muted-foreground">{{ record.authorUserName || 'Unknown' }}</td>
                                <td class="px-3 py-2">
                                    <div class="flex flex-wrap gap-1.5">
                                        <Button size="sm" variant="outline" class="h-7 px-2 text-xs" @click="openHistorySheet(record)">
                                            History
                                        </Button>
                                        <Button
                                            v-if="record.encounterId || record.appointmentId"
                                            size="sm"
                                            variant="outline"
                                            class="h-7 gap-1 px-2 text-xs"
                                            as-child
                                        >
                                            <Link :href="encounterWorkspaceLink(record)">
                                                <AppIcon name="arrow-up-right" class="size-3" />Open encounter
                                            </Link>
                                        </Button>
                                        <Button
                                            v-if="statusAction.canApply('finalized', record)"
                                            size="sm"
                                            variant="outline"
                                            class="h-7 px-2 text-xs"
                                            @click="statusAction.openDialog(record, 'finalized')"
                                        >
                                            Finalize
                                        </Button>
                                        <Button
                                            v-if="statusAction.canApply('amended', record)"
                                            size="sm"
                                            variant="outline"
                                            class="h-7 px-2 text-xs"
                                            @click="statusAction.openDialog(record, 'amended')"
                                        >
                                            Amend
                                        </Button>
                                        <Button
                                            v-if="statusAction.canApply('archived', record)"
                                            size="sm"
                                            variant="outline"
                                            class="h-7 px-2 text-xs"
                                            @click="statusAction.openDialog(record, 'archived')"
                                        >
                                            Archive
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div v-if="meta && meta.lastPage > 1" class="flex items-center justify-between text-sm text-muted-foreground">
                    <p>Page {{ meta.currentPage }} of {{ meta.lastPage }} ({{ meta.total }} total)</p>
                    <div class="flex gap-2">
                        <Button size="sm" variant="outline" :disabled="meta.currentPage <= 1" @click="goToPage(meta.currentPage - 1)">
                            <AppIcon name="chevron-left" class="size-3.5" />Previous
                        </Button>
                        <Button size="sm" variant="outline" :disabled="meta.currentPage >= meta.lastPage" @click="goToPage(meta.currentPage + 1)">
                            Next<AppIcon name="chevron-right" class="size-3.5" />
                        </Button>
                    </div>
                </div>

                <Dialog :open="statusAction.dialogOpen.value" @update:open="(value) => (value ? undefined : statusAction.closeDialog())">
                    <DialogContent variant="action" size="lg">
                        <DialogHeader>
                            <DialogTitle>
                                {{
                                    statusAction.action.value === 'finalized'
                                        ? 'Finalize Clinical Note'
                                        : statusAction.action.value === 'amended'
                                          ? 'Amend Clinical Note'
                                          : 'Archive Clinical Note'
                                }}
                            </DialogTitle>
                            <DialogDescription>
                                <template v-if="statusAction.action.value === 'finalized'">
                                    Confirm finalization for {{ statusAction.targetRecord.value?.recordNumber ?? 'this clinical note' }}. Attestation and status audit remain available after finalization.
                                </template>
                                <template v-else-if="statusAction.action.value === 'amended'">
                                    Provide an amendment reason for {{ statusAction.targetRecord.value?.recordNumber ?? 'this clinical note' }}. The note will reopen as a draft so you can correct it, then finalize the amendment when ready.
                                </template>
                                <template v-else>
                                    Provide an archive reason for {{ statusAction.targetRecord.value?.recordNumber ?? 'this clinical note' }}.
                                </template>
                            </DialogDescription>
                        </DialogHeader>
                        <div v-if="statusAction.needsReason(statusAction.action.value)" class="grid gap-2">
                            <Label for="mri-status-reason">Reason</Label>
                            <Textarea id="mri-status-reason" v-model="statusAction.reason.value" rows="3" placeholder="Document the clinical reason for this status change." />
                        </div>
                        <p v-if="statusAction.error.value" class="text-sm text-destructive">{{ statusAction.error.value }}</p>
                        <DialogFooter class="gap-2">
                            <Button variant="outline" :disabled="statusAction.submitting.value" @click="statusAction.closeDialog()">Cancel</Button>
                            <Button :disabled="statusAction.submitting.value" @click="void statusAction.submitDialog()">
                                {{ statusAction.submitting.value ? 'Saving...' : 'Confirm' }}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <EncounterHistorySheet
                    v-model:open="historySheetOpen"
                    v-model:tab="historySheetTab"
                    :record-id="historySheetRecordId"
                    :can-create-attestation="canAttestMedicalRecords"
                    :can-view-audit-logs="canViewMedicalRecordAuditLogs"
                />
            </template>
            </div>
            </Tabs>
        </div>
    </AppLayout>
</template>
