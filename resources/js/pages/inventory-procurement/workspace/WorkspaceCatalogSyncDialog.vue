<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual';
import { computed, nextTick, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import type { AppIconName } from '@/lib/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SearchInput } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiRequestJson } from '@/lib/apiClient';
import { formatEnumLabel } from '@/lib/labels';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';

const ws = useInventoryWorkspace();

type CatalogItem = {
    id: string;
    code: string;
    name: string;
    catalogType: string;
    category: string | null;
    unit: string | null;
    description: string | null;
};

type SyncResult = {
    created: number;
    updated: number;
    errors: Array<{ catalogItemId: string; code: string; name: string; error: string }>;
};

type FlatRow =
    | { kind: 'header'; groupType: string; count: number }
    | { kind: 'item'; item: CatalogItem };

const searchQuery = ref('');
const selectedIds = ref<Set<string>>(new Set());
const syncing = ref(false);
const catalogLoading = ref(false);
const catalogLoadError = ref<string | null>(null);
const syncResult = ref<SyncResult | null>(null);
const catalogItems = ref<CatalogItem[]>([]);

const catalogTypeGroups = ['formulary_item', 'lab_test', 'radiology_procedure', 'theatre_procedure'] as const;

function catalogTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        formulary_item: 'Formulary (Medicines)',
        lab_test: 'Lab Tests',
        radiology_procedure: 'Radiology',
        theatre_procedure: 'Theatre Procedures',
    };
    return labels[type] ?? formatEnumLabel(type);
}

function catalogTypeIcon(type: string): AppIconName {
    const icons: Partial<Record<string, AppIconName>> = {
        formulary_item: 'pill',
        lab_test: 'flask-conical',
        radiology_procedure: 'layers',
        theatre_procedure: 'scissors',
    };
    return (icons[type] ?? 'book-open') as AppIconName;
}

async function loadCatalogItems() {
    catalogLoading.value = true;
    catalogLoadError.value = null;
    try {
        const allItems: CatalogItem[] = [];
        const types = ['formulary-items', 'lab-tests', 'radiology-procedures', 'theatre-procedures'] as const;
        const typeMap: Record<string, string> = {
            'formulary-items': 'formulary_item',
            'lab-tests': 'lab_test',
            'radiology-procedures': 'radiology_procedure',
            'theatre-procedures': 'theatre_procedure',
        };

        for (const typePath of types) {
            try {
                const typeResponse = await apiRequestJson<any>('GET', `/platform/admin/clinical-catalogs/${typePath}`, {
                    query: { perPage: 500, status: 'active' },
                });
                const items = Array.isArray(typeResponse?.data) ? typeResponse.data : [];
                for (const item of items) {
                    allItems.push({
                        id: String(item.id ?? ''),
                        code: item.code ?? '',
                        name: item.name ?? '',
                        catalogType: typeMap[typePath] ?? 'formulary_item',
                        category: item.category ?? null,
                        unit: item.unit ?? null,
                        description: item.description ?? null,
                    });
                }
            } catch {
                // Skip types that fail - user may not have access
            }
        }

        catalogItems.value = allItems;
    } catch (err: any) {
        catalogLoadError.value = err?.message ?? 'Unable to load clinical catalog items.';
        catalogItems.value = [];
    } finally {
        catalogLoading.value = false;
    }
}

const groupedItems = computed(() => {
    const groups: Record<string, CatalogItem[]> = {};
    for (const type of catalogTypeGroups) {
        groups[type] = [];
    }
    for (const item of catalogItems.value) {
        const type = item.catalogType || 'formulary_item';
        if (!groups[type]) groups[type] = [];
        groups[type].push(item);
    }
    return groups;
});

const filteredGroupedItems = computed(() => {
    const q = searchQuery.value.toLowerCase().trim();
    if (!q) return groupedItems.value;

    const groups: Record<string, CatalogItem[]> = {};
    for (const type of catalogTypeGroups) {
        groups[type] = groupedItems.value[type]?.filter(
            (item) =>
                item.name.toLowerCase().includes(q) ||
                item.code.toLowerCase().includes(q) ||
                (item.category && item.category.toLowerCase().includes(q)),
        ) ?? [];
    }
    return groups;
});

