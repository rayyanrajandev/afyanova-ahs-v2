<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import type { AppIconName } from '@/lib/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiRequestJson } from '@/lib/apiClient';

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

type Step = 'select-types' | 'confirm-items' | 'sync-result';

const props = defineProps<{
    open: boolean;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    'synced': [];
}>();

const step = ref<Step>('select-types');
const selectedTypes = ref<Set<string>>(new Set(['lab_test', 'radiology_procedure', 'theatre_procedure', 'formulary_item']));
const catalogItems = ref<CatalogItem[]>([]);
const loadingItems = ref(false);
const loadError = ref<string | null>(null);
const syncing = ref(false);
const syncResult = ref<SyncResult | null>(null);

const catalogTypeOptions = [
    { value: 'lab_test', label: 'Lab Tests', icon: 'flask-conical' as AppIconName },
    { value: 'radiology_procedure', label: 'Radiology', icon: 'layers' as AppIconName },
    { value: 'theatre_procedure', label: 'Theatre Procedures', icon: 'scissors' as AppIconName },
    { value: 'formulary_item', label: 'Formulary (Medicines)', icon: 'pill' as AppIconName },
];

function toggleType(value: string) {
    const next = new Set(selectedTypes.value);
    if (next.has(value)) {
        if (next.size > 1) next.delete(value);
    } else {
        next.add(value);
    }
    selectedTypes.value = next;
}

async function loadItems() {
    const types = [...selectedTypes.value];
    if (types.length === 0) return;

    loadingItems.value = true;
    loadError.value = null;

    try {
        const response = await apiRequestJson<any>('GET', '/platform/admin/clinical-catalogs/sync-candidates', {
            query: { 'catalogTypes[]': types },
        });
        const items = Array.isArray(response?.data) ? response.data : [];
        catalogItems.value = items.map((item: any) => ({
            id: String(item.id ?? ''),
            code: item.code ?? '',
            name: item.name ?? '',
            catalogType: item.catalogType ?? 'formulary_item',
            category: item.category ?? null,
            unit: item.unit ?? null,
            description: item.description ?? null,
        }));
        step.value = 'confirm-items';
    } catch (err: any) {
        loadError.value = err?.message ?? 'Failed to load catalog items.';
    } finally {
        loadingItems.value = false;
    }
}

async function executeSync() {
    const types = [...selectedTypes.value];
    if (types.length === 0) return;

    syncing.value = true;
    syncResult.value = null;

    try {
        const response = await apiRequestJson<SyncResult>('POST', '/billing-service-catalog/items/bulk-sync-from-catalog', {
            body: {
                catalogTypes: types,
                defaultCurrencyCode: null,
            },
        });

        syncResult.value = response ?? { created: 0, updated: 0, errors: [] };
        step.value = 'sync-result';
        emit('synced');
    } catch (err: any) {
        if (err?.status === 422 && err?.payload && Array.isArray(err.payload?.errors)) {
            syncResult.value = err.payload as SyncResult;
        } else {
            syncResult.value = { created: 0, updated: 0, errors: [{ catalogItemId: '', code: '', name: '', error: err.message }] };
        }
        step.value = 'sync-result';
    } finally {
        syncing.value = false;
    }
}

function goBack() {
    step.value = 'select-types';
    catalogItems.value = [];
    loadError.value = null;
}

function closeDialog() {
    emit('update:open', false);
    step.value = 'select-types';
    selectedTypes.value = new Set(['lab_test', 'radiology_procedure', 'theatre_procedure', 'formulary_item']);
    catalogItems.value = [];
    syncResult.value = null;
    loadError.value = null;
}
</script>

