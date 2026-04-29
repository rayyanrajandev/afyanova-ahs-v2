<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import QuickLookupField from '@/components/lookup/QuickLookupField.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

type CashBillingAccount = {
    id: string;
    patient_id: string | null;
    currency_code: string | null;
    account_balance: number | null;
    total_charged: number | null;
    total_paid: number | null;
    status: string | null;
    patient?: {
        id: string | null;
        patient_number: string | null;
        first_name: string | null;
        middle_name: string | null;
        last_name: string | null;
        display_name: string | null;
        phone: string | null;
        status: string | null;
    } | null;
};

type CashBillingListResponse = {
    data: CashBillingAccount[];
    meta?: { total?: number };
};

type CashBillingItemResponse = {
    data: {
        account: CashBillingAccount;
    };
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
        status?: string;
        perPage?: number;
    }>(),
    {
        placeholder: 'Search by patient number, patient name, phone, or notes',
        helperText: 'Search active or historical cash billing accounts.',
        errorMessage: null,
        disabled: false,
        status: 'active',
        perPage: 10,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
    selected: [account: CashBillingAccount | null];
}>();

const searchQuery = ref('');
const selectedAccount = ref<CashBillingAccount | null>(null);
const searchResults = ref<CashBillingAccount[]>([]);
const searchLoading = ref(false);
const hydrateLoading = ref(false);
const lookupError = ref<string | null>(null);
const accessDenied = ref(false);
const accessDeniedMessage = ref<string | null>(null);
const open = ref(false);

let debounceTimer: number | null = null;

const hasSelection = computed(() => props.modelValue.trim().length > 0);

const quickSearchSummary = computed(() => {
    if (searchLoading.value) return 'Searching cash accounts...';
    if (searchQuery.value.trim().length < 2) return 'Type at least 2 characters to search cash accounts.';
    if (searchResults.value.length === 0) return 'No cash accounts matched the current query.';

    return `${searchResults.value.length} cash account${searchResults.value.length === 1 ? '' : 's'} available.`;
});

function clearDebounce() {
    if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}

function patientDisplayName(account: CashBillingAccount): string {
    const patient = account.patient;
    if (!patient) return account.id;

    const fullName = [patient.first_name, patient.middle_name, patient.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();

    return fullName || patient.display_name || patient.patient_number || account.id;
}

function formatCurrency(value: number | string | null | undefined, currencyCode: string | null | undefined): string {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode || 'TZS',
        maximumFractionDigits: 2,
    }).format(Number(value ?? 0));
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

async function searchAccounts(force = false): Promise<void> {
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
        const response = await apiRequest<CashBillingListResponse>('/cash-patients', {
            q: query,
            status: props.status || null,
            page: 1,
            perPage: props.perPage,
        });
        searchResults.value = response.data ?? [];
    } catch (error) {
        if (isForbiddenError(error)) {
            accessDenied.value = true;
            accessDeniedMessage.value = 'Cash billing account lookup is restricted by permissions.';
            searchResults.value = [];
            return;
        }

        lookupError.value =
            error instanceof Error
                ? error.message
                : 'Unable to search cash billing accounts.';
        searchResults.value = [];
    } finally {
        searchLoading.value = false;
    }
}

async function hydrateSelected(id: string): Promise<void> {
    if (!id || accessDenied.value) {
        selectedAccount.value = null;
        emit('selected', null);
        return;
    }

    if (selectedAccount.value?.id === id) return;

    hydrateLoading.value = true;
    lookupError.value = null;

    try {
        const response = await apiRequest<CashBillingItemResponse>(`/cash-patients/${id}`);
        selectedAccount.value = response.data.account;
        emit('selected', response.data.account);
    } catch (error) {
        if (isForbiddenError(error)) {
            accessDenied.value = true;
            accessDeniedMessage.value = 'Cash billing account lookup is restricted by permissions.';
            emit('selected', null);
            return;
        }

        selectedAccount.value = null;
        lookupError.value =
            error instanceof Error
                ? error.message
                : 'Unable to load the selected cash billing account.';
        emit('selected', null);
    } finally {
        hydrateLoading.value = false;
    }
}

function selectAccount(account: CashBillingAccount): void {
    selectedAccount.value = account;
    searchResults.value = [];
    searchQuery.value = '';
    lookupError.value = null;
    open.value = false;
    emit('update:modelValue', account.id);
    emit('selected', account);
}

function clearSelection(): void {
    selectedAccount.value = null;
    searchResults.value = [];
    searchQuery.value = '';
    lookupError.value = null;
    emit('update:modelValue', '');
    emit('selected', null);
}

function handleSearchFocus(): void {
    open.value = true;
    if (searchQuery.value.trim().length >= 2) {
        void searchAccounts(true);
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
        void searchAccounts();
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
                Searching cash accounts...
            </div>

            <Alert v-else-if="lookupError" variant="destructive" class="m-1">
                <AlertDescription class="text-xs">
                    {{ lookupError }}
                </AlertDescription>
            </Alert>

            <template v-else-if="searchQuery.trim().length >= 2 && searchResults.length > 0">
                <button
                    v-for="account in searchResults"
                    :key="account.id"
                    type="button"
                    class="flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
                    @click="selectAccount(account)"
                >
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-medium">{{ patientDisplayName(account) }}</span>
                        <Badge v-if="account.patient?.patient_number" variant="outline">{{ account.patient.patient_number }}</Badge>
                        <Badge v-if="account.status" variant="secondary">{{ formatStatusLabel(account.status) }}</Badge>
                    </div>
                    <span class="text-xs text-muted-foreground">
                        Balance {{ formatCurrency(account.account_balance, account.currency_code) }}
                        <template v-if="account.patient?.phone">
                            | {{ account.patient.phone }}
                        </template>
                        <template v-if="account.currency_code">
                            | {{ account.currency_code }}
                        </template>
                    </span>
                </button>
            </template>

            <p v-else-if="searchQuery.trim().length === 1" class="px-3 py-3 text-xs text-muted-foreground">
                Type at least 2 characters to search cash accounts.
            </p>

            <p v-else-if="searchQuery.trim().length >= 2" class="px-3 py-3 text-xs text-muted-foreground">
                No cash accounts found. Try patient number, patient name, phone, or notes.
            </p>

            <p v-else class="px-3 py-3 text-xs text-muted-foreground">
                Search by patient number, patient name, phone, or notes.
            </p>
        </template>

        <template #footer>
            <p class="text-[11px] leading-relaxed text-muted-foreground">
                {{ quickSearchSummary }}
            </p>
        </template>
    </QuickLookupField>
</template>
