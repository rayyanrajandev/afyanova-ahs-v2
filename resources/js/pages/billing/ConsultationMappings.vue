<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ConsultationMappingCreateSheet from '@/components/billing/ConsultationMappingCreateSheet.vue';
import ConsultationMappingEditSheet from '@/components/billing/ConsultationMappingEditSheet.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CLINICIAN_TIER_OPTIONS, useConsultationMappings, type ConsultationMapping } from '@/composables/consultationMappings/useConsultationMappings';
import { useDeleteConsultationMapping } from '@/composables/consultationMappings/useDeleteConsultationMapping';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatMoney } from '@/lib/billingServiceCatalog';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing-invoices' },
    { title: 'Consultation Mappings', href: '/billing-consultation-mappings' },
];

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('billing.consultation-mappings.read') === 'allowed');
const canManage = computed(() => permissionState('billing.consultation-mappings.manage') === 'allowed');

const list = useConsultationMappings();
const mappings = computed<ConsultationMapping[]>(() => list.data.value ?? []);

const queryClient = useQueryClient();
function invalidateMappingQueries(): void {
    void queryClient.invalidateQueries({ queryKey: ['consultation-mappings'] });
}

function tierLabel(tier: string | null | undefined): string {
    return CLINICIAN_TIER_OPTIONS.find((option) => option.value === tier)?.label ?? tier ?? 'Unknown tier';
}

function catalogItemLabel(item: ConsultationMapping['catalogItem']): string {
    if (!item) return 'Catalog item unavailable';
    return item.serviceName || item.serviceCode || 'Unnamed service';
}

function catalogItemMeta(mapping: ConsultationMapping): string {
    const item = mapping.catalogItem;
    if (!item) return mapping.department;
    const price = formatMoney(item.basePrice === null ? null : String(item.basePrice), null);
    return `${mapping.department} · ${catalogItemLabel(item)} · ${price}`;
}

// --- Stat tiles ---
const departmentsCovered = computed(() => new Set(mappings.value.map((mapping) => mapping.department.trim().toLowerCase())).size);
const tiersConfigured = computed(() => new Set(mappings.value.map((mapping) => mapping.clinicianTier)).size);

// --- Tier tabs ---
const activeTier = ref('all');
const tierCounts = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const option of CLINICIAN_TIER_OPTIONS) counts[option.value] = 0;
    for (const mapping of mappings.value) counts[mapping.clinicianTier] = (counts[mapping.clinicianTier] ?? 0) + 1;
    return counts;
});

function setActiveTier(value: string | number): void {
    activeTier.value = String(value);
}

// --- Search ---
const searchQuery = ref('');

