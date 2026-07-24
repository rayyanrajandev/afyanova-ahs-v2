<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ChargeableItemCreateSheet from '@/components/billing/ChargeableItemCreateSheet.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChargeableItems, type ChargeableItem } from '@/composables/chargeableItems/useChargeableItems';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

/**
 * Admin list + create page for the new pricing engine's chargeable_items.
 * Deliberately leaner than ServiceCatalogV2.vue (that page manages the old
 * ~25-field billing_service_catalog_items table with bulk actions, CSV
 * export, and audit logs; this one manages a ~10-field table with no
 * versioning workspace yet — adding a price is "storePrice", not a full
 * version-history UI, per PricingEngine Phase 4's scope).
 */
const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Billing', href: '/billing' },
    { title: 'Chargeable Items', href: '/chargeable-items' },
];

const CATALOG_TYPE_TABS = [
    { value: '', label: 'All' },
    { value: 'lab_test', label: 'Lab' },
    { value: 'radiology_procedure', label: 'Radiology' },
    { value: 'theatre_procedure', label: 'Theatre' },
    { value: 'clinical_procedure', label: 'Procedure' },
    { value: 'formulary_item', label: 'Pharmacy' },
    { value: 'consultation', label: 'Consultation' },
    { value: 'bed_day', label: 'Bed-day' },
] as const;

const { permissionState } = usePlatformAccess();
const canRead = computed(() => permissionState('billing.chargeable-items.read') === 'allowed');
const canManage = computed(() => permissionState('billing.chargeable-items.manage') === 'allowed');

const catalogTypeFilter = ref('');
const filters = computed(() => ({ catalogType: catalogTypeFilter.value || null, status: null }));
const list = useChargeableItems(filters.value);

const items = computed<ChargeableItem[]>(() => list.data.value ?? []);

const queryClient = useQueryClient();
function invalidateChargeableItemQueries(): void {
    void queryClient.invalidateQueries({ queryKey: ['chargeable-items'] });
    void queryClient.invalidateQueries({ queryKey: ['chargeable-item-options'] });
}

function activePriceLabel(item: ChargeableItem): string {
    const activePrice = item.prices.find((price) => price.status === 'active') ?? item.prices[0];
    if (!activePrice) return 'No price set';

    return `${activePrice.unitPrice.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} ${activePrice.currencyCode}`;
}

function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive') return 'destructive';
    return 'outline';
}

const createSheetOpen = ref(false);

function openCreateSheet(): void {
    createSheetOpen.value = true;
}

function onCreated(item: ChargeableItem): void {
    notifySuccess(`Created ${item.code} — ${item.name}.`);
    invalidateChargeableItemQueries();
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Chargeable Items" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Chargeable Items</h1>
                        <p class="text-xs text-muted-foreground">
                            New pricing engine: canonical chargeable items and their price book entries.
                        </p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">{{ items.length }} chargeable items</Badge>
                        <Button variant="outline" size="sm" class="h-8 gap-1.5" :disabled="list.isFetching.value" @click="invalidateChargeableItemQueries">
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            Refresh
                        </Button>
                        <Button v-if="canManage" size="sm" class="h-8 gap-1.5" @click="openCreateSheet">
                            <AppIcon name="plus" class="size-3.5" />
                            New chargeable item
                        </Button>
                    </div>
                </div>

                <Tabs v-if="canRead" :model-value="catalogTypeFilter" class="mt-3" @update:model-value="(value) => (catalogTypeFilter = String(value))">
                    <TabsList class="grid w-full grid-cols-4 sm:grid-cols-8">
                        <TabsTrigger v-for="tab in CATALOG_TYPE_TABS" :key="tab.value" :value="tab.value" class="text-xs">
                            {{ tab.label }}
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div v-if="!canRead" class="px-6 py-8 text-sm text-muted-foreground">
                You don't have permission to view chargeable items.
            </div>

            <div v-else class="flex flex-col gap-1.5 px-6 pb-6">
                <p v-if="list.isLoading.value" class="px-1 py-4 text-sm text-muted-foreground">Loading chargeable items…</p>
                <p v-else-if="items.length === 0" class="px-1 py-4 text-sm text-muted-foreground">No chargeable items found for this filter.</p>

                <RegistryListRow
                    v-for="item in items"
                    :key="item.id"
                    :status-dot-class="statusVariant(item.status) === 'secondary' ? 'bg-emerald-500' : 'bg-muted-foreground'"
                    :primary-label="`${item.code} — ${item.name}`"
                    :secondary-label="formatEnumLabel(item.catalogType)"
                    :meta="activePriceLabel(item)"
                    :selectable="false"
                >
                    <template #leading>
                        <Badge :variant="statusVariant(item.status)" class="h-5 px-1.5 text-[10px]">{{ formatEnumLabel(item.status) }}</Badge>
                    </template>
                </RegistryListRow>
            </div>
        </div>

        <ChargeableItemCreateSheet v-model:open="createSheetOpen" @created="onCreated" />
    </AppLayout>
</template>
