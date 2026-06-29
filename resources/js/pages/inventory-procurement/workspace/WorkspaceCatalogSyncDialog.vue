<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import type { AppIconName } from '@/lib/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { apiRequestJson } from '@/lib/apiClient';
import { useInventoryWorkspace } from './inventoryWorkspaceApi';

const ws = useInventoryWorkspace();

type SyncResult = {
    created: number;
    updated: number;
    errors: Array<{ catalogItemId: string; code: string; name: string; error: string }>;
};

const selectedTypes = ref<Set<string>>(new Set(['formulary_item']));
const syncing = ref(false);
const syncResult = ref<SyncResult | null>(null);

const catalogTypes = [
    { value: 'formulary_item', label: 'Formulary (Medicines)', icon: 'pill' as AppIconName },
    { value: 'lab_test', label: 'Lab Tests', icon: 'flask-conical' as AppIconName },
    { value: 'radiology_procedure', label: 'Radiology', icon: 'layers' as AppIconName },
    { value: 'theatre_procedure', label: 'Theatre Procedures', icon: 'scissors' as AppIconName },
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

async function executeSync() {
    const types = [...selectedTypes.value];
    if (types.length === 0) return;

    syncing.value = true;
    syncResult.value = null;

    try {
        const response = await apiRequestJson<SyncResult>('POST', '/inventory-procurement/items/bulk-sync-from-catalog', {
            body: {
                catalogTypes: types,
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
    selectedTypes.value = new Set(['formulary_item']);
}
</script>

<template>
<Sheet :open="(ws as any).catalogSyncDialogOpen ?? false" @update:open="closeDialog">
    <SheetContent side="right" variant="form" size="md">
        <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
            <SheetTitle class="flex items-center gap-2">
                <AppIcon name="book-open" class="size-5 text-muted-foreground" />
                Sync from Clinical Care Catalog
            </SheetTitle>
            <SheetDescription>
                Select catalog categories to create inventory items. Identity fields are pre-filled from the catalog.
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

        <!-- Type selection -->
        <div v-if="!syncResult" class="flex min-h-0 flex-1 flex-col gap-1 px-4 py-4">
            <p class="mb-2 text-xs font-medium text-muted-foreground">Choose categories to sync:</p>
            <div
                v-for="ct in catalogTypes"
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

        <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
            <Button variant="outline" @click="closeDialog">
                {{ syncResult ? 'Done' : 'Cancel' }}
            </Button>
            <Button
                v-if="!syncResult"
                :disabled="selectedTypes.size === 0 || syncing"
                class="gap-1.5"
                @click="executeSync"
            >
                <span :class="['flex', { 'animate-spin': syncing }]">
                    <AppIcon name="refresh-cw" class="size-3.5" />
                </span>
                {{ syncing ? 'Syncing...' : `Sync ${selectedTypes.size} categor${selectedTypes.size !== 1 ? 'ies' : 'y'}` }}
            </Button>
        </SheetFooter>
    </SheetContent>
</Sheet>
</template>
