<script setup lang="ts">
import { computed } from 'vue';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
    modelValue: SelectedCatalogItem[];
}>();

const emit = defineEmits<{
    'update:modelValue': [items: SelectedCatalogItem[]];
}>();

const departmentIdRef = computed(() => props.departmentId);
const { data: catalogItems, isPending } = useServiceRequestItemCatalog(departmentIdRef);

const selectedIds = computed(() => new Set(props.modelValue.map((i) => i.catalogItemId)));

const searchQuery = defineModel<string>('search', { default: '' });

const filteredItems = computed(() => {
    const items = catalogItems.value ?? [];
    if (!searchQuery.value) return items;
    const q = searchQuery.value.toLowerCase();
    return items.filter(
        (item) =>
            (item.name ?? '').toLowerCase().includes(q) ||
            (item.code ?? '').toLowerCase().includes(q),
    );
});

function toggleItem(item: DepartmentCatalogItem): void {
    const current = [...props.modelValue];
    const idx = current.findIndex((i) => i.catalogItemId === item.id);

    if (idx >= 0) {
        current.splice(idx, 1);
    } else {
        current.push({
            catalogItemId: item.id,
            itemName: item.name ?? '',
            itemCode: item.code,
            serviceType: mapCatalogTypeToServiceType(item.catalogType),
            quantity: 1,
        });
    }

    emit('update:modelValue', current);
}

function updateQuantity(catalogItemId: string, quantity: number): void {
    const current = [...props.modelValue];
    const idx = current.findIndex((i) => i.catalogItemId === catalogItemId);
    if (idx >= 0) {
        current[idx] = { ...current[idx], quantity: Math.max(1, Math.min(999, quantity)) };
        emit('update:modelValue', current);
    }
}

function mapCatalogTypeToServiceType(catalogType: string | null): string {
    switch (catalogType) {
        case 'lab_test':
            return 'laboratory';
        case 'medicine':
            return 'pharmacy';
        case 'radiology_procedure':
            return 'radiology';
        default:
            return catalogType ?? '';
    }
}
</script>

<template>
    <div class="space-y-2">
        <Label>Items</Label>

        <Input
            v-model="searchQuery"
            type="search"
            placeholder="Search items..."
            class="h-8 text-xs"
        />

        <div v-if="isPending" class="space-y-1.5">
            <Skeleton v-for="n in 3" :key="n" class="h-7 w-full" />
        </div>

        <div v-else-if="filteredItems.length === 0" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            {{ catalogItems?.length ? 'No items match your search.' : 'Select a department to see available items.' }}
        </div>

        <div v-else class="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1.5">
            <div
                v-for="item in filteredItems"
                :key="item.id"
                class="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50"
            >
                <Checkbox
                    :id="`item-${item.id}`"
                    :checked="selectedIds.has(item.id)"
                    @update:checked="toggleItem(item)"
                />
                <Label :for="`item-${item.id}`" class="flex flex-1 items-center gap-2 text-xs font-normal">
                    <span class="font-medium">{{ item.name }}</span>
                    <span v-if="item.code" class="font-mono text-[10px] text-muted-foreground">{{ item.code }}</span>
                </Label>
                <div v-if="selectedIds.has(item.id)" class="flex items-center gap-1">
                    <Input
                        type="number"
                        :value="modelValue.find((i) => i.catalogItemId === item.id)?.quantity ?? 1"
                        min="1"
                        max="999"
                        class="h-6 w-14 text-xs"
                        @update:model-value="(v: string) => updateQuantity(item.id, parseInt(v) || 1)"
                    />
                </div>
            </div>
        </div>

        <div v-if="modelValue.length > 0" class="rounded-md bg-muted/30 p-2">
            <p class="text-[10px] font-medium text-muted-foreground">{{ modelValue.length }} item(s) selected</p>
            <ul class="mt-1 space-y-0.5">
                <li v-for="sel in modelValue" :key="sel.catalogItemId" class="flex items-center justify-between text-xs">
                    <span>{{ sel.itemName }} <span class="text-muted-foreground">(x{{ sel.quantity }})</span></span>
                </li>
            </ul>
        </div>
    </div>
</template>