const filteredMappings = computed(() => {
    const tierFiltered = activeTier.value === 'all'
        ? mappings.value
        : mappings.value.filter((mapping) => mapping.clinicianTier === activeTier.value);

    const query = searchQuery.value.trim().toLowerCase();
    if (!query) return tierFiltered;

    return tierFiltered.filter((mapping) => {
        const haystack = [
            mapping.department,
            mapping.catalogItem?.serviceName,
            mapping.catalogItem?.serviceCode,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return haystack.includes(query);
    });
});

const hasActiveFilters = computed(() => activeTier.value !== 'all' || searchQuery.value.trim() !== '');

function clearFilters(): void {
    activeTier.value = 'all';
    searchQuery.value = '';
}

// --- Create/Edit sheets ---
const createSheetOpen = ref(false);
const editSheetOpen = ref(false);
const editTarget = ref<ConsultationMapping | null>(null);

function openEditSheet(mapping: ConsultationMapping): void {
    editTarget.value = mapping;
    editSheetOpen.value = true;
}

function onMappingCreated(mapping: ConsultationMapping): void {
    invalidateMappingQueries();
    notifySuccess(`Consultation mapping created for ${mapping.department}.`);
}

function onMappingUpdated(mapping: ConsultationMapping): void {
    invalidateMappingQueries();
    notifySuccess(`Consultation mapping for ${mapping.department} updated.`);
}

// --- Delete ---
const deleteConfirmOpen = ref(false);
const deleteTarget = ref<ConsultationMapping | null>(null);
const deleteMapping = useDeleteConsultationMapping();

function requestDelete(mapping: ConsultationMapping): void {
    deleteTarget.value = mapping;
    deleteConfirmOpen.value = true;
}

async function confirmDelete(): Promise<void> {
    const id = deleteTarget.value?.id;
    if (!id) {
        deleteConfirmOpen.value = false;
        return;
    }

    try {
        await deleteMapping.mutateAsync(id);
        notifySuccess('Consultation mapping deleted.');
        deleteConfirmOpen.value = false;
        deleteTarget.value = null;
        invalidateMappingQueries();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to delete consultation mapping.'));
    }
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Consultation Mappings" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div ref="scrollContainer" class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg" :style="{ height: scrollContainerHeight }">
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Consultation Mappings</h1>
                        <p class="text-sm text-muted-foreground">
                            Map clinician tier + department to a priced service catalog item so consultation charges auto-bill correctly.
                        </p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">{{ mappings.length }} mappings</Badge>
                        <Button variant="outline" size="sm" class="h-8 gap-1.5" :disabled="list.isFetching.value" @click="() => list.refetch()">
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            Refresh
                        </Button>
                        <Button v-if="canManage" size="sm" class="h-8 gap-1.5" @click="createSheetOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            New mapping
                        </Button>
                    </div>
                </div>

                <div v-if="canRead" class="mt-3 grid grid-cols-3 gap-2">
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Mappings</p>
                        <p class="text-sm font-bold tabular-nums">{{ mappings.length }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Departments covered</p>
                        <p class="text-sm font-bold tabular-nums">{{ departmentsCovered }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Tiers configured</p>
                        <p class="text-sm font-bold tabular-nums">{{ tiersConfigured }} / {{ CLINICIAN_TIER_OPTIONS.length }}</p>
                    </div>
                </div>

                <Tabs v-if="canRead" :model-value="activeTier" class="mt-3" @update:model-value="setActiveTier">
                    <TabsList class="grid w-full grid-cols-5">
                        <TabsTrigger value="all" class="inline-flex items-center gap-1.5">
                            All
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ mappings.length }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger
                            v-for="option in CLINICIAN_TIER_OPTIONS"
                            :key="option.value"
                            :value="option.value"
                            class="inline-flex items-center gap-1.5"
                        >
                            {{ option.value }}
                            <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ tierCounts[option.value] ?? 0 }}</Badge>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div v-if="canRead" class="mt-3 flex flex-wrap items-center gap-2">
                    <div class="relative min-w-0 flex-1">
                        <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input v-model="searchQuery" placeholder="Search department or catalog item…" class="h-9 pl-9" />
                    </div>
                    <Button v-if="hasActiveFilters" variant="ghost" size="sm" class="h-9 gap-1.5 text-xs" @click="clearFilters">
                        <AppIcon name="x" class="size-3.5" />
                        Clear
                    </Button>
                </div>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canRead" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing consultation mappings requires <code>billing.consultation-mappings.read</code>.</AlertDescription>
                </Alert>

                <template v-else>
                    <Alert class="border-sidebar-border/70">
                        <AppIcon name="receipt" class="size-4" />
                        <AlertTitle>Why this matters</AlertTitle>
                        <AlertDescription>
                            Consultation charge capture matches a completed appointment's clinician tier and department against
                            these mappings first. A tier/department combination with no mapping falls back to a brittle
                            service-code guess, and may leave the visit uncaptured entirely.
                        </AlertDescription>
                    </Alert>

                    <div v-if="list.isPending.value" class="space-y-2">
                        <Skeleton class="h-14 w-full" />
                        <Skeleton class="h-14 w-full" />
                        <Skeleton class="h-14 w-full" />
                    </div>

                    <Alert v-else-if="list.isError.value" variant="destructive">
                        <AlertTitle>Unable to load consultation mappings</AlertTitle>
                        <AlertDescription>{{ messageFromUnknown(list.error.value, 'Unknown error.') }}</AlertDescription>
                    </Alert>

                    <div v-else-if="mappings.length === 0" class="rounded-lg border border-dashed bg-card px-5 py-5">
                        <p class="text-sm font-medium text-foreground">No consultation mappings configured yet</p>
                        <p class="mt-1 text-xs text-muted-foreground">
                            Consultation charges will fall back to a brittle service-code guess until at least one mapping
                            exists for each active tier/department pair.
                        </p>
                        <Button v-if="canManage" size="sm" class="mt-3 h-8 gap-1.5" @click="createSheetOpen = true">
                            <AppIcon name="plus" class="size-3.5" />
                            New mapping
                        </Button>
                    </div>

                    <div v-else-if="filteredMappings.length === 0" class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30">
                        <p>No mappings match the current tab or search.</p>
                        <Button variant="outline" size="sm" class="mt-2 h-8 gap-1.5" @click="clearFilters">
                            <AppIcon name="x" class="size-3.5" />
                            Clear filters
                        </Button>
                    </div>

                    <div v-else class="overflow-hidden rounded-lg border bg-card">
                        <ul class="divide-y">
                            <li v-for="mapping in filteredMappings" :key="mapping.id" class="px-3">
                                <RegistryListRow :selectable="false">
                                    <template #title>
                                        <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                                            <Badge>{{ tierLabel(mapping.clinicianTier) }}</Badge>
                                            <span class="truncate text-sm font-medium">{{ catalogItemLabel(mapping.catalogItem) }}</span>
                                        </div>
                                    </template>
                                    <template #meta>
                                        <p class="truncate text-xs text-muted-foreground">{{ catalogItemMeta(mapping) }}</p>
                                    </template>
                                    <template v-if="canManage" #actions>
                                        <Button size="sm" variant="ghost" class="h-7 gap-1 px-2 text-xs" @click="openEditSheet(mapping)">
                                            <AppIcon name="pencil" class="size-3.5" />Edit
                                        </Button>
                                        <Button size="sm" variant="ghost" class="h-7 gap-1 px-2 text-xs text-destructive" @click="requestDelete(mapping)">
                                            <AppIcon name="trash-2" class="size-3.5" />Delete
                                        </Button>
                                    </template>
                                </RegistryListRow>
                            </li>
                        </ul>
                    </div>
                </template>
            </div>
        </div>

        <ConsultationMappingCreateSheet v-model:open="createSheetOpen" @created="onMappingCreated" />
        <ConsultationMappingEditSheet v-model:open="editSheetOpen" :mapping="editTarget" @updated="onMappingUpdated" />

        <Dialog :open="deleteConfirmOpen" @update:open="(open) => (deleteConfirmOpen = open)">
            <DialogContent variant="action" size="lg">
                <DialogHeader>
                    <DialogTitle>Delete consultation mapping?</DialogTitle>
                    <DialogDescription>
                        Consultation charges for {{ deleteTarget?.department ?? 'this department' }}
                        ({{ tierLabel(deleteTarget?.clinicianTier) }}) will fall back to the brittle service-code guess once
                        this mapping is removed.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter class="gap-2">
                    <Button variant="outline" :disabled="deleteMapping.isPending.value" @click="deleteConfirmOpen = false">Cancel</Button>
                    <Button variant="destructive" :disabled="deleteMapping.isPending.value" @click="confirmDelete">
                        {{ deleteMapping.isPending.value ? 'Deleting...' : 'Delete mapping' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
