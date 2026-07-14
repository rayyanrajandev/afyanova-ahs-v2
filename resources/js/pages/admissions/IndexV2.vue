<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdmissionAdtTimelinePanel from '@/components/admissions/AdmissionAdtTimelinePanel.vue';
import AdmissionStatusDialog, {
    type AdmissionStatusTargetRequest,
} from '@/components/admissions/AdmissionStatusDialog.vue';
import CreateAdmissionSheet from '@/components/admissions/CreateAdmissionSheet.vue';
import PatientSummaryPopover from '@/components/patients/summary/PatientSummaryPopover.vue';
import AuditLogSheet from '@/components/shared/AuditLogSheet.vue';
import { useAdmissionAuditLog } from '@/composables/admissions/useAdmissionAuditLog';
import { useAdmissionFilters } from '@/composables/admissions/useAdmissionFilters';
import { useAdmissionPatientDirectory } from '@/composables/admissions/useAdmissionPatientDirectory';
import { useAdmissionStatusCounts } from '@/composables/admissions/useAdmissionStatusCounts';
import { useAdmissions, type Admission } from '@/composables/admissions/useAdmissions';
import { type AdmissionStatusTarget } from '@/composables/admissions/useUpdateAdmissionStatus';
import { useAvailableBeds, type AvailableBed } from '@/composables/admissions/useAvailableBeds';
import { useWardBedGroups } from '@/composables/admissions/useWardBedGroups';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { notifyInfo, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Admission V2 + real bed assignment plan, Phase 3: a from-scratch page
 * over AdmissionModel, replacing admissions/Index.vue (8,096 lines — now
 * marked Legacy and un-nav-linked, same treatment as /patients/legacy,
 * /appointments/legacy, walk-in-service-requests/Index.vue). Copies
 * directService/Queue.vue's shape verbatim (sticky header + KPI cards +
 * Tabs status filter + bounded auto-scroll container) — the reusable part
 * across this codebase's queue pages is the PATTERN, not shared runtime
 * code.
 *
 * KPI cards: Admitted / Discharged today / Transferred / Total.
 * "Discharged today" is a genuinely separate, discharged_at-scoped count
 * (dischargedInRange) from the admitted_at-scoped `discharged` count the
 * same endpoint also returns — a patient discharged today may have been
 * admitted days ago and wouldn't show up in an admitted_at-filtered count.
 *
 * Row actions only render for admitted/transferred admissions (both are
 * "ongoing" states) — discharged/cancelled are terminal, matching
 * AdmissionStatus's flat enum having no forward-transition-graph
 * enforcement server-side (unlike Appointment/ServiceRequest), so this
 * UI's gating is the only place the "only actionable while ongoing"
 * semantics live.
 *
 * Explicit non-goals for this phase (deferred, not built here): discharge-
 * checklist PDF generation (stays on the legacy page / Inpatient Ward
 * module), cross-tenant admin admission search, billing payer contract
 * picker (coverage inherits from the linked appointment only), audit log
 * viewer/CSV export UI, and editing non-status admission fields post-
 * creation.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canRead = computed(() => hasAccess('admissions.read'));
const canCreate = computed(() => hasAccess('admissions.create'));
const canUpdateStatus = computed(() => hasAccess('admissions.update-status'));
const canViewAuditLogs = computed(() => hasAccess('admissions.view-audit-logs'));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Admissions', href: '/admissions' },
]);

const filters = useAdmissionFilters();
const list = useAdmissions(filters);
const statusCounts = useAdmissionStatusCounts(filters);

const admissions = computed(() => list.data.value?.data ?? []);
const meta = computed(() => list.data.value?.meta ?? null);

const patientIds = computed(() => admissions.value.map((item) => item.patientId ?? '').filter(Boolean));
const patientDirectory = useAdmissionPatientDirectory(patientIds);

// AdmA of the Admission V2 full-parity plan: rows expand in place instead
// of opening a detail drawer — same pattern emergency/Queue.vue already
// established (no hub/tabs, everything stays in the scannable list).
const expandedAdmissionIds = ref<Set<string>>(new Set());

function isExpanded(admissionId: string): boolean {
    return expandedAdmissionIds.value.has(admissionId);
}

function toggleExpanded(admissionId: string, open: boolean): void {
    const next = new Set(expandedAdmissionIds.value);
    if (open) {
        next.add(admissionId);
    } else {
        next.delete(admissionId);
    }
    expandedAdmissionIds.value = next;
}

