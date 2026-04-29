<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import QuickLookupField from '@/components/lookup/QuickLookupField.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

type ClaimsInsuranceCase = {
    id: string;
    claimNumber: string | null;
    invoiceId: string | null;
    patientId: string | null;
    payerType: string | null;
    payerName: string | null;
    claimAmount: number | string | null;
    currencyCode: string | null;
    submittedAt: string | null;
    status: string | null;
};

type ClaimsInsuranceCaseListResponse = {
    data: ClaimsInsuranceCase[];
    meta?: { total?: number };
};

type ClaimsInsuranceCaseItemResponse = {
    data: ClaimsInsuranceCase;
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
    }>(),
    {
        placeholder: 'Search by claim number or payer name',
        helperText: 'Search existing claims cases before linking a dispensed item.',
        errorMessage: null,
        disabled: false,
        perPage: 10,
        status: '',
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
    selected: [claim: ClaimsInsuranceCase | null];
}>();

const searchQuery = ref('');
const selectedClaim = ref<ClaimsInsuranceCase | null>(null);
const searchResults = ref<ClaimsInsuranceCase[]>([]);
const searchLoading = ref(false);
const hydrateLoading = ref(false);
const lookupError = ref<string | null>(null);
const accessDenied = ref(false);
const accessDeniedMessage = ref<string | null>(null);
const open = ref(false);

let debounceTimer: number | null = null;

const hasSelection = computed(() => props.modelValue.trim().length > 0);

const quickSearchSummary = computed(() => {
    if (searchLoading.value) return 'Searching claims cases...';
    if (searchQuery.value.trim().length < 2) return 'Type at least 2 characters to search claims cases.';
    if (searchResults.value.length === 0) return 'No claims cases matched the current query.';

    return `${searchResults.value.length} claims case${searchResults.value.length === 1 ? '' : 's'} available.`;
});

function clearDebounce() {
    if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}

function formatCurrency(value: number | string | null | undefined, currencyCode: string | null | undefined): string {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode || 'TZS',
        maximumFractionDigits: 2,
    }).format(Number(value ?? 0));
}

function formatDate(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(date);
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

async function searchClaims(force = false): Promise<void> {
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
        const response = await apiRequest<ClaimsInsuranceCaseListResponse>('/claims-insurance', {
            q: query,
            status: props.status || null,
            page: 1,
            perPage: props.perPage,
            sortBy: 'createdAt',
            sortDir: 'desc',
        });
        searchResults.value = response.data ?? [];
    } catch (error) {
        if (isForbiddenError(error)) {
            accessDenied.value = true;
            accessDeniedMessage.value = 'Claims case lookup is restricted by permissions.';
            searchResults.value = [];
            return;
        }

        lookupError.value =
            error instanceof Error
                ? error.message
                : 'Unable to search claims cases.';
        searchResults.value = [];
    } finally {
        searchLoading.value = false;
    }
}

async function hydrateSelected(id: string): Promise<void> {
    if (!id || accessDenied.value) {
        selectedClaim.value = null;
        emit('selected', null);
        return;
    }

    if (selectedClaim.value?.id === id) return;

    hydrateLoading.value = true;
    lookupError.value = null;

    try {
        const response = await apiRequest<ClaimsInsuranceCaseItemResponse>(`/claims-insurance/${id}`);
        selectedClaim.value = response.data;
        emit('selected', response.data);
    } catch (error) {
        if (isForbiddenError(error)) {
            accessDenied.value = true;
            accessDeniedMessage.value = 'Claims case lookup is restricted by permissions.';
            emit('selected', null);
            return;
        }

        selectedClaim.value = null;
        lookupError.value =
            error instanceof Error
                ? error.message
                : 'Unable to load the selected claims case.';
        emit('selected', null);
    } finally {
        hydrateLoading.value = false;
    }
}

function selectClaim(claim: ClaimsInsuranceCase): void {
    selectedClaim.value = claim;
    searchResults.value = [];
    searchQuery.value = '';
    lookupError.value = null;
    open.value = false;
    emit('update:modelValue', claim.id);
    emit('selected', claim);
}

function clearSelection(): void {
    selectedClaim.value = null;
    searchResults.value = [];
    searchQuery.value = '';
    lookupError.value = null;
    emit('update:modelValue', '');
    emit('selected', null);
}

function handleSearchFocus(): void {
    open.value = true;
    if (searchQuery.value.trim().length >= 2) {
        void searchClaims(true);
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
        void searchClaims();
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
                Searching claims cases...
            </div>

            <Alert v-else-if="lookupError" variant="destructive" class="m-1">
                <AlertDescription class="text-xs">
                    {{ lookupError }}
                </AlertDescription>
            </Alert>

            <template v-else-if="searchQuery.trim().length >= 2 && searchResults.length > 0">
                <button
                    v-for="claim in searchResults"
                    :key="claim.id"
                    type="button"
                    class="flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
                    @click="selectClaim(claim)"
                >
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-medium">{{ claim.claimNumber || claim.id }}</span>
                        <Badge v-if="claim.status" variant="secondary">{{ formatStatusLabel(claim.status) }}</Badge>
                        <Badge v-if="claim.currencyCode" variant="outline">{{ claim.currencyCode }}</Badge>
                    </div>
                    <span class="text-xs text-muted-foreground">
                        {{ claim.payerName || 'No payer name' }}
                        <template v-if="claim.payerType">
                            | {{ formatStatusLabel(claim.payerType) }}
                        </template>
                        <template v-if="claim.claimAmount !== null && claim.claimAmount !== undefined">
                            | {{ formatCurrency(claim.claimAmount, claim.currencyCode) }}
                        </template>
                        <template v-if="claim.submittedAt">
                            | {{ formatDate(claim.submittedAt) }}
                        </template>
                    </span>
                </button>
            </template>

            <p v-else-if="searchQuery.trim().length === 1" class="px-3 py-3 text-xs text-muted-foreground">
                Type at least 2 characters to search claims cases.
            </p>

            <p v-else-if="searchQuery.trim().length >= 2" class="px-3 py-3 text-xs text-muted-foreground">
                No claims cases found. Try claim number or payer name.
            </p>

            <p v-else class="px-3 py-3 text-xs text-muted-foreground">
                Search by claim number or payer name.
            </p>
        </template>

        <template #footer>
            <p class="text-[11px] leading-relaxed text-muted-foreground">
                {{ quickSearchSummary }}
            </p>
        </template>
    </QuickLookupField>
</template>