<template>
<Sheet :open="open" @update:open="closeDialog">
    <SheetContent side="right" variant="form" size="4xl">
        <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
            <SheetTitle class="flex items-center gap-2">
                <AppIcon name="book-open" class="size-5 text-muted-foreground" />
                Sync from Clinical Care Catalog
            </SheetTitle>
            <SheetDescription>
                {{
                    step === 'select-types'
                        ? 'Select the catalog categories to load, then review before syncing.'
                        : step === 'confirm-items'
                            ? `Review ${catalogItems.length} item${catalogItems.length !== 1 ? 's' : ''} loaded from ${selectedTypes.size} categor${selectedTypes.size !== 1 ? 'ies' : 'y'}.`
                            : 'Sync results.'
                }}
            </SheetDescription>
        </SheetHeader>

        <!-- Step: Sync result -->
        <div v-if="step === 'sync-result' && syncResult" class="border-b px-4 py-3">
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

        <!-- Step: Select types -->
        <div v-if="step === 'select-types'" class="flex min-h-0 flex-1 flex-col gap-1 px-4 py-4">
            <p class="mb-2 text-xs font-medium text-muted-foreground">Choose categories to load:</p>
            <div
                v-for="ct in catalogTypeOptions"
                :key="ct.value"
                class="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/30"
                :class="{ 'border-primary/50 bg-primary/5': selectedTypes.has(ct.value) }"
                @click="toggleType(ct.value)"
            >
                <Checkbox
                    :checked="selectedTypes.has(ct.value)"
                    class="shrink-0"
                    @update:checked="toggleType(ct.value)"
                    @click.stop
                />
                <AppIcon :name="ct.icon" class="size-5 text-muted-foreground" />
                <span class="text-sm font-medium">{{ ct.label }}</span>
            </div>
            <p v-if="selectedTypes.size === 0" class="mt-2 text-xs text-destructive">Select at least one category.</p>
        </div>

        <!-- Step: Confirm items -->
        <div v-if="step === 'confirm-items'" class="flex min-h-0 flex-1 flex-col">
            <div v-if="loadingItems" class="flex flex-col items-center gap-2 px-4 py-12 text-center">
                <AppIcon name="refresh-cw" class="size-6 animate-spin text-muted-foreground/40" />
                <p class="text-sm text-muted-foreground">Loading catalog items...</p>
            </div>

            <div v-else-if="loadError" class="px-4 py-3">
                <Alert variant="destructive">
                    <AlertTitle>Failed to load</AlertTitle>
                    <AlertDescription>{{ loadError }}</AlertDescription>
                </Alert>
            </div>

            <div v-else class="flex flex-col">
                <div class="flex items-center gap-3 border-b px-4 py-3">
                    <Badge variant="secondary" class="h-5 px-1.5 text-[10px]">
                        {{ catalogItems.length }} item{{ catalogItems.length !== 1 ? 's' : '' }}
                    </Badge>
                    <div class="flex flex-wrap gap-1">
                        <Badge v-for="t in selectedTypes" :key="t" variant="outline" class="h-5 px-1.5 text-[10px]">
                            {{ catalogTypeOptions.find(o => o.value === t)?.label ?? t }}
                        </Badge>
                    </div>
                </div>
                <div class="min-h-0 flex-1 divide-y overflow-auto">
                    <div v-for="item in catalogItems" :key="item.id" class="flex items-center gap-3 px-4 py-2.5">
                        <AppIcon :name="catalogTypeOptions.find(o => o.value === item.catalogType)?.icon ?? 'book-open'" class="size-4 shrink-0 text-muted-foreground/60" />
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
            </div>
        </div>

        <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
            <Button variant="outline" @click="step === 'sync-result' ? closeDialog() : step === 'confirm-items' ? goBack() : closeDialog()">
                {{ step === 'sync-result' ? 'Done' : 'Cancel' }}
            </Button>

            <!-- Step 1: Load items button -->
            <Button
                v-if="step === 'select-types'"
                :disabled="selectedTypes.size === 0 || loadingItems"
                class="gap-1.5"
                @click="loadItems"
            >
                <span :class="['flex', { 'animate-spin': loadingItems }]">
                    <AppIcon name="refresh-cw" class="size-3.5" />
                </span>
                {{ loadingItems ? 'Loading...' : `Load ${selectedTypes.size} categor${selectedTypes.size !== 1 ? 'ies' : 'y'}` }}
            </Button>

            <!-- Step 2: Sync button -->
            <Button
                v-if="step === 'confirm-items'"
                :disabled="syncing || catalogItems.length === 0"
                class="gap-1.5"
                @click="executeSync"
            >
                <span :class="['flex', { 'animate-spin': syncing }]">
                    <AppIcon name="refresh-cw" class="size-3.5" />
                </span>
                {{ syncing ? 'Syncing...' : `Sync ${catalogItems.length} item${catalogItems.length !== 1 ? 's' : ''}` }}
            </Button>
        </SheetFooter>
    </SheetContent>
</Sheet>
</template>
