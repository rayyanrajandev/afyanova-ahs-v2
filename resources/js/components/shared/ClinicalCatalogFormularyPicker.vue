<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown } from '@/lib/notify';

type CatalogType = 'lab_test' | 'radiology_procedure' | 'theatre_procedure' | 'clinical_procedure' | 'formulary_item';

type CatalogLookupItem = {
    id: string | null;
    catalogType: CatalogType | null;
    code: string | null;
    name: string | null;
    departmentId: string | null;
    category: string | null;
    unit: string | null;
    description: string | null;
    codes: Record<string, string> | null;
    facilityTier: string | null;
    metadata: Record<string, unknown> | null;
    status: string | null;
};

type CatalogLookupResponse = { data: CatalogLookupItem[]; meta?: { lastPage?: number } };

type Props = {
    modelValue: string;
    label?: string;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    required?: boolean;
    disabled?: boolean;
    errorMessage?: string | null;
    catalogTypes?: CatalogType[];
    showPreview?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
    label: 'Clinical Catalog Item',
    placeholder: 'Search clinical definitions',
    searchPlaceholder: 'Search by code, name, or category',
    emptyText: 'No active clinical definitions found.',
    required: false,
    disabled: false,
    errorMessage: null,
    catalogTypes: () => ['lab_test', 'radiology_procedure', 'theatre_procedure', 'clinical_procedure', 'formulary_item'],
    showPreview: true,
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
    'itemSelected': [item: CatalogLookupItem];
    'itemCleared': [];
}>();

const open = ref(false);
const searchQuery = ref('');
const loading = ref(false);
const loadError = ref<string | null>(null);
const items = ref<CatalogLookupItem[]>([]);
const loaded = ref(false);

const catalogSources = [
    { type: 'lab_test' as const, path: '/platform/admin/clinical-catalogs/lab-tests', label: 'Lab Tests' },
    { type: 'radiology_procedure' as const, path: '/platform/admin/clinical-catalogs/radiology-procedures', label: 'Radiology' },
    { type: 'theatre_procedure' as const, path: '/platform/admin/clinical-catalogs/theatre-procedures', label: 'Theatre' },
    { type: 'clinical_procedure' as const, path: '/platform/admin/clinical-catalogs/clinical-procedures', label: 'Clinical Procedures' },
    { type: 'formulary_item' as const, path: '/platform/admin/clinical-catalogs/formulary-items', label: 'Medicines' },
];

const filteredSources = computed(() =>
    catalogSources.filter((s) => props.catalogTypes.includes(s.type))
);

const selectedItem = computed(() => {
    const id = props.modelValue?.trim();
    if (!id) return null;
    return items.value.find((item) => String(item.id ?? '').trim().toLowerCase() === id.toLowerCase()) ?? null;
});

const filteredItems = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    if (!query) return items.value;
    return items.value.filter((item) => {
        const searchable = [
            item.code,
            item.name,
            item.category,
            item.description,
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(query);
    });
});

const groupedItems = computed(() => {
    const groups: Record<string, CatalogLookupItem[]> = {};
    for (const item of filteredItems.value) {
        const label = catalogSources.find((s) => s.type === item.catalogType)?.label ?? 'Other';
        if (!groups[label]) groups[label] = [];
        groups[label].push(item);
    }
    return groups;
});

const previewText = computed(() => {
    if (!selectedItem.value || !props.showPreview) return null;
    const item = selectedItem.value;
    const parts = [
        item.code,
        item.name,
    ].filter(Boolean);
    if (item.catalogType) parts.push(formatEnumLabel(item.catalogType));
    return parts.join(' - ');
});

