<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type LinkedResource = 'appointments' | 'admissions';

type AppointmentSummary = {
    id: string;
    appointmentNumber: string | null;
    patientId: string | null;
    department: string | null;
    scheduledAt: string | null;
    status: string | null;
};

type AdmissionSummary = {
    id: string;
    admissionNumber: string | null;
    patientId: string | null;
    ward: string | null;
    admittedAt: string | null;
    status: string | null;
};

type LinkedSummary = AppointmentSummary | AdmissionSummary;

type SearchResponse = {
    data: LinkedSummary[];
    meta?: { total?: number };
};

type ItemResponse = {
    data: LinkedSummary;
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
        patientId?: string;
        inputId: string;
        label: string;
        resource: LinkedResource;
        placeholder?: string;
        helperText?: string;
        errorMessage?: string | null;
        disabled?: boolean;
        status?: string;
        statuses?: string[];
        perPage?: number;
    }>(),
    {
        patientId: '',
        placeholder: 'Search and select from existing records',
        helperText: '',
        errorMessage: null,
        disabled: false,
        status: '',
        statuses: () => [],
        perPage: 10,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
    selected: [value: LinkedSummary | null];
}>();

const searchQuery = ref('');
const selectedRecord = ref<LinkedSummary | null>(null);
const searchResults = ref<LinkedSummary[]>([]);
const searchLoading = ref(false);
const hydrateLoading = ref(false);
const lookupError = ref<string | null>(null);
const accessDenied = ref(false);
const accessDeniedMessage = ref<string | null>(null);
let debounceTimer: number | null = null;

const patientIdTrimmed = computed(() => props.patientId.trim());
const normalizedStatuses = computed(() =>
    props.statuses
        .map((status) => status.trim().toLowerCase())
        .filter((status) => status !== ''),
);

function clearDebounce() {
    if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}

function isAppointment(record: LinkedSummary): record is AppointmentSummary {
    return props.resource === 'appointments';
}

function recordNumber(record: LinkedSummary): string {
    if (isAppointment(record)) {
        return record.appointmentNumber || record.id;
    }
    return record.admissionNumber || record.id;
}

function recordWhen(record: LinkedSummary): string | null {
    return isAppointment(record) ? record.scheduledAt : record.admittedAt;
}

function recordArea(record: LinkedSummary): string | null {
    return isAppointment(record) ? record.department : record.ward;
}

function recordPatientId(record: LinkedSummary): string | null {
    return record.patientId ?? null;
}

function recordStatus(record: LinkedSummary): string | null {
    return record.status ?? null;
}

function recordTypeLabel(): string {
    return props.resource === 'appointments' ? 'Appointment' : 'Admission';
}

