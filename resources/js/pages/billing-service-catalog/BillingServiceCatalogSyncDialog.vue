<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import type { AppIconName } from '@/lib/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiRequestJson } from '@/lib/apiClient';

type CatalogItem = {
    id: string;
    code: string;
    name: string;
    catalogType: string;
    category: string | null;
    unit: string | null;
};

type SyncResult = {
    created: number;
    updated: number;
    errors: Array<{ catalogItemId: string; code: string; name: string; error: string }>;
};

const props = defineProps<{
    open: boolean;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    'synced': [];
}>();

const catalogTypeOptions = [
    { value: 'lab_test', label: 'Lab Tests', icon: 'flask-conical' as AppIconName },
    { value: 'radiology_procedure', label: 'Radiology', icon: 'layers' as AppIconName },
    { value: 'theatre_procedure', label: 'Theatre Procedures', icon: 'scissors' as AppIconName },
    { value: 'formulary_item', label: 'Medicines', icon: 'pill' as AppIconName },
];

const selectedCategory = ref('');
const catalogItems = ref<CatalogItem[]>([]);
const loadingItems = ref(false);
const loadError = ref<string | null>(null);
const selectedItemIds = ref<Set<string>>(new Set());
const syncing = ref(false);
const syncResult = ref<SyncResult | null>(null);

const selectAllChecked = computed<boolean | 'indeterminate'>({
    get() {
        const total = catalogItems.value.length;
        const count = selectedItemIds.value.size;
        if (total === 0) return false;
        if (count === total) return true;
        if (count > 0) return 'indeterminate';
        return false;
    },
    set(value: boolean) {
        if (value) {
            selectedItemIds.value = new Set(catalogItems.value.map((item) => item.id));
        } else {
            selectedItemIds.value = new Set();
        }
    },
});

function isItemSelected(id: string): boolean {
    return selectedItemIds.value.has(id);
}

function toggleItem(id: string) {
    const next = new Set(selectedItemIds.value);
    if (next.has(id)) {
        next.delete(id);
    } else {
        next.add(id);
    }
    selectedItemIds.value = next;
}

async function loadItems() {
    if (!selectedCategory.value) return;

    loadingItems.value = true;
    loadError.value = null;
    catalogItems.value = [];
    selectedItemIds.value = new Set();

    try {
        const response = await apiRequestJson<any>('GET', '/platform/admin/clinical-catalogs/sync-candidates', {
            query: { 'catalogTypes[]': [selectedCategory.value] },
        });
        const items = Array.isArray(response?.data) ? response.data : [];
        catalogItems.value = items.map((item: any) => ({
            id: String(item.id ?? ''),
            code: item.code ?? '',
            name: item.name ?? '',
            catalogType: item.catalogType ?? 'formulary_item',
            category: item.category ?? null,
            unit: item.unit ?? null,
        }));
    } catch (err: any) {
        loadError.value = err?.message ?? 'Failed to load catalog items.';
    } finally {
        loadingItems.value = false;
    }
}

async function executeSync() {
    const ids = [...selectedItemIds.value];
    if (ids.length === 0) return;

    syncing.value = true;
    syncResult.value = null;

    try {
        const response = await apiRequestJson<SyncResult>('POST', '/billing-service-catalog/items/bulk-sync-from-catalog', {
            body: {
                catalogItemIds: ids,
                defaultCurrencyCode: null,
            },
        });

        syncResult.value = response ?? { created: 0, updated: 0, errors: [] };
        emit('synced');
    } catch (err: any) {
        if (err?.status === 422 && err?.payload && Array.isArray(err.payload?.errors)) {
            syncResult.value = err.payload as SyncResult;
        } else {
            syncResult.value = { created: 0, updated: 0, errors: [{ catalogItemId: '', code: '', name: '', error: err.message }] };
        }
    } finally {
        syncing.value = false;
    }
}

function closeDialog() {
    emit('update:open', false);
    selectedCategory.value = '';
    catalogItems.value = [];
    selectedItemIds.value = new Set();
    syncResult.value = null;
    loadError.value = null;
}

watch(selectedCategory, () => {
    catalogItems.value = [];
    selectedItemIds.value = new Set();
    syncResult.value = null;
    loadError.value = null;
});
</script>