// AdmB: one audit sheet reused across every row, same "single overlay,
// re-targeted" pattern as the status dialog below.
const auditSheetOpen = ref(false);
const auditSheetAdmissionId = ref<string | null>(null);
const auditSheetAdmissionNumber = ref<string | null>(null);
const admissionAuditLog = useAdmissionAuditLog(auditSheetAdmissionId);

function openAuditSheet(item: Admission): void {
    auditSheetAdmissionId.value = item.id;
    auditSheetAdmissionNumber.value = item.admissionNumber;
    auditSheetOpen.value = true;
}

// P4 of the Reception/Emergency/Admission/Bed-Management audit
// follow-through: a ward-level occupancy board, visible during admission
// without navigating elsewhere. useAvailableBeds() already returns every
// active bed including occupied ones — no backend change needed.
const wardBeds = useAvailableBeds();
const wardBedGroups = useWardBedGroups(computed(() => wardBeds.data.value?.data ?? []));

function bedCardClass(bed: { isOccupied: boolean; status: string | null }): string {
    if (bed.status === 'maintenance') return 'border-destructive/40 bg-destructive/5';
    if (bed.isOccupied) return 'border-primary/30 bg-primary/5';
    return 'border-emerald-500/30 bg-emerald-500/5';
}

const wardBoardOpen = ref(false);

