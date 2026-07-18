<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import AuditLogSheet from '@/components/shared/AuditLogSheet.vue';
import { useCreateWardBed } from '@/composables/platform/useCreateWardBed';
import { useUpdateWardBed } from '@/composables/platform/useUpdateWardBed';
import { useUpdateWardBedStatus } from '@/composables/platform/useUpdateWardBedStatus';
import { useWardBedAuditLog } from '@/composables/platform/useWardBedAuditLog';
import { useWardBedDepartmentOptions } from '@/composables/platform/useWardBedDepartmentOptions';
import { useWardBedFilters } from '@/composables/platform/useWardBedFilters';
import { useWardBeds, type WardBed } from '@/composables/platform/useWardBeds';
import { useWardBedStatusCounts } from '@/composables/platform/useWardBedStatusCounts';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Ward/bed registry V2 — built fresh (not an in-place edit of Index.vue)
 * so the page's outer chrome genuinely matches admissions/IndexV2.vue's
 * structure (sticky header, KPI tile grid, Tabs status filter, bounded
 * auto-scroll container) rather than carrying over the old tabbed-Sheet
 * page's own header/Card/chip-button styling, which a first in-place
 * attempt at this redesign accidentally left in place. Confirmed via
 * exploration that the tabbed-Sheet pattern (still used by Index.vue) is
 * the deliberate, consistent convention across all 12 platform/admin
 * registry siblings — this page is a first-mover onto the V2 pattern
 * within that family, not a blanket rewrite of its siblings.
 *
 * Row list keeps RegistryListRow.vue (shared by all 11 other admin pages,
 * intentionally not modified) for visual styling, but its `@select` now
 * toggles inline row expansion instead of opening a details Sheet — no
 * CollapsibleTrigger wraps it (would fight Reka UI's asChild merging
 * against RegistryListRow's own inner clickable button); the Collapsible's
 * `open` state is driven directly instead. Audit logs moved from an Audit
 * tab to the shared on-demand AuditLogSheet.vue, single-instance/
 * re-targeted per row, same pattern as admissions/IndexV2.vue and
 * emergency/Queue.vue.
 */
const { permissionState, scope } = usePlatformAccess();
const canRead = computed(() => permissionState('platform.resources.read') === 'allowed');
const canManage = computed(() => permissionState('platform.resources.manage-ward-beds') === 'allowed');
const canAudit = computed(() => permissionState('platform.resources.view-audit-logs') === 'allowed');
const canDepartmentRead = computed(() => permissionState('departments.read') === 'allowed');
const registryReadOnly = computed(() => canRead.value && !canManage.value);

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Facility setup', href: '/platform/admin/facility-config' },
    { title: 'Ward/Bed Registry', href: '/platform/admin/ward-beds' },
];

const filters = useWardBedFilters();
const list = useWardBeds(filters);
const statusCounts = useWardBedStatusCounts(filters);
const { departments, options: departmentOptions } = useWardBedDepartmentOptions();

const items = computed<WardBed[]>(() => list.data.value?.data ?? []);
const pagination = computed(() => list.data.value?.meta ?? null);
const counts = computed(() => statusCounts.data.value ?? { active: 0, inactive: 0, other: 0, total: 0 });