async function loadItems(): Promise<void> {
    if (loading.value || loaded.value) return;
    loading.value = true;
    loadError.value = null;

    try {
        const allItems: CatalogLookupItem[] = [];
        for (const source of filteredSources.value) {
            let page = 1;
            let lastPage = 1;
            do {
                const response = await fetch(
                    `${source.path}?status=active&page=${page}&perPage=100`
                ).then((r) => r.json()) as CatalogLookupResponse;
                allItems.push(...(response.data ?? []).map((item) => ({
                    ...item,
                    catalogType: item.catalogType ?? source.type,
                })));
                lastPage = Math.max(response.meta?.lastPage ?? 1, 1);
                page += 1;
            } while (page <= lastPage);
        }
        items.value = allItems;
        loaded.value = true;
    } catch (error) {
        loadError.value = messageFromUnknown(error, 'Unable to load clinical catalog items.');
        items.value = [];
    } finally {
        loading.value = false;
    }
}

function selectItem(item: CatalogLookupItem): void {
    emit('update:modelValue', String(item.id ?? ''));
    emit('itemSelected', item);
    open.value = false;
    searchQuery.value = '';
}

function clearSelection(): void {
    emit('update:modelValue', '');
    emit('itemCleared');
    searchQuery.value = '';
}

watch(open, (isOpen) => {
    if (isOpen) {
        void loadItems();
    }
});
</script>

<template>
    <FormFieldShell
        :input-id="`catalog-picker-${label}`"
        :label="label"
        :required="required"
        :error-message="errorMessage"
    >
        <Popover :open="open" @update:open="open = $event">
            <PopoverTrigger as-child>
                <Button
                    :id="`catalog-picker-${label}`"
                    type="button"
                    variant="outline"
                    role="combobox"
                    :aria-expanded="open"
                    class="w-full justify-between text-left font-normal"
                    :disabled="disabled"
                >
                    <span v-if="selectedItem" class="flex items-center gap-2 min-w-0 truncate">
                        <Badge variant="secondary" class="shrink-0 text-[10px]">
                            {{ formatEnumLabel(selectedItem.catalogType) }}
                        </Badge>
                        <span class="truncate">{{ selectedItem.code }} - {{ selectedItem.name }}</span>
                    </span>
                    <span v-else class="text-muted-foreground">{{ placeholder }}</span>
                    <AppIcon name="chevrons-up-down" class="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent class="w-[--radix-popover-trigger-width] p-0" align="start">
                <div class="flex flex-col">
                    <div class="border-b px-3 py-2">
                        <Input
                            v-model="searchQuery"
                            :placeholder="searchPlaceholder"
                            class="h-8 border-0 bg-transparent text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                    </div>
                    <ScrollArea class="max-h-64">
                        <div v-if="loading" class="p-3 space-y-2">
                            <Skeleton class="h-8 w-full" v-for="i in 3" :key="i" />
                        </div>
                        <div v-else-if="loadError" class="p-3">
                            <p class="text-xs text-destructive">{{ loadError }}</p>
                        </div>
                        <div v-else-if="Object.keys(groupedItems).length === 0" class="p-3">
                            <p class="text-xs text-muted-foreground">{{ emptyText }}</p>
                        </div>
                        <div v-else>
                            <div v-for="(groupItems, groupLabel) in groupedItems" :key="groupLabel">
                                <p class="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                                    {{ groupLabel }}
                                </p>
                                <button
                                    v-for="item in groupItems"
                                    :key="String(item.id)"
                                    type="button"
                                    class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                    :class="{ 'bg-accent': String(item.id) === modelValue }"
                                    @click="selectItem(item)"
                                >
                                    <span class="min-w-0 flex-1 truncate">
                                        <span class="font-medium">{{ item.code }}</span>
                                        <span class="ml-1.5 text-muted-foreground">{{ item.name }}</span>
                                    </span>
                                    <AppIcon
                                        v-if="String(item.id) === modelValue"
                                        name="check"
                                        class="size-4 shrink-0"
                                    />
                                </button>
                            </div>
                        </div>
                    </ScrollArea>
                    <div v-if="selectedItem" class="border-t px-3 py-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            class="h-7 w-full text-xs text-muted-foreground"
                            @click="clearSelection"
                        >
                            Clear selection
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
        <p v-if="previewText" class="mt-1 text-xs text-muted-foreground">{{ previewText }}</p>
    </FormFieldShell>
</template>
