<script setup lang="ts">
import { computed, ref } from 'vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceRequestItemCatalog, type DepartmentCatalogItem } from '@/composables/directService/useServiceRequestItemCatalog';

export type SelectedCatalogItem = {
    catalogItemId: string;
    itemName: string;
    itemCode: string | null;
    serviceType: string;
    quantity: number;
    clinicalIndication?: string | null;
    instructions?: string | null;
};

const props = defineProps<{
    departmentId: string | null;
    serviceType: string;
    modelValue: SelectedCatalogItem[];
}>();

const emit = defineEmits<{
    'update:modelValue': [items: SelectedCatalogItem[]];
}>();

const departmentIdRef = computed(() => props.departmentId);
const serviceTypeRef = computed(() => props.serviceType);
const { data: catalogItems, isPending } = useServiceRequestItemCatalog(departmentIdRef, serviceTypeRef);

const searchQuery = ref('');
const addedIds = computed(() => new Set(props.modelValue.map((i) => i.catalogItemId)));

const searchResults = computed(() => {
    const items = catalogItems.value ?? [];
    if (!searchQuery.value) return [];
    const q = searchQuery.value.toLowerCase();
    return items.filter(
        (item) =>
            (item.name ?? '').toLowerCase().includes(q) ||
            (item.code ?? '').toLowerCase().includes(q),
    ).slice(0, 20);
});

function addItem(item: DepartmentCatalogItem): void {
    if (addedIds.value.has(item.id)) return;
    const current = [...props.modelValue];
    current.push({
        catalogItemId: item.id,
        itemName: item.name ?? '',
        itemCode: item.code,
        serviceType: mapCatalogTypeToServiceType(item.catalogType),
        quantity: 1,
    });
    emit('update:modelValue', current);
    searchQuery.value = '';
}

function removeItem(catalogItemId: string): void {
    emit('update:modelValue', props.modelValue.filter((i) => i.catalogItemId !== catalogItemId));
}

function updateQuantity(catalogItemId: string, quantity: number): void {
    const current = props.modelValue.map((item) =>
        item.catalogItemId === catalogItemId
            ? { ...item, quantity: Math.max(1, Math.min(999, quantity || 1)) }
            : item,
    );
    emit('update:modelValue', current);
}

function mapCatalogTypeToServiceType(catalogType: string | null): string {
    switch (catalogType) {
        case 'lab_test':
            return 'laboratory';
        case 'formulary_item':
            return 'pharmacy';
        case 'radiology_procedure':
            return 'radiology';
        case 'theatre_procedure':
            return 'theatre_procedure';
        default:
            return catalogType ?? '';
    }
}
</script>

<template>
    <div class="space-y-3">
        <Label>Items</Label>

        <div class="relative">
            <Input
                v-model="searchQuery"
                type="search"
                placeholder="Search items by name or code..."
                class="h-9"
            />

            <div
                v-if="searchQuery && !isPending"
                class="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md"
            >
                <div v-if="searchResults.length === 0" class="px-2 py-3 text-center text-xs text-muted-foreground">
                    No items match your search.
                </div>
                <button
                    v-for="item in searchResults"
                    :key="item.id"
                    type="button"
                    :disabled="addedIds.has(item.id)"
                    class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                    @click="addItem(item)"
                >
                    <span class="flex-1 truncate font-medium">{{ item.name }}</span>
                    <span v-if="item.code" class="font-mono text-[10px] text-muted-foreground">{{ item.code }}</span>
                    <span class="shrink-0 text-primary">
                        {{ addedIds.has(item.id) ? 'Added' : '+ Add' }}
                    </span>
                </button>
            </div>
        </div>

        <div v-if="isPending" class="space-y-1.5">
            <Skeleton v-for="n in 2" :key="n" class="h-8 w-full" />
        </div>

        <div
            v-else-if="!searchQuery && (!catalogItems || catalogItems.length === 0)"
            class="rounded-md border border-dashed p-3 text-xs text-muted-foreground"
        >
            Select a department to see available items.
        </div>

        <div v-if="modelValue.length > 0" class="overflow-hidden rounded-md border">
            <table class="w-full text-xs">
                <thead>
                    <tr class="border-b bg-muted/50">
                        <th class="px-2 py-1.5 text-left font-medium text-muted-foreground">Item</th>
                        <th class="px-2 py-1.5 text-left font-medium text-muted-foreground">Code</th>
                        <th class="w-20 px-2 py-1.5 text-left font-medium text-muted-foreground">Qty</th>
                        <th class="w-10 px-2 py-1.5" />
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="sel in modelValue" :key="sel.catalogItemId" class="border-b last:border-b-0">
                        <td class="px-2 py-1.5 font-medium">{{ sel.itemName }}</td>
                        <td class="px-2 py-1.5 font-mono text-muted-foreground">{{ sel.itemCode || '—' }}</td>
                        <td class="px-2 py-1.5">
                            <Input
                                type="number"
                                :value="sel.quantity"
                                min="1"
                                max="999"
                                class="h-7 w-16 text-xs"
                                @update:model-value="(v: string) => updateQuantity(sel.catalogItemId, parseInt(v) || 1)"
                            />
                        </td>
                        <td class="px-2 py-1.5">
                            <button
                                type="button"
                                class="text-destructive hover:underline"
                                @click="removeItem(sel.catalogItemId)"
                            >
                                Remove
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-else-if="catalogItems && catalogItems.length > 0 && !searchQuery" class="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            No items added yet. Search above to find and add items.
        </div>
    </div>
</template>