const queryClient = useQueryClient();
async function invalidateWardBedQueries(): Promise<void> {
    await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ward-beds'] }),
        queryClient.invalidateQueries({ queryKey: ['ward-beds-status-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['available-beds'] }),
    ]);
}

// Rows expand in place instead of opening a details Sheet — same pattern
// admissions/IndexV2.vue and emergency/Queue.vue already established.
const expandedIds = ref<Set<string>>(new Set());
function isExpanded(id: string | null): boolean {
    return id !== null && expandedIds.value.has(id);
}
function toggleExpanded(id: string | null, open?: boolean): void {
    if (!id) return;
    const next = new Set(expandedIds.value);
    const shouldOpen = open ?? !next.has(id);
    if (shouldOpen) next.add(id); else next.delete(id);
    expandedIds.value = next;
}

// One audit sheet reused across every row, re-targeted per row — same
// "single overlay, re-targeted" pattern as the status dialog below.
const auditSheetOpen = ref(false);
const auditSheetWardBedId = ref<string | null>(null);
const auditSheetLabel = ref<string | null>(null);
const wardBedAuditLog = useWardBedAuditLog(auditSheetWardBedId);

function openAuditSheet(item: WardBed): void {
    auditSheetWardBedId.value = item.id;
    auditSheetLabel.value = labelOf(item);
    auditSheetOpen.value = true;
}

const createSheetOpen = ref(false);
const createLoading = ref(false);
const createRequestError = ref<string | null>(null);
const createFormErrors = ref<Record<string, string[]>>({});
const createForm = reactive({
    code: '',
    name: '',
    departmentId: '',
    wardName: '',
    bedNumber: '',
    location: '',
    notes: '',
});
const createWardBed = useCreateWardBed();

const editSheetOpen = ref(false);
const editTarget = ref<WardBed | null>(null);
const editRequestError = ref<string | null>(null);
const editFormErrors = ref<Record<string, string[]>>({});
const editForm = reactive({
    code: '',
    name: '',
    departmentId: '',
    wardName: '',
    bedNumber: '',
    location: '',
    notes: '',
});
const updateWardBed = useUpdateWardBed();

const statusOpen = ref(false);
const statusError = ref<string | null>(null);
const statusTarget = ref<'active' | 'inactive'>('active');
const statusReason = ref('');
const statusItem = ref<WardBed | null>(null);
const updateWardBedStatus = useUpdateWardBedStatus();

const hasActiveFilters = computed(() => Boolean(filters.q.trim() || filters.departmentId));

const canPrev = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const canNext = computed(() => {
    if (!pagination.value) return false;
    return pagination.value.currentPage < pagination.value.lastPage;
});

const paginationPageNumbers = computed((): (number | '...')[] => {
    const total = pagination.value?.lastPage ?? 1;
    const current = pagination.value?.currentPage ?? 1;
    if (total <= 7) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let page = Math.max(2, current - 1); page <= Math.min(total - 1, current + 1); page += 1) {
        pages.push(page);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
});

const createValidationMessages = computed(() => Object.values(createFormErrors.value).flat());
const editValidationMessages = computed(() => Object.values(editFormErrors.value).flat());

function fieldError(errorsMap: Record<string, string[]>, field: string): string | null {
    return errorsMap[field]?.[0] ?? null;
}

function applyValidationErrors(error: unknown, target: { value: Record<string, string[]> }) {
    const apiError = error as { payload?: { errors?: Record<string, string[]> } };
    target.value = apiError.payload?.errors ?? {};
}

function labelOf(item: WardBed | null): string {
    if (!item) return 'Unknown ward/bed';
    if (item.code && item.name) return `${item.code} - ${item.name}`;
    return item.name || item.code || item.id || 'Unknown ward/bed';
}

function departmentLabelById(departmentId: string | null): string {
    const id = String(departmentId ?? '').trim();
    if (!id) return 'No department';
    const match = departments.value.find((department) => String(department.id ?? '') === id);
    if (!match) return id;
    if (match.code && match.name) return `${match.code} - ${match.name}`;
    return match.name || match.code || id;
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive') return 'destructive';
    return 'outline';
}

function occupancyTooltip(item: WardBed): string {
    return item.occupiedByAdmissionNumber
        ? `Occupied by admission ${item.occupiedByAdmissionNumber} — discharge or transfer the patient before deactivating.`
        : 'Occupied by an active admission — discharge or transfer the patient before deactivating.';
}

function blockedFromDeactivation(item: WardBed): boolean {
    return (item.status ?? '').toLowerCase() === 'active' && item.isOccupied;
}

function resetCreateForm() {
    createForm.code = '';
    createForm.name = '';
    createForm.departmentId = '';
    createForm.wardName = '';
    createForm.bedNumber = '';
    createForm.location = '';
    createForm.notes = '';
    createRequestError.value = null;
    createFormErrors.value = {};
}

function openCreateSheet() {
    resetCreateForm();
    createSheetOpen.value = true;
}

function closeCreateSheet(open: boolean) {
    createSheetOpen.value = open;
    if (!open) resetCreateForm();
}

function closeEditSheet(open: boolean) {
    editSheetOpen.value = open;
    if (!open) {
        editTarget.value = null;
        editRequestError.value = null;
        editFormErrors.value = {};
    }
}

async function createItem() {
    if (!canManage.value || createLoading.value) return;
    createLoading.value = true;
    createRequestError.value = null;
    createFormErrors.value = {};
    try {
        const created = await createWardBed.mutateAsync({
            code: createForm.code.trim(),
            name: createForm.name.trim(),
            departmentId: createForm.departmentId || null,
            wardName: createForm.wardName.trim(),
            bedNumber: createForm.bedNumber.trim(),
            location: createForm.location.trim() || null,
            notes: createForm.notes.trim() || null,
        });
        notifySuccess(`Created ${labelOf(created)}.`);
        closeCreateSheet(false);
        filters.page = 1;
        await invalidateWardBedQueries();
    } catch (error) {
        applyValidationErrors(error, createFormErrors);
        createRequestError.value = messageFromUnknown(error, 'Unable to create ward/bed resource.');
    } finally {
        createLoading.value = false;
    }
}

function openEdit(item: WardBed) {
    editTarget.value = item;
    editForm.code = item.code || '';
    editForm.name = item.name || '';
    editForm.departmentId = item.departmentId || '';
    editForm.wardName = item.wardName || '';
    editForm.bedNumber = item.bedNumber || '';
    editForm.location = item.location || '';
    editForm.notes = item.notes || '';
    editRequestError.value = null;
    editFormErrors.value = {};
    editSheetOpen.value = true;
}

async function saveEdit() {
    const id = editTarget.value?.id?.trim();
    if (!id || !canManage.value || updateWardBed.isPending.value) return;
    editRequestError.value = null;
    editFormErrors.value = {};
    try {
        await updateWardBed.mutateAsync({
            id,
            code: editForm.code.trim(),
            name: editForm.name.trim(),
            departmentId: editForm.departmentId || null,
            wardName: editForm.wardName.trim(),
            bedNumber: editForm.bedNumber.trim(),
            location: editForm.location.trim() || null,
            notes: editForm.notes.trim() || null,
        });
        notifySuccess('Ward/bed resource updated.');
        closeEditSheet(false);
        await invalidateWardBedQueries();
    } catch (error) {
        applyValidationErrors(error, editFormErrors);
        editRequestError.value = messageFromUnknown(error, 'Unable to update ward/bed resource.');
    }
}

function openStatus(item: WardBed, target: 'active' | 'inactive') {
    if (target === 'inactive' && item.isOccupied) return;
    statusItem.value = item;
    statusTarget.value = target;
    statusReason.value = target === 'inactive' ? item.statusReason ?? '' : '';
    statusError.value = null;
    statusOpen.value = true;
}

async function saveStatus() {
    const id = statusItem.value?.id?.trim();
    if (!id || !canManage.value || updateWardBedStatus.isPending.value) return;
    if (statusTarget.value === 'inactive' && !statusReason.value.trim()) {
        statusError.value = 'Reason is required for inactivation.';
        return;
    }
    statusError.value = null;
    try {
        await updateWardBedStatus.mutateAsync({
            id,
            status: statusTarget.value,
            reason: statusTarget.value === 'inactive' ? statusReason.value.trim() : null,
        });
        notifySuccess('Ward/bed status updated.');
        statusOpen.value = false;
        await invalidateWardBedQueries();
    } catch (error) {
        statusError.value = messageFromUnknown(error, 'Unable to update ward/bed status.');
    }
}

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}

