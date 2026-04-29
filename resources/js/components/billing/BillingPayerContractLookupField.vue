<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import QuickLookupField from '@/components/lookup/QuickLookupField.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

type BillingPayerContract = {
    id: string;
    contractCode: string | null;
    contractName: string | null;
    payerType: string | null;
    payerName: string | null;
    payerPlanCode?: string | null;
    currencyCode: string | null;
    status?: string | null;
};

type BillingPayerContractListResponse = {
    data: BillingPayerContract[];
    meta?: { total?: number };
};

type BillingPayerContractItemResponse = {
    data: BillingPayerContract;
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
        status?: string;
        payerTypes?: string[];
    }>(),
    {
        placeholder: 'Search by contract code, contract name, or payer name',
        helperText: 'Search active payer contracts available for corporate settlement.',
        errorMessage: null,
        disabled: false,
        perPage: 15,
        status: 'active',
        payerTypes: () => [],
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
    selected: [contract: BillingPayerContract | null];
}>();

const searchQuery = ref('');
const selectedContract = ref<BillingPayerContract | null>(null);
const searchResults = ref<BillingPayerContract[]>([]);
const searchLoading = ref(false);
const hydrateLoading = ref(false);
const lookupError = ref<string | null>(null);
const accessDenied = ref(false);
const accessDeniedMessage = ref<string | null>(null);
const open = ref(false);

let debounceTimer: number | null = null;

const allowedPayerTypes = computed(() =>
    props.payerTypes
        .map((payerType) => payerType.trim().toLowerCase())
        .filter((payerType) => payerType !== ''),
);

const hasSelection = computed(() => props.modelValue.trim().length > 0);

const quickSearchSummary = computed(() => {
    if (searchLoading.value) return 'Searching payer contracts...';
    if (searchQuery.value.trim().length < 2) return 'Type at least 2 characters to search payer contracts.';
    if (searchResults.value.length === 0) return 'No payer contracts matched the current query.';

    return `${searchResults.value.length} payer contract${searchResults.value.length === 1 ? '' : 's'} available.`;
});

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

function contractLabel(contract: BillingPayerContract): string {
    return contract.contractCode || contract.contractName || contract.payerName || contract.id;
}

function matchesAllowedPayerType(contract: BillingPayerContract): boolean {
    if (allowedPayerTypes.value.length === 0) return true;

    return allowedPayerTypes.value.includes((contract.payerType ?? '').trim().toLowerCase());
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

async function searchContracts(force = false): Promise<void> {
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
        const response = await apiRequest<BillingPayerContractListResponse>('/billing-payer-contracts', {
            q: query,
            status: props.status || null,
            payerType: allowedPayerTypes.value.length === 1 ? allowedPayerTypes.value[0] : null,
            page: 1,
            perPage: props.perPage,
            sortBy: 'contractName',
            sortDir: 'asc',
        });
        searchResults.value = (response.data ?? []).filter(matchesAllowedPayerType);
    } catch (error) {
        if (isForbiddenError(error)) {
            accessDenied.value = true;
            accessDeniedMessage.value = 'Payer contract lookup is restricted by permissions.';
            searchResults.value = [];
            return;
        }

        lookupError.value =
            error instanceof Error
                ? error.message
                : 'Unable to search payer contracts.';
        searchResults.value = [];
    } finally {
        searchLoading.value = false;
    }
}

async function hydrateSelected(id: string): Promise<void> {
    if (!id || accessDenied.value) {
        selectedContract.value = null;
        emit('selected', null);
        return;
    }

    if (selectedContract.value?.id === id) return;

    hydrateLoading.value = true;
    lookupError.value = null;

    try {
        const response = await apiRequest<BillingPayerContractItemResponse>(`/billing-payer-contracts/${id}`);
        selectedContract.value = response.data;
        emit('selected', response.data);
    } catch (error) {
        if (isForbiddenError(error)) {
            accessDenied.value = true;
            accessDeniedMessage.value = 'Payer contract lookup is restricted by permissions.';
            emit('selected', null);
            return;
        }

        selectedContract.value = null;
        lookupError.value =
            error instanceof Error
                ? error.message
                : 'Unable to load the selected payer contract.';
        emit('selected', null);
    } finally {
        hydrateLoading.value = false;
    }
}

function selectContract(contract: BillingPayerContract): void {
    selectedContract.value = contract;
    searchResults.value = [];
    searchQuery.value = '';
    lookupError.value = null;
    open.value = false;
    emit('update:modelValue', contract.id);
    emit('selected', contract);
}

function clearSelection(): void {
    selectedContract.value = null;
    searchResults.value = [];
    searchQuery.value = '';
    lookupError.value = null;
    emit('update:modelValue', '');
    emit('selected', null);
}

function handleSearchFocus(): void {
    open.value = true;
    if (searchQuery.value.trim().length >= 2) {
        void searchContracts(true);
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
        void searchContracts();
        debounceTimer = null;
    }, 300);
});

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
                Searching payer contracts...
            </div>

            <Alert v-else-if="lookupError" variant="destructive" class="m-1">
                <AlertDescription class="text-xs">
                    {{ lookupError }}
                </AlertDescription>
            </Alert>

            <template v-else-if="searchQuery.trim().length >= 2 && searchResults.length > 0">
                <button
                    v-for="contract in searchResults"
                    :key="contract.id"
                    type="button"
                    class="flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
                    @click="selectContract(contract)"
                >
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-medium">{{ contractLabel(contract) }}</span>
                        <Badge v-if="contract.payerType" variant="secondary">{{ formatStatusLabel(contract.payerType) }}</Badge>
                        <Badge v-if="contract.currencyCode" variant="outline">{{ contract.currencyCode }}</Badge>
                    </div>
                    <span class="text-xs text-muted-foreground">
                        {{ contract.contractName || 'No contract name' }}
                        <template v-if="contract.payerName">
                            | {{ contract.payerName }}
                        </template>
                        <template v-if="contract.status">
                            | {{ formatStatusLabel(contract.status) }}
                        </template>
                    </span>
                </button>
            </template>

            <p v-else-if="searchQuery.trim().length === 1" class="px-3 py-3 text-xs text-muted-foreground">
                Type at least 2 characters to search payer contracts.
            </p>

            <p v-else-if="searchQuery.trim().length >= 2" class="px-3 py-3 text-xs text-muted-foreground">
                No payer contracts found. Try contract code, contract name, or payer name.
            </p>

            <p v-else class="px-3 py-3 text-xs text-muted-foreground">
                Search by contract code, contract name, or payer name.
            </p>
        </template>

        <template #footer>
            <p class="text-[11px] leading-relaxed text-muted-foreground">
                {{ quickSearchSummary }}
            </p>
        </template>
    </QuickLookupField>
</template>