const filteredItems = computed(() => {
    const all: CatalogItem[] = [];
    for (const type of catalogTypeGroups) {
        all.push(...(filteredGroupedItems.value[type] ?? []));
    }
    return all;
});

const flatRows = computed<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    for (const type of catalogTypeGroups) {
        const items = filteredGroupedItems.value[type] ?? [];
        if (items.length === 0) continue;
        rows.push({ kind: 'header', groupType: type, count: items.length });
        for (const item of items) {
            rows.push({ kind: 'item', item });
        }
    }
    return rows;
});

const allFilteredSelected = computed(() =>
    filteredItems.value.length > 0 && filteredItems.value.every((item) => selectedIds.value.has(item.id)),
);

function toggleAll() {
    if (allFilteredSelected.value) {
        for (const item of filteredItems.value) {
            selectedIds.value.delete(item.id);
        }
    } else {
        for (const item of filteredItems.value) {
            selectedIds.value.add(item.id);
        }
    }
    selectedIds.value = new Set(selectedIds.value);
}

function toggleItem(id: string) {
    if (selectedIds.value.has(id)) {
        selectedIds.value.delete(id);
    } else {
        selectedIds.value.add(id);
    }
    selectedIds.value = new Set(selectedIds.value);
}

function toggleGroup(type: string) {
    const groupItems = filteredGroupedItems.value[type] ?? [];
    const allSelected = groupItems.every((item) => selectedIds.value.has(item.id));

    if (allSelected) {
        for (const item of groupItems) {
            selectedIds.value.delete(item.id);
        }
    } else {
        for (const item of groupItems) {
            selectedIds.value.add(item.id);
        }
    }
    selectedIds.value = new Set(selectedIds.value);
}

function isGroupAllSelected(type: string): boolean {
    const groupItems = filteredGroupedItems.value[type] ?? [];
    return groupItems.length > 0 && groupItems.every((item) => selectedIds.value.has(item.id));
}

function isGroupSomeSelected(type: string): boolean {
    const groupItems = filteredGroupedItems.value[type] ?? [];
    return groupItems.some((item) => selectedIds.value.has(item.id)) && !isGroupAllSelected(type);
}

function rowGroupType(row: FlatRow): string {
    return row.kind === 'header' ? row.groupType : '';
}

function rowGroupCount(row: FlatRow): number {
    return row.kind === 'header' ? row.count : 0;
}

function rowItemId(row: FlatRow): string {
    return row.kind === 'item' ? row.item.id : '';
}

function rowItem(row: FlatRow): CatalogItem | null {
    return row.kind === 'item' ? row.item : null;
}

const scrollContainerRef = ref<HTMLElement | null>(null);
const scrollElement = computed(() => scrollContainerRef.value);

const virtualizer = useVirtualizer(computed(() => ({
    count: flatRows.value.length,
    getScrollElement: () => scrollElement.value,
    estimateSize: () => 44,
    overscan: 10,
})));

watch(scrollContainerRef, (el) => {
    if (el) {
        nextTick(() => {
            virtualizer.value.measure();
        });
    }
});

const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());

async function executeSync() {
    const items = [...selectedIds.value];
    if (items.length === 0) return;

    syncing.value = true;
    syncResult.value = null;

    try {
        const response = await apiRequestJson<any>('POST', '/inventory-procurement/items/bulk-sync-from-catalog', {
            body: {
                catalogItemIds: items,
                defaultWarehouseId: null,
                defaultSupplierId: null,
            },
        });

        syncResult.value = response ?? { created: 0, updated: 0, errors: [] };

        if ((ws as any).refreshInventoryItems) {
            (ws as any).refreshInventoryItems();
        }
    } catch (err: any) {
        syncResult.value = { created: 0, updated: 0, errors: [{ catalogItemId: '', code: '', name: '', error: err.message }] };
    } finally {
        syncing.value = false;
    }
}

function closeDialog() {
    (ws as any).catalogSyncDialogOpen = false;
    syncResult.value = null;
    selectedIds.value = new Set();
    searchQuery.value = '';
}