// AdmE of the Admission V2 full-parity plan: clicking an occupied bed card
// jumps to its admission — using occupiedByAdmissionId (already returned by
// the FK-based available-beds endpoint) rather than any ward/bed string
// matching. Only works when the admission is already in the loaded page/
// filter (the common case); otherwise points the user at the admission
// number instead of failing silently.
function goToOccupyingAdmission(bed: AvailableBed): void {
    if (!bed.occupiedByAdmissionId) return;
    const admissionId = bed.occupiedByAdmissionId;
    const match = admissions.value.find((item) => item.id === admissionId);
    if (!match) {
        notifyInfo(`Admission ${bed.occupiedByAdmissionNumber ?? ''} isn't in the current list view — adjust filters or search to find it.`.trim());
        return;
    }
    toggleExpanded(admissionId, true);
    requestAnimationFrame(() => {
        document.getElementById(`admission-row-${admissionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}

function statusVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'admitted':
            return 'default';
        case 'transferred':
            return 'outline';
        case 'discharged':
            return 'secondary';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function bedLabel(item: Admission): string {
    if (item.bedResource) {
        return `${item.bedResource.wardName ?? 'Ward'} — ${item.bedResource.bedNumber ?? 'Bed'}`;
    }
    if (item.ward || item.bed) {
        return [item.ward, item.bed].filter(Boolean).join(' — ');
    }
    return 'No bed assigned';
}

function goToPage(page: number): void {
    filters.page = page;
}

type Transition = { target: AdmissionStatusTarget; label: string; destructive: boolean };
function availableTransitions(status: string | null): Transition[] {
    if (status === 'admitted' || status === 'transferred') {
        return [
            { target: 'discharged', label: 'Discharge', destructive: false },
            { target: 'transferred', label: 'Transfer', destructive: false },
            { target: 'cancelled', label: 'Cancel', destructive: true },
        ];
    }
    return [];
}

const queryClient = useQueryClient();

async function invalidateQueueAndCounts(): Promise<void> {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admissions-index'] }),
        queryClient.invalidateQueries({ queryKey: ['admissions-index-status-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['available-beds'] }),
    ]);
}

const statusDialogOpen = ref(false);
const statusDialogTarget = ref<AdmissionStatusTargetRequest | null>(null);
const statusDialogAction = ref<AdmissionStatusTarget | null>(null);

function openStatusDialog(item: Admission, action: AdmissionStatusTarget): void {
    statusDialogTarget.value = {
        admissionId: item.id,
        admissionNumber: item.admissionNumber,
        currentWardName: item.bedResource?.wardName ?? item.ward,
        patientId: item.patientId,
        admittedAt: item.admittedAt,
        createdAt: item.createdAt,
    };
    statusDialogAction.value = action;
    statusDialogOpen.value = true;
}

async function onStatusUpdated(): Promise<void> {
    await invalidateQueueAndCounts();
}

const createSheetOpen = ref(false);

async function onAdmissionCreated(admission: Admission): Promise<void> {
    notifySuccess(`Admission ${admission.admissionNumber ?? ''} created.`);
    await invalidateQueueAndCounts();
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Admissions" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Admissions</h1>
                        <p class="text-xs text-muted-foreground">Inpatient admissions and bed assignments.</p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Badge v-if="meta" variant="secondary">{{ meta.total }} admissions</Badge>
                        <Button v-if="canCreate" size="sm" class="h-8 gap-1.5" @click="createSheetOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            Admit patient
                        </Button>
                    </div>
                </div>

                <div v-if="canRead" class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Admitted</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.admitted ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Discharged today</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.dischargedInRange ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Transferred</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.transferred ?? '—' }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCounts.data.value?.total ?? '—' }}</p>
                    </div>
                </div>

                <Tabs v-if="canRead" :model-value="filters.status || 'all'" class="mt-3" @update:model-value="setStatus">
                    <TabsList class="grid w-full grid-cols-4">
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.total ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="admitted" class="inline-flex items-center gap-1.5">
                            Admitted
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.admitted ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="transferred" class="inline-flex items-center gap-1.5">
                            Transferred
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.transferred ?? '—' }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="discharged" class="inline-flex items-center gap-1.5">
                            Discharged
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ statusCounts.data.value?.discharged ?? '—' }}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canRead" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing admissions requires <code>admissions.read</code>.</AlertDescription>
                </Alert>

                <template v-else>
                    <Collapsible v-model:open="wardBoardOpen" class="overflow-hidden rounded-lg border bg-card shadow-sm">
                        <CollapsibleTrigger class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left [&[data-state=open]_[data-slot=chevron]]:rotate-90">
                            <div class="flex items-center gap-2">
                                <AppIcon data-slot="chevron" name="chevron-right" class="size-3.5 text-muted-foreground transition-transform duration-200" />
                                <span class="text-sm font-medium">Ward &amp; bed availability</span>
                            </div>
                            <Badge v-if="wardBeds.data.value" variant="secondary" class="text-[10px]">
                                {{ wardBeds.data.value.data.filter((bed) => !bed.isOccupied).length }} available / {{ wardBeds.data.value.data.length }} beds
                            </Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div class="space-y-4 border-t bg-muted/10 px-3 py-3">
                                <Skeleton v-if="wardBeds.isPending.value" class="h-20 w-full" />
                                <Alert v-else-if="wardBeds.isError.value" variant="destructive">
                                    <AlertTitle>Unable to load ward and bed availability</AlertTitle>
                                    <AlertDescription>{{ (wardBeds.error.value as Error | null)?.message ?? 'Unknown error.' }}</AlertDescription>
                                </Alert>
                                <p v-else-if="wardBedGroups.length === 0" class="text-sm text-muted-foreground">No wards or beds configured.</p>
                                <template v-else>
                                    <div v-for="group in wardBedGroups" :key="group.wardName" class="space-y-1.5">
                                        <p class="text-xs font-semibold text-foreground">{{ group.wardName }}</p>
                                        <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                            <div
                                                v-for="bed in group.beds"
                                                :key="bed.id"
                                                :role="bed.isOccupied && bed.occupiedByAdmissionId ? 'button' : undefined"
                                                :tabindex="bed.isOccupied && bed.occupiedByAdmissionId ? 0 : undefined"
                                                class="rounded-md border px-2.5 py-1.5"
                                                :class="[bedCardClass(bed), bed.isOccupied && bed.occupiedByAdmissionId ? 'cursor-pointer transition-colors hover:bg-primary/10' : '']"
                                                @click="bed.isOccupied && bed.occupiedByAdmissionId ? goToOccupyingAdmission(bed) : undefined"
                                                @keydown.enter="bed.isOccupied && bed.occupiedByAdmissionId ? goToOccupyingAdmission(bed) : undefined"
                                            >
                                                <p class="text-xs font-medium text-foreground">{{ bed.bedNumber }}</p>
                                                <p class="text-[11px] text-muted-foreground">
                                                    <template v-if="bed.status === 'maintenance'">Maintenance</template>
                                                    <template v-else-if="bed.isOccupied">{{ bed.occupiedByAdmissionNumber ?? 'Occupied' }}</template>
                                                    <template v-else>Available</template>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>

                    <div v-if="list.isPending.value" class="space-y-2">
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-16 w-full" />
                    </div>

                    <Alert v-else-if="list.isError.value" variant="destructive">
                        <AlertTitle>Unable to load admissions</AlertTitle>
                        <AlertDescription>{{ (list.error.value as Error | null)?.message ?? 'Unknown error.' }}</AlertDescription>
                    </Alert>

                    <div
                        v-else-if="admissions.length === 0"
                        class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
                    >
                        No admissions found.
                    </div>

                    <ul v-else class="space-y-2">
                        <Collapsible
                            v-for="item in admissions"
                            :key="item.id"
                            :id="`admission-row-${item.id}`"
                            :open="isExpanded(item.id)"
                            as="li"
                            class="overflow-hidden rounded-lg border bg-card shadow-sm"
                            @update:open="(open) => toggleExpanded(item.id, open)"
                        >
                            <div class="flex flex-wrap items-start justify-between gap-3 p-3">
                                <CollapsibleTrigger as-child>
                                    <div class="min-w-0 flex-1 cursor-pointer space-y-1.5 [&[data-state=open]_[data-slot=chevron]]:rotate-90">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <AppIcon data-slot="chevron" name="chevron-right" class="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200" />
                                            <span class="font-mono text-xs text-muted-foreground">{{ item.admissionNumber || 'Admission' }}</span>
                                            <Badge :variant="statusVariant(item.status)">{{ item.status || 'unknown' }}</Badge>
                                            <Badge variant="outline">{{ bedLabel(item) }}</Badge>
                                        </div>
                                        <div class="min-w-0 pl-5.5">
                                            <p class="truncate font-medium text-foreground">{{ patientDirectory.displayName(item.patientId) }}</p>
                                            <p class="truncate text-xs text-muted-foreground">
                                                {{ patientDirectory.patientNumber(item.patientId) || 'No MRN assigned' }}
                                            </p>
                                            <p class="text-xs text-muted-foreground">{{ item.admissionReason || 'No admission reason recorded' }}</p>
                                            <p class="text-[11px] text-muted-foreground">Admitted {{ formatDateTime(item.admittedAt) }}</p>
                                        </div>
                                    </div>
                                </CollapsibleTrigger>

                                <div v-if="canUpdateStatus" class="flex shrink-0 flex-wrap items-center justify-end gap-1">
                                    <Button
                                        v-for="transition in availableTransitions(item.status)"
                                        :key="transition.target"
                                        size="sm"
                                        :variant="transition.destructive ? 'ghost' : 'outline'"
                                        :class="['h-7 px-2 text-xs', transition.destructive ? 'text-destructive hover:text-destructive' : '']"
                                        @click="openStatusDialog(item, transition.target)"
                                    >
                                        {{ transition.label }}
                                    </Button>
                                </div>
                            </div>

                            <CollapsibleContent>
                                <div class="space-y-3 border-t bg-muted/10 px-3 py-3 pl-9">
                                    <div class="flex items-center gap-2">
                                        <PatientSummaryPopover v-if="item.patientId" :patient-id="item.patientId">
                                            <template #trigger>
                                                <button type="button" class="text-xs font-medium text-primary hover:underline">
                                                    Patient summary
                                                </button>
                                            </template>
                                            <template #actions>
                                                <a :href="`/patients/${item.patientId}/chart`" class="text-xs font-medium text-primary hover:underline">
                                                    View chart
                                                </a>
                                            </template>
                                        </PatientSummaryPopover>
                                        <a v-if="item.appointmentId" :href="`/appointments/${item.appointmentId}`" class="text-xs font-medium text-primary hover:underline">
                                            View linked appointment
                                        </a>
                                        <button
                                            v-if="canViewAuditLogs"
                                            type="button"
                                            class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                            @click="openAuditSheet(item)"
                                        >
                                            <AppIcon name="clock" class="size-3.5" />
                                            Activity
                                        </button>
                                    </div>

                                    <div v-if="item.dischargeDestination || item.followUpPlan" class="grid gap-2 sm:grid-cols-2">
                                        <div v-if="item.dischargeDestination">
                                            <p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Discharge destination</p>
                                            <p class="text-xs text-foreground">{{ item.dischargeDestination }}</p>
                                        </div>
                                        <div v-if="item.followUpPlan">
                                            <p class="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Follow-up plan</p>
                                            <p class="text-xs text-foreground">{{ item.followUpPlan }}</p>
                                        </div>
                                    </div>

                                    <AdmissionAdtTimelinePanel v-if="isExpanded(item.id)" :admission="item" />
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </ul>

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
                </template>
            </div>
        </div>

        <CreateAdmissionSheet v-model:open="createSheetOpen" @created="onAdmissionCreated" />

        <AdmissionStatusDialog
            v-model:open="statusDialogOpen"
            :target="statusDialogTarget"
            :action="statusDialogAction"
            @updated="onStatusUpdated"
        />

        <AuditLogSheet
            v-model:open="auditSheetOpen"
            title="Admission activity"
            :subtitle="auditSheetAdmissionNumber ?? ''"
            :audit="admissionAuditLog"
        />
    </AppLayout>
</template>