function formatDateTime(value: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function selectedSummary(record: LinkedSummary): string {
    const parts: string[] = [];
    const area = recordArea(record);
    const when = formatDateTime(recordWhen(record));

    if (area) parts.push(area);
    if (when) parts.push(when);

    return parts.join(' | ');
}

async function apiRequest<T>(
    path: string,
    query?: Record<string, string | number | null | undefined>,
): Promise<T> {
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

    const payload = (await response
        .json()
        .catch(() => ({}))) as ValidationErrorResponse;

    if (!response.ok) {
        const error = new Error(
            payload.message ?? `${response.status} ${response.statusText}`,
        ) as ApiError;
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

function isForbiddenError(error: unknown): boolean {
    return (error as ApiError | undefined)?.status === 403;
}

function setAccessDeniedFallback() {
    accessDenied.value = true;
    accessDeniedMessage.value = `${recordTypeLabel()} lookup is restricted by permissions. Enter UUID manually.`;
    searchResults.value = [];
    searchLoading.value = false;
    hydrateLoading.value = false;
}

async function searchRecords(force = false) {
    if (accessDenied.value) return;

    const query = searchQuery.value.trim();
    const patientId = patientIdTrimmed.value;
    clearDebounce();

    if (!force && query.length < 2) {
        searchResults.value = [];
        lookupError.value = null;
        return;
    }

    if (force && query.length < 2 && !patientId) {
        searchResults.value = [];
        lookupError.value = `Select a patient or type at least 2 characters to search ${recordTypeLabel().toLowerCase()}s.`;
        return;
    }

    searchLoading.value = true;
    lookupError.value = null;

    try {
        const sortBy = props.resource === 'appointments' ? 'scheduledAt' : 'admittedAt';
        const statusQuery =
            normalizedStatuses.value.length === 1
                ? normalizedStatuses.value[0]
                : (props.status || null);
        const response = await apiRequest<SearchResponse>(`/${props.resource}`, {
            q: query || null,
            patientId: patientId || null,
            status: statusQuery,
            perPage: props.perPage,
            page: 1,
            sortBy,
            sortDir: 'desc',
        });
        const results = response.data ?? [];
        searchResults.value = normalizedStatuses.value.length === 0
            ? results
            : results.filter((record) =>
                normalizedStatuses.value.includes((recordStatus(record) ?? '').trim().toLowerCase()),
            );
    } catch (error) {
        if (isForbiddenError(error)) {
            setAccessDeniedFallback();
            return;
        }
        searchResults.value = [];
        lookupError.value =
            error instanceof Error
                ? error.message
                : `Unable to search ${recordTypeLabel().toLowerCase()}s.`;
    } finally {
        searchLoading.value = false;
    }
}

async function hydrateSelected(id: string) {
    if (!id) {
        selectedRecord.value = null;
        emit('selected', null);
        return;
    }

    if (selectedRecord.value?.id === id || accessDenied.value) return;

    hydrateLoading.value = true;
    lookupError.value = null;

    try {
        const response = await apiRequest<ItemResponse>(`/${props.resource}/${id}`);
        selectedRecord.value = response.data;
        emit('selected', response.data);
    } catch (error) {
        if (isForbiddenError(error)) {
            setAccessDeniedFallback();
            emit('selected', null);
            return;
        }
        selectedRecord.value = null;
        lookupError.value =
            error instanceof Error
                ? error.message
                : `Unable to load selected ${recordTypeLabel().toLowerCase()}.`;
        emit('selected', null);
    } finally {
        hydrateLoading.value = false;
    }
}

function selectRecord(record: LinkedSummary) {
    selectedRecord.value = record;
    searchResults.value = [];
    searchQuery.value = '';
    lookupError.value = null;
    emit('update:modelValue', record.id);
    emit('selected', record);
}

function clearSelection() {
    selectedRecord.value = null;
    searchResults.value = [];
    searchQuery.value = '';
    lookupError.value = null;
    emit('update:modelValue', '');
    emit('selected', null);
}

function updateManualInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    emit('update:modelValue', target?.value ?? '');
}

watch(
    () => props.modelValue,
    (value) => {
        const id = value.trim();
        if (!id) {
            selectedRecord.value = null;
            emit('selected', null);
            return;
        }
        void hydrateSelected(id);
    },
    { immediate: true },
);

watch(
    () => patientIdTrimmed.value,
    (newPatientId, previousPatientId) => {
        if (newPatientId === previousPatientId) return;
        const selectedPatientId = selectedRecord.value
            ? recordPatientId(selectedRecord.value)
            : null;
        if (
            selectedPatientId &&
            newPatientId &&
            selectedPatientId !== newPatientId
        ) {
            clearSelection();
        }
    },
);

watch(searchQuery, (value, previousValue) => {
    if (value.trim() === (previousValue ?? '').trim()) return;
    clearDebounce();
    debounceTimer = window.setTimeout(() => {
        void searchRecords(false);
        debounceTimer = null;
    }, 300);
});

onBeforeUnmount(clearDebounce);
</script>

<template>
    <FormFieldShell
        :input-id="inputId"
        :label="label"
        :helper-text="helperText"
        :error-message="errorMessage"
    >
        <template v-if="accessDenied">
            <div class="flex flex-nowrap items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-xs focus-within:ring-2 focus-within:ring-ring/50 focus-within:ring-offset-0">
                <Input
                    :id="inputId"
                    :value="modelValue"
                    :placeholder="`Enter ${recordTypeLabel()} UUID`"
                    :disabled="disabled"
                    class="min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    autocomplete="off"
                    @input="updateManualInput"
                />
                <Button
                    v-if="modelValue"
                    type="button"
                    variant="outline"
                    size="sm"
                    class="h-9 shrink-0 rounded-none border-0 border-l border-input bg-muted/50 px-3 hover:bg-muted"
                    :disabled="disabled"
                    @click="clearSelection"
                >
                    Clear
                </Button>
            </div>
            <Alert>
                <AlertDescription class="text-xs">
                    {{ accessDeniedMessage }}
                </AlertDescription>
            </Alert>
        </template>
        <template v-else>
            <div class="flex flex-nowrap items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-xs focus-within:ring-2 focus-within:ring-ring/50 focus-within:ring-offset-0">
                <span class="flex h-9 shrink-0 items-center border-0 border-r border-input bg-muted/30 pl-3 pr-2 text-muted-foreground">
                    <AppIcon name="search" class="size-4" aria-hidden />
                </span>
                <Input
                    :id="inputId"
                    v-model="searchQuery"
                    :placeholder="placeholder"
                    :disabled="disabled"
                    class="min-w-0 flex-1 rounded-none border-0 bg-transparent py-2 pl-2 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                    autocomplete="off"
                    @keyup.enter="searchRecords(true)"
                />
                <Button
                    v-if="modelValue"
                    type="button"
                    variant="outline"
                    size="sm"
                    class="h-9 shrink-0 rounded-none border-0 border-l border-input bg-muted/50 px-3 hover:bg-muted"
                    :disabled="disabled"
                    @click="clearSelection"
                >
                    Clear
                </Button>
            </div>

            <Alert v-if="lookupError" variant="destructive">
                <AlertDescription class="text-xs">{{ lookupError }}</AlertDescription>
            </Alert>

            <div v-if="selectedRecord" class="rounded-lg border p-2">
                <div class="flex flex-wrap items-center gap-2">
                    <p class="text-sm font-medium">{{ recordNumber(selectedRecord) }}</p>
                    <Badge variant="outline">{{ recordTypeLabel() }}</Badge>
                    <Badge v-if="recordStatus(selectedRecord)" variant="secondary">
                        {{ recordStatus(selectedRecord) }}
                    </Badge>
                    <span v-if="hydrateLoading" class="text-xs text-muted-foreground">
                        Loading...
                    </span>
                </div>
                <p v-if="selectedSummary(selectedRecord)" class="mt-1 text-xs text-muted-foreground">
                    {{ selectedSummary(selectedRecord) }}
                </p>
                <p class="mt-1 text-xs text-muted-foreground">UUID: {{ modelValue }}</p>
            </div>

            <div v-if="searchResults.length > 0" class="max-h-56 overflow-y-auto rounded-lg border">
                <button
                    v-for="item in searchResults"
                    :key="item.id"
                    type="button"
                    class="flex w-full flex-col items-start gap-1 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
                    @click="selectRecord(item)"
                >
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="font-medium">{{ recordNumber(item) }}</span>
                        <Badge variant="outline">{{ recordTypeLabel() }}</Badge>
                        <Badge v-if="recordStatus(item)" variant="secondary">
                            {{ recordStatus(item) }}
                        </Badge>
                    </div>
                    <span class="text-xs text-muted-foreground">
                        <template v-if="selectedSummary(item)">{{ selectedSummary(item) }}</template>
                        <template v-else>{{ item.id }}</template>
                    </span>
                </button>
            </div>

            <p
                v-else-if="searchQuery.trim().length >= 2 && !searchLoading && !lookupError"
                class="text-xs text-muted-foreground"
            >
                No {{ recordTypeLabel().toLowerCase() }}s found for this search.
            </p>
        </template>
    </FormFieldShell>
</template>