function reset() {
    filters.q = '';
    filters.departmentId = '';
    filters.page = 1;
}

function prevPage() {
    if (!canPrev.value) return;
    filters.page -= 1;
}

function nextPage() {
    if (!canNext.value) return;
    filters.page += 1;
}

function goToPage(page: number) {
    filters.page = page;
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Ward/Bed Registry" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <div class="flex flex-wrap items-center gap-2">
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Ward/Bed Registry</h1>
                            <Badge v-if="registryReadOnly" variant="outline" class="h-5 px-1.5 text-[10px] font-medium">
                                View only
                            </Badge>
                        </div>
                        <p class="text-xs text-muted-foreground">Ward names, bed numbers, and department linkage for inpatient placement.</p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">{{ counts.total }} ward/bed resources</Badge>
                        <Button variant="outline" size="sm" class="h-8 gap-1.5" :disabled="list.isFetching.value" @click="invalidateWardBedQueries">
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            Refresh
                        </Button>
                        <Button v-if="canManage" size="sm" class="h-8 gap-1.5" @click="openCreateSheet">
                            <AppIcon name="plus" class="size-3.5" />
                            Create ward/bed
                        </Button>
                    </div>
                </div>

                <div v-if="canRead" class="mt-3 grid grid-cols-3 gap-2">
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Active</p>
                        <p class="text-sm font-bold tabular-nums">{{ counts.active }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Inactive</p>
                        <p class="text-sm font-bold tabular-nums">{{ counts.inactive }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total</p>
                        <p class="text-sm font-bold tabular-nums">{{ counts.total }}</p>
                    </div>
                </div>

                <Tabs v-if="canRead" :model-value="filters.status || 'all'" class="mt-3" @update:model-value="setStatus">
                    <TabsList class="grid w-full grid-cols-3">
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ counts.total }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="active" class="inline-flex items-center gap-1.5">
                            Active
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ counts.active }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="inactive" class="inline-flex items-center gap-1.5">
                            Inactive
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ counts.inactive }}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div v-if="canRead" class="mt-3 flex flex-wrap items-start gap-2">
                    <SearchInput
                        v-model="filters.q"
                        placeholder="Search code, name, ward, or location"
                        class="min-w-72 flex-1"
                    />
                    <SearchableSelectField
                        input-id="wb-department-filter"
                        label=""
                        v-model="filters.departmentId"
                        :options="departmentOptions"
                        :disabled="!canDepartmentRead"
                        placeholder="All departments"
                        search-placeholder="Search departments"
                        empty-text="No department matched."
                        trigger-class="w-56"
                    />
                    <Button v-if="hasActiveFilters" variant="ghost" size="sm" class="h-9 gap-1.5 text-xs" @click="reset">
                        <AppIcon name="x" class="size-3.5" />
                        Clear
                    </Button>
                </div>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canRead" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing the ward/bed registry requires <code>platform.resources.read</code>.</AlertDescription>
                </Alert>

                <template v-else>
                    <div v-if="list.isPending.value" class="space-y-2">
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-16 w-full" />
                        <Skeleton class="h-16 w-full" />
                    </div>

                    <Alert v-else-if="list.isError.value" variant="destructive">
                        <AlertTitle>Unable to load ward/bed resources</AlertTitle>
                        <AlertDescription>{{ messageFromUnknown(list.error.value, 'Unknown error.') }}</AlertDescription>
                    </Alert>

                    <div
                        v-else-if="items.length === 0"
                        class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
                    >
                        <p>No ward/bed resources found.</p>
                        <div class="mt-2 flex flex-wrap justify-center gap-2">
                            <Button v-if="hasActiveFilters" variant="outline" size="sm" class="h-8 gap-1.5" @click="reset">
                                <AppIcon name="x" class="size-3.5" />
                                Clear filters
                            </Button>
                            <Button v-if="canManage" size="sm" class="h-8 gap-1.5" @click="openCreateSheet">
                                <AppIcon name="plus" class="size-3.5" />
                                Create ward/bed
                            </Button>
                        </div>
                    </div>

                    <ul v-else class="space-y-2">
                        <Collapsible
                            v-for="item in items"
                            :key="String(item.id || item.code || item.name || '')"
                            :open="isExpanded(item.id)"
                            as="li"
                            class="overflow-hidden rounded-lg border bg-card shadow-sm"
                            @update:open="(open) => toggleExpanded(item.id, open)"
                        >
                            <RegistryListRow
                                :status-dot-class="item.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'"
                                :status-title="(item.status ?? 'unknown').toString()"
                                class="px-3"
                                :aria-expanded="isExpanded(item.id)"
                                :aria-controls="`ward-bed-content-${item.id}`"
                                @select="toggleExpanded(item.id)"
                            >
                                <template #leading>
                                    <AppIcon
                                        name="chevron-right"
                                        :class="`size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded(item.id) ? 'rotate-90' : ''}`"
                                    />
                                </template>
                                <template #title>
                                    <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span class="truncate text-sm font-medium transition-colors hover:text-primary">
                                            {{ item.name || labelOf(item) }}
                                        </span>
                                        <span class="shrink-0 text-xs text-muted-foreground">
                                            {{ item.code || 'No code' }}
                                        </span>
                                    </div>
                                </template>
                                <template #meta>
                                    <p class="truncate text-xs text-muted-foreground">
                                        Ward {{ item.wardName || 'N/A' }}
                                        <span class="text-border"> · </span>
                                        Bed {{ item.bedNumber || 'N/A' }}
                                        <span class="text-border"> · </span>
                                        {{ departmentLabelById(item.departmentId) }}
                                    </p>
                                </template>
                                <template #badges>
                                    <Badge :variant="statusVariant(item.status)" class="capitalize">
                                        {{ formatEnumLabel(item.status) }}
                                    </Badge>
                                    <Badge
                                        v-if="item.isOccupied"
                                        variant="outline"
                                        class="gap-1 border-primary/30 bg-primary/5 text-primary"
                                        :title="occupancyTooltip(item)"
                                    >
                                        <AppIcon name="user" class="size-3" />
                                        {{ item.occupiedByAdmissionNumber || 'Occupied' }}
                                    </Badge>
                                </template>
                                <template #actions>
                                    <Button
                                        v-if="canAudit"
                                        size="icon"
                                        variant="ghost"
                                        class="size-8"
                                        title="Activity"
                                        aria-label="View activity log"
                                        @click="openAuditSheet(item)"
                                    >
                                        <AppIcon name="clock" class="size-3.5" />
                                    </Button>
                                    <!-- Kept visible at every breakpoint (not hidden below sm) so
                                         acting on a bed never costs an extra expand-then-scroll tap
                                         on a tablet/phone; the mobile-only duplicate that used to live
                                         inside CollapsibleContent is gone, not needed anymore. -->
                                    <DropdownMenu v-if="canManage">
                                        <DropdownMenuTrigger as-child>
                                            <Button size="sm" variant="secondary" class="h-8 rounded-lg text-xs">More</Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" class="w-40">
                                            <DropdownMenuItem class="cursor-pointer text-sm" @select="openEdit(item)">
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                class="cursor-pointer text-sm"
                                                :disabled="blockedFromDeactivation(item)"
                                                :title="blockedFromDeactivation(item) ? occupancyTooltip(item) : undefined"
                                                @select="openStatus(item, (item.status ?? '').toLowerCase() === 'active' ? 'inactive' : 'active')"
                                            >
                                                {{ (item.status ?? '').toLowerCase() === 'active' ? 'Deactivate' : 'Activate' }}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </template>
                            </RegistryListRow>
                            <CollapsibleContent :id="`ward-bed-content-${item.id}`">
                                <div class="space-y-3 border-t bg-muted/10 px-4 py-3">
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <Card class="!gap-0 overflow-hidden rounded-md border-border/50 !py-0 shadow-none">
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                    Identity
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Code</span>
                                                    <span class="font-medium">{{ item.code || '—' }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Name</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">{{ item.name || '—' }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Ward</span>
                                                    <span class="font-medium">{{ item.wardName || '—' }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Bed</span>
                                                    <span class="font-medium">{{ item.bedNumber || '—' }}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card class="!gap-0 overflow-hidden rounded-md border-border/50 !py-0 shadow-none">
                                            <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                                <CardTitle class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                    Placement
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent class="divide-y divide-border/50 px-3 py-1.5 text-sm">
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Department</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">{{ departmentLabelById(item.departmentId) }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Location</span>
                                                    <span class="max-w-[14rem] truncate text-right font-medium">{{ item.location || '—' }}</span>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Status</span>
                                                    <Badge :variant="statusVariant(item.status)" class="capitalize">
                                                        {{ formatEnumLabel(item.status) }}
                                                    </Badge>
                                                </div>
                                                <div class="flex justify-between gap-4 py-2">
                                                    <span class="text-muted-foreground">Occupancy</span>
                                                    <Badge
                                                        v-if="item.isOccupied"
                                                        variant="outline"
                                                        class="gap-1 border-primary/30 bg-primary/5 text-primary"
                                                    >
                                                        <AppIcon name="user" class="size-3" />
                                                        {{ item.occupiedByAdmissionNumber || 'Occupied' }}
                                                    </Badge>
                                                    <span v-else class="font-medium text-muted-foreground">Vacant</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                    <div
                                        v-if="item.status && item.status.toLowerCase() !== 'active' && item.statusReason"
                                        class="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs"
                                    >
                                        <AppIcon name="alert-triangle" class="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                                        <span class="text-amber-700 dark:text-amber-300">
                                            <span class="font-semibold capitalize">{{ item.status }}</span>: {{ item.statusReason }}
                                        </span>
                                    </div>
                                    <Card v-if="item.notes" class="!gap-0 overflow-hidden rounded-md border-border/50 !py-0 shadow-none">
                                        <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
                                            <CardTitle class="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Notes</CardTitle>
                                        </CardHeader>
                                        <CardContent class="px-3 py-3 text-sm whitespace-pre-wrap">{{ item.notes }}</CardContent>
                                    </Card>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </ul>

                    <div v-if="pagination && pagination.lastPage > 1" class="flex items-center justify-between text-sm text-muted-foreground">
                        <p>Page {{ pagination.currentPage }} of {{ pagination.lastPage }} ({{ pagination.total }} total)</p>
                        <div class="flex items-center gap-1">
                            <Button variant="outline" size="icon" class="size-8" aria-label="Previous page" :disabled="!canPrev || list.isFetching.value" @click="prevPage">
                                <AppIcon name="chevron-left" class="size-4" />
                            </Button>
                            <template v-for="page in paginationPageNumbers" :key="String(page)">
                                <span v-if="page === '...'" class="px-1 text-xs text-muted-foreground">…</span>
                                <Button
                                    v-else
                                    :variant="page === pagination?.currentPage ? 'default' : 'ghost'"
                                    size="icon"
                                    class="size-8 text-xs"
                                    :disabled="list.isFetching.value"
                                    @click="goToPage(page as number)"
                                >
                                    {{ page }}
                                </Button>
                            </template>
                            <Button variant="outline" size="icon" class="size-8" aria-label="Next page" :disabled="!canNext || list.isFetching.value" @click="nextPage">
                                <AppIcon name="chevron-right" class="size-4" />
                            </Button>
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <Sheet v-if="canManage" :open="createSheetOpen" @update:open="closeCreateSheet">
            <SheetContent side="right" variant="form" size="3xl" class="flex h-full min-h-0 flex-col">
                <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left">
                    <SheetTitle class="flex items-center gap-2">
                        <AppIcon name="bed-double" class="size-5 text-muted-foreground" />
                        Create ward/bed
                    </SheetTitle>
                    <SheetDescription>
                        Register a ward name and bed number for admissions, transfers, and inpatient workflows.
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea class="min-h-0 flex-1">
                    <div class="grid gap-4 px-6 py-4">
                        <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                            <legend class="px-2 text-sm font-medium text-muted-foreground">Identity</legend>
                            <div class="grid gap-2">
                                <Label for="create-wb-code">Code</Label>
                                <Input
                                    id="create-wb-code"
                                    v-model="createForm.code"
                                    :disabled="createLoading"
                                    placeholder="WARD-A-01"
                                    :class="{ 'border-destructive': fieldError(createFormErrors, 'code') }"
                                />
                                <p v-if="fieldError(createFormErrors, 'code')" class="text-xs text-destructive">
                                    {{ fieldError(createFormErrors, 'code') }}
                                </p>
                            </div>
                            <div class="grid gap-2">
                                <Label for="create-wb-name">Display name</Label>
                                <Input
                                    id="create-wb-name"
                                    v-model="createForm.name"
                                    :disabled="createLoading"
                                    placeholder="Ward A Bed 1"
                                    :class="{ 'border-destructive': fieldError(createFormErrors, 'name') }"
                                />
                                <p v-if="fieldError(createFormErrors, 'name')" class="text-xs text-destructive">
                                    {{ fieldError(createFormErrors, 'name') }}
                                </p>
                            </div>
                            <div class="grid gap-2">
                                <Label for="create-wb-ward">Ward name</Label>
                                <Input
                                    id="create-wb-ward"
                                    v-model="createForm.wardName"
                                    :disabled="createLoading"
                                    placeholder="Ward A"
                                    :class="{ 'border-destructive': fieldError(createFormErrors, 'wardName') }"
                                />
                            </div>
                            <div class="grid gap-2">
                                <Label for="create-wb-bed">Bed number</Label>
                                <Input
                                    id="create-wb-bed"
                                    v-model="createForm.bedNumber"
                                    :disabled="createLoading"
                                    placeholder="01"
                                    :class="{ 'border-destructive': fieldError(createFormErrors, 'bedNumber') }"
                                />
                            </div>
                        </fieldset>
                        <fieldset class="grid gap-3 rounded-lg border p-3">
                            <legend class="px-2 text-sm font-medium text-muted-foreground">Placement</legend>
                            <SearchableSelectField
                                input-id="create-wb-department"
                                label="Department"
                                v-model="createForm.departmentId"
                                :options="departmentOptions"
                                :disabled="createLoading || !canDepartmentRead"
                                placeholder="Optional department link"
                                empty-text="No department matched."
                            />
                            <div class="grid gap-2">
                                <Label for="create-wb-location">Location</Label>
                                <Input
                                    id="create-wb-location"
                                    v-model="createForm.location"
                                    :disabled="createLoading"
                                    placeholder="Building, floor, wing"
                                />
                            </div>
                            <div class="grid gap-2">
                                <Label for="create-wb-notes">Notes</Label>
                                <Textarea
                                    id="create-wb-notes"
                                    v-model="createForm.notes"
                                    class="min-h-20"
                                    :disabled="createLoading"
                                    placeholder="Isolation, gender, or equipment notes"
                                />
                            </div>
                        </fieldset>
                    </div>
                </ScrollArea>
                <Alert
                    v-if="createRequestError || createValidationMessages.length"
                    variant="destructive"
                    class="mx-4 mb-3 shrink-0"
                >
                    <AlertTitle>Create ward/bed needs attention</AlertTitle>
                    <AlertDescription class="space-y-2">
                        <p v-if="createRequestError">{{ createRequestError }}</p>
                        <ul v-if="createValidationMessages.length" class="list-disc space-y-1 pl-4">
                            <li v-for="message in createValidationMessages" :key="message" class="text-xs leading-5">
                                {{ message }}
                            </li>
                        </ul>
                    </AlertDescription>
                </Alert>
                <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                    <Button type="button" variant="outline" :disabled="createLoading" @click="closeCreateSheet(false)">Cancel</Button>
                    <Button type="button" :disabled="createLoading" class="gap-1.5" @click="createItem">
                        <AppIcon name="plus" class="size-3.5" />
                        {{ createLoading ? 'Creating...' : 'Create ward/bed' }}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>

        <Sheet :open="editSheetOpen" @update:open="closeEditSheet">
            <SheetContent side="right" variant="form" size="3xl" class="flex h-full min-h-0 flex-col">
                <SheetHeader class="shrink-0 border-b px-4 py-3 pr-12 text-left">
                    <SheetTitle class="flex items-center gap-2">
                        <AppIcon name="pencil" class="size-5 text-muted-foreground" />
                        Edit ward/bed
                    </SheetTitle>
                    <SheetDescription v-if="editTarget">{{ labelOf(editTarget) }}</SheetDescription>
                </SheetHeader>
                <ScrollArea class="min-h-0 flex-1">
                    <div class="grid gap-4 px-6 py-4">
                        <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                            <legend class="px-2 text-sm font-medium text-muted-foreground">Identity</legend>
                            <div class="grid gap-2">
                                <Label for="edit-wb-code">Code</Label>
                                <Input
                                    id="edit-wb-code"
                                    v-model="editForm.code"
                                    :disabled="updateWardBed.isPending.value"
                                    :class="{ 'border-destructive': fieldError(editFormErrors, 'code') }"
                                />
                            </div>
                            <div class="grid gap-2">
                                <Label for="edit-wb-name">Display name</Label>
                                <Input
                                    id="edit-wb-name"
                                    v-model="editForm.name"
                                    :disabled="updateWardBed.isPending.value"
                                    :class="{ 'border-destructive': fieldError(editFormErrors, 'name') }"
                                />
                            </div>
                            <div class="grid gap-2">
                                <Label for="edit-wb-ward">Ward name</Label>
                                <Input id="edit-wb-ward" v-model="editForm.wardName" :disabled="updateWardBed.isPending.value" />
                            </div>
                            <div class="grid gap-2">
                                <Label for="edit-wb-bed">Bed number</Label>
                                <Input id="edit-wb-bed" v-model="editForm.bedNumber" :disabled="updateWardBed.isPending.value" />
                            </div>
                        </fieldset>
                        <fieldset class="grid gap-3 rounded-lg border p-3">
                            <legend class="px-2 text-sm font-medium text-muted-foreground">Placement</legend>
                            <SearchableSelectField
                                input-id="edit-wb-department"
                                label="Department"
                                v-model="editForm.departmentId"
                                :options="departmentOptions"
                                :disabled="updateWardBed.isPending.value || !canDepartmentRead"
                            />
                            <div class="grid gap-2">
                                <Label for="edit-wb-location">Location</Label>
                                <Input id="edit-wb-location" v-model="editForm.location" :disabled="updateWardBed.isPending.value" />
                            </div>
                            <div class="grid gap-2">
                                <Label for="edit-wb-notes">Notes</Label>
                                <Textarea id="edit-wb-notes" v-model="editForm.notes" class="min-h-20" :disabled="updateWardBed.isPending.value" />
                            </div>
                        </fieldset>
                    </div>
                </ScrollArea>
                <Alert
                    v-if="editRequestError || editValidationMessages.length"
                    variant="destructive"
                    class="mx-4 mb-3 shrink-0"
                >
                    <AlertTitle>Update ward/bed needs attention</AlertTitle>
                    <AlertDescription>
                        <p v-if="editRequestError">{{ editRequestError }}</p>
                        <ul v-if="editValidationMessages.length" class="list-disc space-y-1 pl-4">
                            <li v-for="message in editValidationMessages" :key="message" class="text-xs">{{ message }}</li>
                        </ul>
                    </AlertDescription>
                </Alert>
                <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
                    <Button type="button" variant="outline" :disabled="updateWardBed.isPending.value" @click="closeEditSheet(false)">Cancel</Button>
                    <Button type="button" :disabled="updateWardBed.isPending.value" class="gap-1.5" @click="saveEdit">
                        <AppIcon name="pencil" class="size-3.5" />
                        {{ updateWardBed.isPending.value ? 'Saving...' : 'Save changes' }}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>

        <Dialog :open="statusOpen" @update:open="(open) => (statusOpen = open)">
            <DialogContent variant="action" size="lg">
                <DialogHeader>
                    <DialogTitle>{{ statusTarget === 'inactive' ? 'Deactivate ward/bed' : 'Activate ward/bed' }}</DialogTitle>
                    <DialogDescription>
                        {{
                            statusTarget === 'inactive'
                                ? 'Reason is required before deactivating.'
                                : 'Confirm activation of this ward/bed resource.'
                        }}
                    </DialogDescription>
                </DialogHeader>
                <div class="space-y-3">
                    <Alert v-if="statusError" variant="destructive">
                        <AlertTitle>Status update failed</AlertTitle>
                        <AlertDescription>{{ statusError }}</AlertDescription>
                    </Alert>
                    <div v-if="statusTarget === 'inactive'" class="grid gap-2">
                        <Label for="wb-status-reason">Reason</Label>
                        <Textarea
                            id="wb-status-reason"
                            v-model="statusReason"
                            class="min-h-20"
                            placeholder="Required reason for deactivation"
                        />
                    </div>
                </div>
                <DialogFooter class="gap-2">
                    <Button variant="outline" :disabled="updateWardBedStatus.isPending.value" @click="statusOpen = false">Cancel</Button>
                    <Button :disabled="updateWardBedStatus.isPending.value" @click="saveStatus">
                        {{ updateWardBedStatus.isPending.value ? 'Saving...' : 'Confirm' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AuditLogSheet
            v-model:open="auditSheetOpen"
            title="Ward/bed activity"
            :subtitle="auditSheetLabel ?? ''"
            :audit="wardBedAuditLog"
        />
    </AppLayout>
</template>
