<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import QuickLookupField from '@/components/lookup/QuickLookupField.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

type BillingInvoiceSummary = {
    id: string;
    invoiceNumber: string | null;
    patientId: string | null;
    billingPayerContractId: string | null;
    invoiceDate: string | null;
    currencyCode: string | null;
    totalAmount: number | string | null;
    paidAmount: number | string | null;
    balanceAmount: number | string | null;
    status: string | null;
    lastPaymentAt: string | null;
};

type BillingInvoiceListResponse = {
    data: BillingInvoiceSummary[];
    meta?: { total?: number };
};

type BillingInvoiceItemResponse = {
    data: BillingInvoiceSummary;
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
        statuses?: string[];
    }>(),
    {
        placeholder: 'Search by invoice number or notes',
        helperText: 'Search the billing ledger by invoice number or notes.',
        errorMessage: null,
        disabled: false,
        perPage: 10,
        statuses: () => [],
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
    selected: [invoice: BillingInvoiceSummary | null];
}>();

const searchQuery = ref('');
const selectedInvoice = ref<BillingInvoiceSummary | null>(null);
const searchResults = ref<BillingInvoiceSummary[]>([]);
const searchLoading = ref(false);
const hydrateLoading = ref(false);
const lookupError = ref<string | null>(null);
const accessDenied = ref(false);
const accessDeniedMessage = ref<string | null>(null);
const open = ref(false);

let debounceTimer: number | null = null;

const normalizedStatuses = computed(() =>
    props.statuses
        .map((status) => status.trim().toLowerCase())
        .filter((status) => status !== ''),
);

const hasSelection = computed(() => props.modelValue.trim().length > 0);

const quickSearchSummary = computed(() => {
    if (searchLoading.value) return 'Searching invoices...';
    if (searchQuery.value.trim().length < 2) return 'Type at least 2 characters to search the invoice ledger.';
    if (searchResults.value.length === 0) return 'No invoices matched the current query.';

    return `${searchResults.value.length} invoice${searchResults.value.length === 1 ? '' : 's'} available.`;
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

async function searchInvoices(force = false): Promise<void> {
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
        const response = await apiRequest<BillingInvoiceListResponse>('/billing-invoices', {
            q: query,
            statusIn: normalizedStatuses.value.length > 0 ? normalizedStatuses.value.join(',') : null,
            page: 1,
            perPage: props.perPage,
            sortBy: 'invoiceDate',
            sortDir: 'desc',
        });
        searchResults.value = response.data ?? [];
    } catch (error) {
        if (isForbiddenError(error)) {
            accessDenied.value = true;
            accessDeniedMessage.value = 'Billing invoice lookup is restricted by permissions.';
            searchResults.value = [];
            return;
        }

        lookupError.value =
            error instanceof Error
                ? error.message
                : 'Unable to search billing invoices.';
        searchResults.value = [];
    } finally {
        searchLoading.value = false;
    }
}

async function hydrateSelected(id: string): Promise<void> {
    if (!id || accessDenied.value) {
        selectedInvoice.value = null;
        emit('selected', null);
        return;
    }

    if (selectedInvoice.value?.id === id) return;

    hydrateLoading.value = true;
    lookupError.value = null;

    try {
        const response = await apiRequest<BillingInvoiceItemResponse>(`/billing-invoices/${id}`);
        selectedInvoice.value = response.data;
        emit('selected', response.data);
    } catch (error) {
        if (isForbiddenError(error)) {
            accessDenied.value = true;
            accessDeniedMessage.value = 'Billing invoice lookup is restricted by permissions.';
            emit('selected', null);
            return;
        }

        selectedInvoice.value = null;
        lookupError.value =
            error instanceof Error
                ? error.message
                : 'Unable to load the selected billing invoice.';
        emit('selected', null);
    } finally {
        hydrateLoading.value = false;
    }
}

function selectInvoice(invoice: BillingInvoiceSummary): void {
    selectedInvoice.value = invoice;
    searchResults.value = [];
    searchQuery.value = '';
    lookupError.value = null;
    open.value = false;
    emit('update:modelValue', invoice.id);
    emit('selected', invoice);
}

function clearSelection(): void {
    selectedInvoice.value = null;
    searchResults.value = [];
    searchQuery.value = '';
    lookupError.value = null;
    emit('update:modelValue', '');
    emit('selected', null);
}

function handleSearchFocus(): void {
    open.value = true;
    if (searchQuery.value.trim().length >= 2) {
        void searchInvoices(true);
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
        void searchInvoices();
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
                Searching invoices...
            </div>

            <Alert v-else-if="lookupError" variant="destructive" class="m-1">
                <AlertDescription class="text-xs">
                    {{ lookupError }}
                </AlertDescription>
            </Alert>

            <template v-else-if="searchQuery.trim().length >= 2 && searchResults.length > 0">
                <button
                    v-for="invoice in searchResults"
                    :key="invoice.id"
                    type="button"
                    class="flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
                    @click="selectInvoice(invoice)"
                >
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-medium">{{ invoice.invoiceNumber || invoice.id }}</span>
                        <Badge v-if="invoice.status" variant="secondary">{{ formatStatusLabel(invoice.status) }}</Badge>
                        <Badge v-if="invoice.currencyCode" variant="outline">{{ invoice.currencyCode }}</Badge>
                    </div>
                    <span class="text-xs text-muted-foreground">
                        Outstanding {{ formatCurrency(invoice.balanceAmount, invoice.currencyCode) }}
                        <template v-if="invoice.totalAmount !== null && invoice.totalAmount !== undefined">
                            | Total {{ formatCurrency(invoice.totalAmount, invoice.currencyCode) }}
                        </template>
                        <template v-if="invoice.invoiceDate">
                            | {{ formatDate(invoice.invoiceDate) }}
                        </template>
                    </span>
                </button>
            </template>

            <p v-else-if="searchQuery.trim().length === 1" class="px-3 py-3 text-xs text-muted-foreground">
                Type at least 2 characters to search invoices.
            </p>

            <p v-else-if="searchQuery.trim().length >= 2" class="px-3 py-3 text-xs text-muted-foreground">
                No invoices found. Try invoice number or note text.
            </p>

            <p v-else class="px-3 py-3 text-xs text-muted-foreground">
                Search by invoice number or note text.
            </p>
        </template>

        <template #footer>
            <p class="text-[11px] leading-relaxed text-muted-foreground">
                {{ quickSearchSummary }}
            </p>
        </template>
    </QuickLookupField>
</template>