watch(() => (ws as any).catalogSyncDialogOpen, (open: boolean) => {
    if (open) {
        syncResult.value = null;
        selectedIds.value = new Set();
        searchQuery.value = '';
        void loadCatalogItems().then(() => {
            for (const item of catalogItems.value) {
                selectedIds.value.add(item.id);
            }
            selectedIds.value = new Set(selectedIds.value);
        });
    }
});

const hasSelection = computed(() => selectedIds.value.size > 0);
</script>

<template>
<Sheet :open="(ws as any).catalogSyncDialogOpen ?? false" @update:open="closeDialog">
    <SheetContent side="right" variant="form" size="4xl">
        <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
            <SheetTitle class="flex items-center gap-2">
                <AppIcon name="book-open" class="size-5 text-muted-foreground" />
                Sync from Clinical Care Catalog
            </SheetTitle>
            <SheetDescription>
                Select clinical catalog definitions (medicines, lab tests, radiology, theatre) to create inventory items. Identity fields are pre-filled from the catalog.
            </SheetDescription>
        </SheetHeader>

        <!-- Results -->
        <div v-if="syncResult" class="border-b px-4 py-3">
            <Alert v-if="syncResult.errors.length === 0" variant="default" class="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
                <AppIcon name="check-circle" class="size-4 text-green-700 dark:text-green-300" />
                <AlertTitle class="text-green-700 dark:text-green-300">Sync complete</AlertTitle>
                <AlertDescription class="text-green-600 dark:text-green-400">
                    {{ syncResult.created }} created<template v-if="syncResult.updated > 0">, {{ syncResult.updated }} updated</template>.
                </AlertDescription>
            </Alert>
            <Alert v-else variant="destructive">
                <AppIcon name="alert-circle" class="size-4" />
                <AlertTitle>{{ syncResult.errors.length }} error{{ syncResult.errors.length !== 1 ? 's' : '' }}</AlertTitle>
                <AlertDescription>
                    <p>{{ syncResult.created }} created<template v-if="syncResult.updated > 0">, {{ syncResult.updated }} updated</template>, {{ syncResult.errors.length }} failed.</p>
                    <ul class="mt-2 list-inside list-disc space-y-1">
                        <li v-for="err in syncResult.errors" :key="err.catalogItemId">
                            <strong>{{ err.name }}</strong> ({{ err.code }}): {{ err.error }}
                        </li>
                    </ul>
                </AlertDescription>
            </Alert>
        </div>

        <div v-if="!syncResult" class="flex min-h-0 flex-1 flex-col">
            <!-- Search + count -->
            <div class="flex items-center gap-3 border-b px-4 py-3">
                <SearchInput
                    v-model="searchQuery"
                    placeholder="Search by name, code, or category..."
                    class="min-w-0 flex-1 text-xs"
                />
                <Badge variant="secondary" class="h-5 shrink-0 px-1.5 text-[10px]">
                    {{ selectedIds.size }} / {{ catalogItems.length }} selected
                </Badge>
            </div>

            <!-- Select all row (visible only when items exist) -->
            <div
                v-if="!catalogLoading && !catalogLoadError && filteredItems.length > 0"
                class="flex cursor-pointer items-center gap-3 border-b px-4 py-2.5 hover:bg-muted/30"
                @click="toggleAll"
            >
                <Checkbox
                    :checked="allFilteredSelected"
                    class="shrink-0"
                    @update:checked="toggleAll"
                />
                <span class="text-xs font-medium text-muted-foreground">
                    {{ allFilteredSelected ? 'Deselect all' : 'Select all' }} ({{ filteredItems.length }})
                </span>
            </div>

            <!-- Scroll container (always rendered so virtualizer has its element) -->
            <div
                ref="scrollContainerRef"
                class="min-h-0 flex-1 overflow-auto"
            >
                <!-- Loading -->
                <div v-if="catalogLoading" class="flex flex-col items-center gap-2 px-4 py-12 text-center">
                    <AppIcon name="refresh-cw" class="size-6 animate-spin text-muted-foreground/40" />
                    <p class="text-sm text-muted-foreground">Loading clinical catalog items...</p>
                </div>

                <!-- Error -->
                <Alert v-else-if="catalogLoadError" variant="destructive" class="m-4">
                    <AlertTitle>Failed to load catalog</AlertTitle>
                    <AlertDescription>{{ catalogLoadError }}</AlertDescription>
                </Alert>

                <!-- Empty states -->
                <div v-else-if="catalogItems.length === 0" class="flex flex-col items-center gap-2 px-4 py-12 text-center">
                    <AppIcon name="book-open" class="size-10 text-muted-foreground/40" />
                    <p class="text-sm font-medium text-muted-foreground">No active catalog items found</p>
                    <p class="text-xs text-muted-foreground/60">Add definitions in Clinical Care Catalogs first.</p>
                </div>
                <div v-else-if="filteredItems.length === 0" class="flex flex-col items-center gap-2 px-4 py-12 text-center">
                    <AppIcon name="search" class="size-10 text-muted-foreground/40" />
                    <p class="text-sm font-medium text-muted-foreground">No items match the search</p>
                </div>

                <!-- Virtual list -->
                <div v-else :style="{ height: `${totalSize}px`, position: 'relative' }">
                    <div
                        v-for="(virtualRow, vi) in virtualRows"
                        :key="String(virtualRow.key)"
                        :style="{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                        }"
                    >
                        <!-- Group header row -->
                        <div
                            v-if="flatRows[virtualRow.index].kind === 'header'"
                            class="flex cursor-pointer items-center gap-3 border-b bg-muted/20 px-4 py-2 hover:bg-muted/40"
                            @click="toggleGroup(rowGroupType(flatRows[virtualRow.index]))"
                        >
                            <Checkbox
                                :model-value="isGroupAllSelected(rowGroupType(flatRows[virtualRow.index])) ? true : isGroupSomeSelected(rowGroupType(flatRows[virtualRow.index])) ? 'indeterminate' : false"
                                class="shrink-0"
                                @update:model-value="toggleGroup(rowGroupType(flatRows[virtualRow.index]))"
                                @click.stop
                            />
                            <AppIcon :name="catalogTypeIcon(rowGroupType(flatRows[virtualRow.index]))" class="size-4 text-muted-foreground" />
                            <span class="text-xs font-semibold text-muted-foreground">
                                {{ catalogTypeLabel(rowGroupType(flatRows[virtualRow.index])) }}
                            </span>
                            <Badge variant="outline" class="h-4 px-1 text-[10px]">
                                {{ rowGroupCount(flatRows[virtualRow.index]) }}
                            </Badge>
                        </div>

                        <!-- Item row -->
                        <div
                            v-else
                            class="flex cursor-pointer items-center gap-3 border-b pl-10 pr-4 py-2 hover:bg-muted/30"
                            @click="toggleItem(rowItemId(flatRows[virtualRow.index]))"
                        >
                            <Checkbox
                                :model-value="selectedIds.has(rowItemId(flatRows[virtualRow.index]))"
                                class="shrink-0"
                                @update:model-value="toggleItem(rowItemId(flatRows[virtualRow.index]))"
                                @click.stop
                            />
                            <div v-if="rowItem(flatRows[virtualRow.index])" class="min-w-0 flex-1">
                                <p class="truncate text-sm font-medium">{{ rowItem(flatRows[virtualRow.index])!.name }}</p>
                                <p class="truncate text-xs text-muted-foreground">
                                    {{ rowItem(flatRows[virtualRow.index])!.code }}
                                    <template v-if="rowItem(flatRows[virtualRow.index])!.category"> · {{ rowItem(flatRows[virtualRow.index])!.category }}</template>
                                    <template v-if="rowItem(flatRows[virtualRow.index])!.unit"> · {{ rowItem(flatRows[virtualRow.index])!.unit }}</template>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
            <Button variant="outline" @click="closeDialog">
                {{ syncResult ? 'Done' : 'Cancel' }}
            </Button>
            <Button
                v-if="!syncResult"
                :disabled="!hasSelection || syncing || catalogLoading"
                class="gap-1.5"
                @click="executeSync"
            >
                <span :class="['flex', { 'animate-spin': syncing }]">
                    <AppIcon name="refresh-cw" class="size-3.5" />
                </span>
                {{ syncing ? 'Creating...' : `Create ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}` }}
            </Button>
        </SheetFooter>
    </SheetContent>
</Sheet>
</template>
