<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { AlertCircle, CheckCircle2 } from 'lucide-vue-next';
import AppIcon from '@/components/AppIcon.vue';
import RegistryListRow from '@/components/list/RegistryListRow.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';
import { apiRequestJson } from '@/lib/apiClient';

const ws = useInventoryWorkspace();

type CatalogItem = {
    id: string;
    code: string;
    name: string;
    category: string | null;
    unit: string | null;
    description: string | null;
};

const searchQuery = ref('');
const selectedIds = ref<Set<string>>(new Set());
const selectAll = ref(false);
const syncing = ref(false);
const catalogLoading = ref(false);
const catalogLoadError = ref<string | null>(null);
const syncResult = ref<{ created: number; updated: number; errors: Array<{ catalogItemId: string; code: string; name: string; error: string }> } | null>(null);

const catalogItems = ref<CatalogItem[]>([]);

onMounted(async () => {
    catalogLoading.value = true;
    catalogLoadError.value = null;
    try {
        const response = await apiRequestJson<any>('GET', '/inventory-procurement/reference-data');
        const raw = Array.isArray(response?.clinicalCatalogItems) ? response.clinicalCatalogItems : [];
        catalogItems.value = raw
            .filter((item: any) => item && (item.catalogType === 'formulary_item' || item.catalog_type === 'formulary_item'))
            .map((item: any) => ({
                id: String(item.id ?? ''),
                code: item.code ?? '',
                name: item.name ?? '',
                category: item.category ?? null,
                unit: item.unit ?? null,
                description: item.description ?? null,
            }));
    } catch (err: any) {
        catalogLoadError.value = err?.message ?? 'Unable to load clinical catalog items.';
        catalogItems.value = [];
    } finally {
        catalogLoading.value = false;
    }
});

const filteredItems = computed(() => {
    const q = searchQuery.value.toLowerCase().trim();
    if (!q) return catalogItems.value;
    return catalogItems.value.filter(
        (item) =>
            item.name.toLowerCase().includes(q) ||
            item.code.toLowerCase().includes(q) ||
            (item.category && item.category.toLowerCase().includes(q)),
    );
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
    // Force reactivity
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

        // Refresh inventory items when done
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
        // Select all by default
        for (const item of catalogItems.value) {
            selectedIds.value.add(item.id);
        }
        selectedIds.value = new Set(selectedIds.value);
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
                Select approved medicines from the formulary to create inventory items. Code, name, strength, dosage form, and dispensing unit are pre-filled from the catalog.
            </SheetDescription>
        </SheetHeader>

        <!-- Results -->
        <div v-if="syncResult" class="border-b px-4 py-3">
            <Alert v-if="syncResult.errors.length === 0" variant="default" class="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
                <CheckCircle2 class="size-4 text-green-700 dark:text-green-300" />
                <AlertTitle class="text-green-700 dark:text-green-300">Sync complete</AlertTitle>
                <AlertDescription class="text-green-600 dark:text-green-400">
                    {{ syncResult.created }} created<template v-if="syncResult.updated > 0">, {{ syncResult.updated }} updated</template>.
                </AlertDescription>
            </Alert>
            <Alert v-else variant="destructive">
                <AlertCircle class="size-4" />
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

            <!-- List -->
            <ScrollArea class="min-h-0 flex-1">
                <div v-if="catalogItems.length === 0" class="flex flex-col items-center gap-2 px-4 py-12 text-center">
                    <AppIcon name="book-open" class="size-10 text-muted-foreground/40" />
                    <p class="text-sm font-medium text-muted-foreground">No active formulary items found</p>
                    <p class="text-xs text-muted-foreground/60">Add approved medicines in Clinical Care Catalogs first.</p>
                </div>
                <div v-else-if="filteredItems.length === 0" class="flex flex-col items-center gap-2 px-4 py-12 text-center">
                    <AppIcon name="search" class="size-10 text-muted-foreground/40" />
                    <p class="text-sm font-medium text-muted-foreground">No items match the search</p>
                </div>
                <div v-else class="divide-y">
                    <!-- Select all row -->
                    <div
                        class="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/30"
                        @click="toggleAll"
                    >
                        <input
                            type="checkbox"
                            :checked="allFilteredSelected"
                            class="size-4 accent-primary"
                            @click.stop="toggleAll"
                        />
                        <span class="text-xs font-medium text-muted-foreground">
                            {{ allFilteredSelected ? 'Deselect all' : 'Select all' }} ({{ filteredItems.length }})
                        </span>
                    </div>
                    <div
                        v-for="item in filteredItems"
                        :key="item.id"
                        class="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/30"
                        @click="toggleItem(item.id)"
                    >
                        <input
                            type="checkbox"
                            :checked="selectedIds.has(item.id)"
                            class="size-4 accent-primary shrink-0"
                            @click.stop="toggleItem(item.id)"
                        />
                        <div class="min-w-0 flex-1">
                            <p class="truncate text-sm font-medium">{{ item.name }}</p>
                            <p class="truncate text-xs text-muted-foreground">
                                {{ item.code }}
                                <template v-if="item.category"> · {{ item.category }}</template>
                                <template v-if="item.unit"> · {{ item.unit }}</template>
                            </p>
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>

        <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
            <Button variant="outline" @click="closeDialog">
                {{ syncResult ? 'Done' : 'Cancel' }}
            </Button>
            <Button
                v-if="!syncResult"
                :disabled="!hasSelection || syncing"
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