<template>
<Sheet :open="open" @update:open="closeDialog">
    <SheetContent side="right" variant="form" size="3xl">
        <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
            <SheetTitle class="flex items-center gap-2">
                <AppIcon name="book-open" class="size-5 text-muted-foreground" />
                Sync from Clinical Catalog
            </SheetTitle>
            <SheetDescription>
                Pull definitions from Clinical Catalog to create or update billing service prices.
            </SheetDescription>
        </SheetHeader>

        <!-- Sync result -->
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

        <!-- Category + item list -->
        <div v-if="!syncResult" class="flex min-h-0 flex-1 flex-col">
            <!-- Category dropdown -->
            <div class="border-b px-4 py-3">
                <label class="mb-1.5 block text-xs font-medium text-muted-foreground">Step 1 — Choose a category</label>
                <Select v-model="selectedCategory" @update:model-value="loadItems">
                    <SelectTrigger class="w-full">
                        <SelectValue placeholder="Select a catalog category to load items..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem
                            v-for="ct in catalogTypeOptions"
                            :key="ct.value"
                            :value="ct.value"
                        >
                            <span class="flex items-center gap-2">
                                <AppIcon :name="ct.icon" class="size-4 text-muted-foreground" />
                                {{ ct.label }}
                            </span>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <!-- No category selected — guidance -->
            <div v-if="!selectedCategory" class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                <div class="rounded-full bg-muted/50 p-4">
                    <AppIcon name="book-open" class="size-8 text-muted-foreground/50" />
                </div>
                <p class="text-sm font-medium text-muted-foreground">Select a category above to begin</p>
                <p class="max-w-xs text-xs text-muted-foreground/60">
                    Items from the Clinical Catalog will appear here. Pick the ones you want to sync as billing service prices.
                </p>
            </div>

            <!-- Loading -->
            <div v-else-if="loadingItems" class="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <AppIcon name="refresh-cw" class="size-6 animate-spin text-muted-foreground/40" />
                <p class="text-sm text-muted-foreground">Loading items...</p>
            </div>

            <!-- Error -->
            <div v-else-if="loadError" class="px-4 py-3">
                <Alert variant="destructive">
                    <AlertTitle>Failed to load</AlertTitle>
                    <AlertDescription>{{ loadError }}</AlertDescription>
                </Alert>
            </div>

            <!-- Item list -->
            <template v-else-if="catalogItems.length > 0">
                <!-- Select all -->
                <div class="flex cursor-pointer items-center gap-3 border-b px-4 py-2.5 hover:bg-muted/30" @click="selectAllChecked = !selectAllChecked || selectAllChecked === 'indeterminate'">
                    <Checkbox
                        v-model="selectAllChecked"
                        class="shrink-0"
                        @click.stop
                    />
                    <span class="text-xs font-medium text-muted-foreground">
                        {{ selectAllChecked === true ? 'Deselect all' : 'Select all' }} ({{ catalogItems.length }})
                    </span>
                    <Badge variant="secondary" class="ml-auto h-5 px-1.5 text-[10px]">
                        {{ selectedItemIds.size }} selected
                    </Badge>
                </div>

                <!-- Scrollable list -->
                <ScrollArea class="min-h-0 flex-1">
                    <div class="divide-y">
                        <div
                            v-for="item in catalogItems"
                            :key="item.id"
                            class="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/30"
                            @click="toggleItem(item.id)"
                        >
                            <Checkbox
                                :model-value="isItemSelected(item.id)"
                                class="shrink-0"
                                @update:model-value="toggleItem(item.id)"
                                @click.stop
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
            </template>

            <!-- Empty state after category selected -->
            <div v-else-if="selectedCategory && !loadingItems && !loadError" class="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <AppIcon name="book-open" class="size-10 text-muted-foreground/40" />
                <p class="text-sm font-medium text-muted-foreground">No active items found</p>
                <p class="text-xs text-muted-foreground/60">Add definitions in Clinical Catalog first.</p>
            </div>
        </div>

        <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
            <Button variant="outline" @click="closeDialog()">
                {{ syncResult ? 'Done' : 'Cancel' }}
            </Button>
            <Button
                v-if="!syncResult"
                :disabled="selectedItemIds.size === 0 || syncing"
                class="gap-1.5"
                @click="executeSync"
            >
                <span :class="['flex', { 'animate-spin': syncing }]">
                    <AppIcon name="refresh-cw" class="size-3.5" />
                </span>
                {{ syncing ? 'Syncing...' : `Sync ${selectedItemIds.size} item${selectedItemIds.size !== 1 ? 's' : ''}` }}
            </Button>
        </SheetFooter>
    </SheetContent>
</Sheet>
</template>
