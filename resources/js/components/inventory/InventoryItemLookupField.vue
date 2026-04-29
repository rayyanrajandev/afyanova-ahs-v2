<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import QuickLookupField from '@/components/lookup/QuickLookupField.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

type InventoryItem = {
    id: string;
    itemCode: string | null;
    msdCode: string | null;
    nhifCode: string | null;
    barcode: string | null;
    itemName: string | null;
    genericName: string | null;
    category: string | null;
    subcategory: string | null;
    unit: string | null;
    currentStock: number | string | null;
    reorderLevel: number | string | null;
    status: string | null;
    stockState: string | null;
};

type InventoryItemListResponse = {
    data: InventoryItem[];
    meta?: { total?: number };
};

type InventoryItemItemResponse = {
    data: InventoryItem;
};

type ValidationErrorResponse = {
    message?: string;
};

type ApiError = Error & {
    status?: number;
    payload?: ValidationErrorResponse;
};

const props = withDefaults(
    defineProps<{
        modelValue: string;
        inputId: string;
        label: string;
        placeholder?: string;
        helperText?: string;
        errorMessage?: string | null;
        disabled?: boolean;
        perPage?: number;
        /** Optional category slug to pre-filter search results */
        category?: string | null;
        /** Optional subcategory slug to pre-filter search results */
        subcategory?: string | null;
        /** Optional requesting department UUID to scope requisition item choices */
        requestingDepartmentId?: string | null;
        /** Load scoped inventory master records on focus, even before the user types */
        browseOnFocus?: boolean;
    }>(),
    {
        placeholder: 'Search by item name, code, generic name, or barcode',
        helperText: 'Search the inventory catalogue for the dispensed item.',
        errorMessage: null,
        disabled: false,
        perPage: 10,
        category: null,
        subcategory: null,
        requestingDepartmentId: null,
        browseOnFocus: false,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
    selected: [item: InventoryItem | null];
}>();

const searchQuery = ref('');
const selectedItem = ref<InventoryItem | null>(null);
const searchResults = ref<InventoryItem[]>([]);
const searchLoading = ref(false);
const hydrateLoading = ref(false);
const lookupError = ref<string | null>(null);
const accessDenied = ref(false);
const accessDeniedMessage = ref<string | null>(null);
const open = ref(false);

let debounceTimer: number | null = null;

const hasSelection = computed(() => props.modelValue.trim().length > 0);
const selectedDisplayLabel = computed(() => {
    const item = selectedItem.value;
    if (!item) return '';

    const name = item.itemName?.trim() || item.genericName?.trim() || item.itemCode?.trim() || item.id;
    const code = item.itemCode?.trim();

    return code && code !== name ? `${name} (${code})` : name;
});

const quickSearchSummary = computed(() => {
    if (searchLoading.value) return 'Searching inventory items...';
    if (props.browseOnFocus && searchResults.value.length > 0 && searchQuery.value.trim().length < 2) {
        return `${searchResults.value.length} inventory item${searchResults.value.length === 1 ? '' : 's'} found in this scope.`;
    }
    if (searchQuery.value.trim().length < 2) return 'Type at least 2 characters to search inventory items.';
    if (searchResults.value.length === 0) return 'No inventory items matched the current query.';

    return `${searchResults.value.length} inventory item${searchResults.value.length === 1 ? '' : 's'} found.`;
});
const emptySearchMessage = computed(() => (
    props.subcategory
        ? 'No items found in this subcategory. Clear subcategory to search the whole category.'
        : 'No inventory items found. Try item name, code, generic name, or barcode.'
));

function clearDebounce() {
    if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}

function formatStatusLabel(value: string | null | undefined): string {
    if (!value) return 'Unknown';

    return value
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

async function apiRequest<T>(path: string, query?: Record<string, string | number | null | undefined>): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);

    Object.entries(query ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    const payload = (await response.json().catch(() => ({}))) as ValidationErrorResponse;
    if (!response.ok) {
        const error = new Error(payload.message ?? `${response.status} ${response.statusText}`) as ApiError;
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

function isForbiddenError(error: unknown): boolean {
    return (error as ApiError | undefined)?.status === 403;
}

async function searchItems(force = false): Promise<void> {
    if (accessDenied.value) return;

    const query = searchQuery.value.trim();
    clearDebounce();

    if (!force && query.length < 2) {
        searchResults.value = [];
        lookupError.value = null;
        return;
    }

    searchLoading.value = true;
    lookupError.value = null;

    try {
        const response = await apiRequest<InventoryItemListResponse>('/inventory-procurement/items', {
            q: query,
            page: 1,
            perPage: props.perPage,
            sortBy: 'itemName',
            sortDir: 'asc',
            ...(props.category ? { category: props.category } : {}),
            ...(props.subcategory ? { subcategory: props.subcategory } : {}),
            ...(props.requestingDepartmentId ? { requestingDepartmentId: props.requestingDepartmentId } : {}),
        });
        searchResults.value = response.data ?? [];
    } catch (error) {
        if (isForbiddenError(error)) {
            accessDenied.value = true;
            accessDeniedMessage.value = 'Inventory item lookup is restricted by permissions.';
            searchResults.value = [];
            return;
        }

        lookupError.value =
            error instanceof Error
                ? error.message
                : 'Unable to search inventory items.';
        searchResults.value = [];
    } finally {
        searchLoading.value = false;
    }
}

async function hydrateSelected(id: string): Promise<void> {
    if (!id || accessDenied.value) {
        selectedItem.value = null;
        emit('selected', null);
        return;
    }

    if (selectedItem.value?.id === id) return;

    hydrateLoading.value = true;
    lookupError.value = null;

    try {
        const response = await apiRequest<InventoryItemItemResponse>(`/inventory-procurement/items/${id}`);
        selectedItem.value = response.data;
        emit('selected', response.data);
    } catch (error) {
        if (isForbiddenError(error)) {
            accessDenied.value = true;
            accessDeniedMessage.value = 'Inventory item lookup is restricted by permissions.';
            emit('selected', null);
            return;
        }

        selectedItem.value = null;
        lookupError.value =
            error instanceof Error
                ? error.message
                : 'Unable to load the selected inventory item.';
        emit('selected', null);
    } finally {
        hydrateLoading.value = false;
    }
}

function selectItem(item: InventoryItem): void {
    selectedItem.value = item;
    searchResults.value = [];
    searchQuery.value = '';
    lookupError.value = null;
    open.value = false;
    emit('update:modelValue', item.id);
    emit('selected', item);
}

function clearSelection(): void {
    selectedItem.value = null;
    searchResults.value = [];
    searchQuery.value = '';
    lookupError.value = null;
    emit('update:modelValue', '');
    emit('selected', null);
}

function handleSearchFocus(): void {
    open.value = true;
    if (props.browseOnFocus) {
        void searchItems(true);
        return;
    }

    if (searchQuery.value.trim().length >= 2) {
        void searchItems(true);
    }
}

watch(
    () => props.modelValue,
    (value) => {
        void hydrateSelected(value.trim());
    },
    { immediate: true },
);

watch(searchQuery, (value) => {
    if (accessDenied.value) return;

    clearDebounce();
    open.value = true;

    if (value.trim().length < 2) {
        searchResults.value = [];
        lookupError.value = null;
        return;
    }

    debounceTimer = window.setTimeout(() => {
        void searchItems();
        debounceTimer = null;
    }, 300);
});

watch(
    () => [props.category, props.subcategory, props.requestingDepartmentId],
    () => {
        searchResults.value = [];
        searchQuery.value = '';
        lookupError.value = null;
        if (props.browseOnFocus && open.value && props.category) {
            void searchItems(true);
            return;
        }

        open.value = false;
    },
);

onBeforeUnmount(clearDebounce);
</script>

<template>
    <QuickLookupField
        :input-id="inputId"
        :label="label"
        :placeholder="placeholder"
        :helper-text="helperText"
        :error-message="errorMessage"
        :disabled="disabled"
        :open="open"
        :query="searchQuery"
        :display-value="selectedDisplayLabel"
        :show-clear="hasSelection"
        :access-denied="accessDenied"
        :access-denied-message="accessDeniedMessage"
        @update:open="open = $event"
        @update:query="searchQuery = $event"
        @focus="handleSearchFocus"
        @clear="clearSelection"
    >
        <template #results>
            <div v-if="searchLoading || hydrateLoading" class="px-3 py-3 text-xs text-muted-foreground">
                Searching inventory items...
            </div>

            <Alert v-else-if="lookupError" variant="destructive" class="m-1">
                <AlertDescription class="text-xs">
                    {{ lookupError }}
                </AlertDescription>
            </Alert>

            <template v-else-if="searchResults.length > 0">
                <button
                    v-for="item in searchResults"
                    :key="item.id"
                    type="button"
                    class="flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
                    @click="selectItem(item)"
                >
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-medium">{{ item.itemName || item.itemCode || item.id }}</span>
                        <Badge v-if="item.itemCode" variant="outline">{{ item.itemCode }}</Badge>
                        <Badge v-if="item.status" variant="secondary">{{ formatStatusLabel(item.status) }}</Badge>
                    </div>
                    <span class="text-xs text-muted-foreground">
                        {{ item.genericName || 'No generic name' }}
                        <template v-if="item.subcategory">
                            | {{ formatStatusLabel(item.subcategory) }}
                        </template>
                        <template v-if="item.barcode">
                            | Barcode {{ item.barcode }}
                        </template>
                        <template v-if="item.unit">
                            | {{ item.unit }}
                        </template>
                        <template v-if="item.stockState">
                            | {{ formatStatusLabel(item.stockState) }}
                        </template>
                    </span>
                </button>
            </template>

            <p v-else-if="searchQuery.trim().length === 1" class="px-3 py-3 text-xs text-muted-foreground">
                Type at least 2 characters to search inventory items.
            </p>

            <p v-else-if="searchQuery.trim().length >= 2" class="px-3 py-3 text-xs text-muted-foreground">
                {{ emptySearchMessage }}
            </p>

            <p v-else-if="browseOnFocus && category" class="px-3 py-3 text-xs text-muted-foreground">
                No inventory items found in this category. Clear subcategory or create the item first.
            </p>

            <p v-else class="px-3 py-3 text-xs text-muted-foreground">
                Search by item name, code, generic name, or barcode.
            </p>
        </template>

        <template #footer>
            <p class="text-[11px] leading-relaxed text-muted-foreground">
                {{ quickSearchSummary }}
            </p>
        </template>
    </QuickLookupField>
</template>
