<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import AdvancedSearchDialog from '@/components/lookup/AdvancedSearchDialog.vue';
import QuickLookupField from '@/components/lookup/QuickLookupField.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type PatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    status?: string | null;
    phone?: string | null;
    email?: string | null;
    nationalId?: string | null;
    region?: string | null;
    district?: string | null;
};

type PatientListMeta = {
    currentPage?: number;
    perPage?: number;
    total?: number;
    lastPage?: number;
};

type PatientListResponse = {
    data: PatientSummary[];
    meta?: PatientListMeta;
};

type PatientResponse = {
    data: PatientSummary;
};

type ValidationErrorResponse = {
    message?: string;
};

type ApiError = Error & {
    status?: number;
    payload?: ValidationErrorResponse;
};

const RECENT_SEARCHES_KEY = 'patient-lookup.recent-searches.v1';
const RECENT_PATIENTS_KEY = 'patient-lookup.recent-patients.v1';
const RECENT_SEARCH_LIMIT = 6;
const RECENT_PATIENT_LIMIT = 6;

const props = withDefaults(
    defineProps<{
        modelValue: string;
        inputId: string;
        label: string;
        placeholder?: string;
        helperText?: string;
        errorMessage?: string | null;
        disabled?: boolean;
        patientStatus?: string;
        perPage?: number;
        mode?: 'default' | 'filter';
        openOnFocus?: boolean | null;
    }>(),
    {
        placeholder: 'Search patient by number, name, phone, email, or national ID',
        helperText: 'Search by patient number, name, phone, email, or national ID.',
        errorMessage: null,
        disabled: false,
        patientStatus: '',
        perPage: 10,
        mode: 'default',
        openOnFocus: null,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
    selected: [patient: PatientSummary | null];
}>();

const searchQuery = ref('');
const selectedPatient = ref<PatientSummary | null>(null);
const searchResults = ref<PatientSummary[]>([]);
const searchLoading = ref(false);
const hydrateLoading = ref(false);
const lookupError = ref<string | null>(null);
const accessDenied = ref(false);
const accessDeniedMessage = ref<string | null>(null);
const open = ref(false);
const advancedSearchOpen = ref(false);
const recentSearches = ref<string[]>([]);
const recentPatients = ref<PatientSummary[]>([]);
const searchResultCount = ref(0);
const advancedSearchResults = ref<PatientSummary[]>([]);
const advancedSearchMeta = ref<PatientListMeta | null>(null);
const advancedSearchLoading = ref(false);
const advancedSearchPage = ref(1);
const advancedSearchPerPage = computed(() => Math.max(props.perPage, 10));
const hasLockedPatientStatus = computed(() => props.patientStatus.trim().length > 0);
let debounceTimer: number | null = null;
let suppressSearchWatch = false;
const isFilterMode = computed(() => props.mode === 'filter');
const shouldOpenOnFocus = computed(() => props.openOnFocus ?? !isFilterMode.value);

function clearDebounce() {
    if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}

function patientDisplayName(patient: PatientSummary): string {
    const fullName = [patient.firstName, patient.middleName, patient.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();

    return fullName || patient.patientNumber || patient.id;
}

function patientInitials(patient: PatientSummary): string {
    const parts = patientDisplayName(patient)
        .split(/\s+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 2);

    if (parts.length === 0) {
        return 'PT';
    }

    return parts
        .map((part) => part.charAt(0).toUpperCase())
        .join('');
}

function patientContactSummary(patient: PatientSummary): string | null {
    const parts: string[] = [];

    if (patient.phone) {
        parts.push(`Phone ${patient.phone}`);
    }

    if (patient.email) {
        parts.push(patient.email);
    }

    if (patient.nationalId) {
        parts.push(`ID ${patient.nationalId}`);
    }

    return parts.length > 0 ? parts.join(' | ') : null;
}

function patientMatchSummary(patient: PatientSummary): string {
    const tags = patientMatchTags(patient);
    return tags.length > 0 ? `${tags.join(' | ')} match` : 'General match';
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

function ageFromDateOfBirth(value: string | null | undefined): number | null {
    if (!value) return null;

    const dob = new Date(value);
    if (Number.isNaN(dob.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    const dayDiff = today.getDate() - dob.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age -= 1;
    }

    return age >= 0 ? age : null;
}

function patientDemographics(patient: PatientSummary): string | null {
    const parts: string[] = [];

    if (patient.gender) {
        parts.push(patient.gender);
    }

    const dob = formatDate(patient.dateOfBirth);
    const age = ageFromDateOfBirth(patient.dateOfBirth);
    if (dob && age !== null) {
        parts.push(`${dob} (${age}y)`);
    } else if (dob) {
        parts.push(dob);
    }

    return parts.length > 0 ? parts.join(' | ') : null;
}

function patientLocation(patient: PatientSummary): string | null {
    const parts = [patient.district, patient.region].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
}

function patientAgeLabel(patient: PatientSummary): string | null {
    const age = ageFromDateOfBirth(patient.dateOfBirth);
    return age !== null ? `${age}y` : null;
}

function patientDirectoryProfileSummary(patient: PatientSummary): string {
    const parts = [
        patient.gender ?? null,
        patientAgeLabel(patient),
        patientLocation(patient),
    ].filter((value): value is string => Boolean(value));

    return parts.length > 0 ? parts.join(' | ') : 'No gender, age, or address recorded';
}

function normalizeLookupValue(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function sanitizePatientSummary(patient: PatientSummary): PatientSummary {
    return {
        id: patient.id,
        patientNumber: patient.patientNumber ?? null,
        firstName: patient.firstName ?? null,
        middleName: patient.middleName ?? null,
        lastName: patient.lastName ?? null,
        gender: patient.gender ?? null,
        dateOfBirth: patient.dateOfBirth ?? null,
        status: patient.status ?? null,
        phone: patient.phone ?? null,
        email: patient.email ?? null,
        nationalId: patient.nationalId ?? null,
        region: patient.region ?? null,
        district: patient.district ?? null,
    };
}

function loadRecentLookupActivity() {
    if (typeof window === 'undefined') return;

    try {
        const storedSearches = JSON.parse(
            window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]',
        );
        recentSearches.value = Array.isArray(storedSearches)
            ? storedSearches
                  .filter((value): value is string => typeof value === 'string')
                  .map((value) => value.trim())
                  .filter(Boolean)
                  .slice(0, RECENT_SEARCH_LIMIT)
            : [];
    } catch {
        recentSearches.value = [];
    }

    try {
        const storedPatients = JSON.parse(
            window.localStorage.getItem(RECENT_PATIENTS_KEY) ?? '[]',
        );
        recentPatients.value = Array.isArray(storedPatients)
            ? storedPatients
                  .filter(
                      (value): value is PatientSummary =>
                          Boolean(value) &&
                          typeof value === 'object' &&
                          typeof (value as PatientSummary).id === 'string',
                  )
                  .map((patient) => sanitizePatientSummary(patient))
                  .slice(0, RECENT_PATIENT_LIMIT)
            : [];
    } catch {
        recentPatients.value = [];
    }
}

function persistRecentSearches() {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(recentSearches.value.slice(0, RECENT_SEARCH_LIMIT)),
    );
}

function persistRecentPatients() {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(
        RECENT_PATIENTS_KEY,
        JSON.stringify(recentPatients.value.slice(0, RECENT_PATIENT_LIMIT)),
    );
}

function rememberSearchQuery(value: string) {
    const normalized = value.trim();
    if (normalized.length < 2) return;

    recentSearches.value = [
        normalized,
        ...recentSearches.value.filter(
            (entry) => normalizeLookupValue(entry) !== normalizeLookupValue(normalized),
        ),
    ].slice(0, RECENT_SEARCH_LIMIT);
    persistRecentSearches();
}

function rememberPatient(patient: PatientSummary) {
    const normalized = sanitizePatientSummary(patient);

    recentPatients.value = [
        normalized,
        ...recentPatients.value.filter((entry) => entry.id !== normalized.id),
    ].slice(0, RECENT_PATIENT_LIMIT);
    persistRecentPatients();
}

function patientFullName(patient: PatientSummary): string {
    return [patient.firstName, patient.middleName, patient.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
}

function patientMatchTags(patient: PatientSummary): string[] {
    const query = normalizeLookupValue(searchQuery.value);
    if (!query) return [];

    const tags: string[] = [];

    const checks = [
        { label: 'Patient no.', value: patient.patientNumber },
        { label: 'Phone', value: patient.phone },
        { label: 'Email', value: patient.email },
        { label: 'National ID', value: patient.nationalId },
    ];

    for (const check of checks) {
        if (!normalizeLookupValue(check.value).includes(query)) continue;
        tags.push(check.label);
    }

    if (normalizeLookupValue(patientFullName(patient)).includes(query)) {
        tags.push('Name');
    }

    return Array.from(new Set(tags)).slice(0, 2);
}

function patientSearchScore(patient: PatientSummary): number {
    const query = normalizeLookupValue(searchQuery.value);
    if (!query) return 0;

    const patientNumber = normalizeLookupValue(patient.patientNumber);
    const phone = normalizeLookupValue(patient.phone);
    const email = normalizeLookupValue(patient.email);
    const nationalId = normalizeLookupValue(patient.nationalId);
    const fullName = normalizeLookupValue(patientFullName(patient));

    if (patientNumber === query) return 500;
    if (phone === query) return 450;
    if (nationalId === query) return 425;
    if (email === query) return 400;
    if (fullName === query) return 350;
    if (patientNumber.startsWith(query)) return 300;
    if (fullName.startsWith(query)) return 250;
    if (phone.includes(query)) return 200;
    if (nationalId.includes(query)) return 190;
    if (email.includes(query)) return 180;
    if (fullName.includes(query)) return 150;

    return 0;
}

const rankedSearchResults = computed(() =>
    [...searchResults.value].sort((left, right) => {
        const scoreDifference = patientSearchScore(right) - patientSearchScore(left);
        if (scoreDifference !== 0) return scoreDifference;

        return patientDisplayName(left).localeCompare(patientDisplayName(right));
    }),
);

const quickSearchResults = computed(() => rankedSearchResults.value.slice(0, 6));

const quickSearchSummary = computed(() => {
    const query = searchQuery.value.trim();

    if (query.length < 2) {
        return 'Recent patients stay here. Use advanced search for a wider result view.';
    }

    if (searchResultCount.value > quickSearchResults.value.length) {
        return `Showing top ${quickSearchResults.value.length} of ${searchResultCount.value} matches.`;
    }

    if (searchResultCount.value > 0) {
        return `${searchResultCount.value} match${searchResultCount.value === 1 ? '' : 'es'} found.`;
    }

    return 'No match yet. Open advanced search for a wider review.';
});

const advancedSearchResultCount = computed(() =>
    Number(advancedSearchMeta.value?.total ?? advancedSearchResults.value.length),
);

const advancedSearchPageLabel = computed(() => {
    const currentPage = Number(advancedSearchMeta.value?.currentPage ?? advancedSearchPage.value ?? 1);
    const lastPage = Number(advancedSearchMeta.value?.lastPage ?? 1);

    return `Page ${currentPage} of ${lastPage}`;
});

const selectedDisplay = computed(() => {
    if (!selectedPatient.value) return null;

    return {
        title: patientDisplayName(selectedPatient.value),
        patientNumber: selectedPatient.value.patientNumber,
        demographics: patientDemographics(selectedPatient.value),
        location: patientLocation(selectedPatient.value),
        phone: selectedPatient.value.phone ?? null,
        email: selectedPatient.value.email ?? null,
        nationalId: selectedPatient.value.nationalId ?? null,
        status: selectedPatient.value.status ?? null,
    };
});

const hasSelection = computed(() => Boolean(props.modelValue.trim() || selectedPatient.value));

async function apiRequest<T>(
    method: 'GET',
    path: string,
    query?: Record<string, string | number | null | undefined>,
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);

    Object.entries(query ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), {
        method,
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
    accessDeniedMessage.value =
        'Patient lookup is restricted by permissions. Enter patient UUID manually.';
    searchResults.value = [];
    searchResultCount.value = 0;
    advancedSearchResults.value = [];
    advancedSearchMeta.value = null;
    advancedSearchLoading.value = false;
    advancedSearchPage.value = 1;
    searchLoading.value = false;
    hydrateLoading.value = false;
    open.value = false;
}

function updateManualInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    emit('update:modelValue', target?.value ?? '');
}

async function searchPatients() {
    if (accessDenied.value) return;

    const query = searchQuery.value.trim();
    clearDebounce();

    if (query.length < 2) {
        searchResults.value = [];
        searchResultCount.value = 0;
        lookupError.value = null;
        return;
    }

    searchLoading.value = true;
    lookupError.value = null;
    if (!advancedSearchOpen.value) {
        open.value = true;
    }

    try {
        const response = await apiRequest<PatientListResponse>(
            'GET',
            '/patients',
            {
                q: query,
                status: props.patientStatus || null,
                perPage: props.perPage,
                page: 1,
            },
        );
        searchResults.value = response.data ?? [];
        searchResultCount.value = Number(
            response.meta?.total ?? response.data?.length ?? 0,
        );
    } catch (error) {
        if (isForbiddenError(error)) {
            setAccessDeniedFallback();
            return;
        }
        searchResults.value = [];
        searchResultCount.value = 0;
        lookupError.value =
            error instanceof Error
                ? error.message
                : 'Unable to search patients.';
    } finally {
        searchLoading.value = false;
    }
}

async function searchAdvancedPatients(page = 1) {
    if (accessDenied.value) return;

    const query = searchQuery.value.trim();
    clearDebounce();
    lookupError.value = null;
    open.value = false;

    if (query.length === 1) {
        advancedSearchResults.value = [];
        advancedSearchMeta.value = {
            currentPage: 1,
            perPage: advancedSearchPerPage.value,
            total: 0,
            lastPage: 1,
        };
        advancedSearchPage.value = 1;
        return;
    }

    advancedSearchLoading.value = true;

    try {
        const response = await apiRequest<PatientListResponse>(
            'GET',
            '/patients',
            {
                q: query || null,
                status: hasLockedPatientStatus.value ? props.patientStatus.trim() : null,
                perPage: advancedSearchPerPage.value,
                page,
            },
        );
        advancedSearchResults.value = response.data ?? [];
        advancedSearchMeta.value = {
            currentPage: Number(response.meta?.currentPage ?? page),
            perPage: Number(response.meta?.perPage ?? advancedSearchPerPage.value),
            total: Number(response.meta?.total ?? response.data?.length ?? 0),
            lastPage: Number(response.meta?.lastPage ?? 1),
        };
        advancedSearchPage.value = Number(response.meta?.currentPage ?? page);
    } catch (error) {
        if (isForbiddenError(error)) {
            setAccessDeniedFallback();
            return;
        }
        advancedSearchResults.value = [];
        advancedSearchMeta.value = null;
        lookupError.value =
            error instanceof Error
                ? error.message
                : 'Unable to search patients.';
    } finally {
        advancedSearchLoading.value = false;
    }
}

function goToAdvancedSearchPage(page: number) {
    if (advancedSearchLoading.value) return;
    if (page < 1) return;

    void searchAdvancedPatients(page);
}


async function hydrateSelectedPatient(patientId: string) {
    if (!patientId) {
        selectedPatient.value = null;
        emit('selected', null);
        return;
    }

    if (selectedPatient.value?.id === patientId || accessDenied.value) return;

    hydrateLoading.value = true;
    lookupError.value = null;

    try {
        const response = await apiRequest<PatientResponse>(
            'GET',
            `/patients/${patientId}`,
        );
        selectedPatient.value = response.data;
        emit('selected', response.data);
    } catch (error) {
        if (isForbiddenError(error)) {
            setAccessDeniedFallback();
            emit('selected', null);
            return;
        }
        selectedPatient.value = null;
        lookupError.value =
            error instanceof Error
                ? error.message
                : 'Unable to load selected patient.';
        emit('selected', null);
    } finally {
        hydrateLoading.value = false;
    }
}

function selectPatient(patient: PatientSummary) {
    const recentQuery = searchQuery.value.trim();
    suppressSearchWatch = true;
    selectedPatient.value = patient;
    searchResults.value = [];
    searchResultCount.value = 0;
    advancedSearchResults.value = [];
    advancedSearchMeta.value = null;
    advancedSearchPage.value = 1;
    searchQuery.value = '';
    lookupError.value = null;
    open.value = false;
    advancedSearchOpen.value = false;
    rememberPatient(patient);
    rememberSearchQuery(recentQuery);
    window.setTimeout(() => {
        suppressSearchWatch = false;
    }, 0);
    emit('update:modelValue', patient.id);
    emit('selected', patient);
}

function clearSelection() {
    suppressSearchWatch = true;
    selectedPatient.value = null;
    searchResults.value = [];
    searchResultCount.value = 0;
    advancedSearchResults.value = [];
    advancedSearchMeta.value = null;
    advancedSearchPage.value = 1;
    searchQuery.value = '';
    lookupError.value = null;
    open.value = false;
    window.setTimeout(() => {
        suppressSearchWatch = false;
    }, 0);
    emit('update:modelValue', '');
    emit('selected', null);
}

function applyRecentSearch(value: string) {
    searchQuery.value = value;
    lookupError.value = null;
    if (!advancedSearchOpen.value) {
        open.value = true;
    }
}

function handleSearchFocus() {
    if (props.disabled || accessDenied.value) return;

    lookupError.value = null;
    if (!shouldOpenOnFocus.value) return;

    open.value = true;

    if (searchQuery.value.trim().length >= 2 && searchResults.value.length === 0 && !searchLoading.value) {
        void searchPatients();
    }
}

function openAdvancedSearch() {
    advancedSearchPage.value = 1;
    lookupError.value = null;
    advancedSearchOpen.value = true;
    open.value = false;
}

watch(
    () => props.modelValue,
    (value) => {
        const patientId = value.trim();
        if (!patientId) {
            selectedPatient.value = null;
            emit('selected', null);
            return;
        }

        void hydrateSelectedPatient(patientId);
    },
    { immediate: true },
);


watch(searchQuery, (value, previousValue) => {
    if (suppressSearchWatch) return;
    if (value.trim() === (previousValue ?? '').trim()) return;

    clearDebounce();

    if (advancedSearchOpen.value) {
        open.value = false;
        debounceTimer = window.setTimeout(() => {
            advancedSearchPage.value = 1;
            void searchAdvancedPatients(1);
            debounceTimer = null;
        }, 300);
        return;
    }

    open.value = true;
    debounceTimer = window.setTimeout(() => {
        void searchPatients();
        debounceTimer = null;
    }, 300);
});

watch(advancedSearchOpen, (value) => {
    if (value) {
        open.value = false;
        void searchAdvancedPatients(advancedSearchPage.value);
        return;
    }

    advancedSearchResults.value = [];
    advancedSearchMeta.value = null;
    advancedSearchPage.value = 1;
});

onMounted(loadRecentLookupActivity);
onBeforeUnmount(clearDebounce);
</script>

<template>
    <div class="grid gap-2">
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
            :open-on-focus="shouldOpenOnFocus"
            :access-denied="accessDenied"
            :access-denied-message="accessDeniedMessage"
            @update:open="open = $event"
            @update:query="searchQuery = $event"
            @focus="handleSearchFocus"
            @clear="clearSelection"
        >
            <template #access-denied>
                <div class="space-y-2">
                    <div class="flex flex-nowrap items-stretch overflow-hidden rounded-lg border border-input bg-transparent shadow-xs focus-within:ring-2 focus-within:ring-ring/50 focus-within:ring-offset-0">
                        <span class="flex h-8 shrink-0 items-center border-0 border-r border-input bg-muted/30 pl-3 pr-2 text-muted-foreground">
                            <AppIcon name="search" class="size-4" aria-hidden />
                        </span>
                        <Input
                            :id="inputId"
                            :value="modelValue"
                            placeholder="Enter patient UUID"
                            class="h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent py-1.5 pl-2 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            :disabled="disabled"
                            autocomplete="off"
                            @input="updateManualInput"
                        />
                        <Button
                            v-if="modelValue"
                            type="button"
                            variant="outline"
                            size="sm"
                            class="h-8 shrink-0 rounded-none border-0 border-l border-input bg-muted/50 px-3 hover:bg-muted"
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
                </div>
            </template>

            <template #results>
                <div
                    v-if="searchLoading || hydrateLoading"
                    class="px-3 py-3 text-xs text-muted-foreground"
                >
                    Searching patients...
                </div>

                <Alert
                    v-else-if="lookupError"
                    variant="destructive"
                    class="m-1"
                >
                    <AlertDescription class="text-xs">
                        {{ lookupError }}
                    </AlertDescription>
                </Alert>

                <template v-else-if="searchQuery.trim().length === 0">
                    <div v-if="recentPatients.length > 0" class="space-y-1">
                        <p class="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Recent patients
                        </p>
                        <button
                            v-for="patient in recentPatients"
                            :key="`recent-patient-${patient.id}`"
                            type="button"
                            class="flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
                            @click="selectPatient(patient)"
                        >
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="font-medium">
                                    {{ patientDisplayName(patient) }}
                                </span>
                                <Badge v-if="patient.patientNumber" variant="outline">
                                    {{ patient.patientNumber }}
                                </Badge>
                                <Badge v-if="patient.status" variant="secondary">
                                    {{ patient.status }}
                                </Badge>
                            </div>
                            <span class="text-xs text-muted-foreground">
                                <template v-if="patientDemographics(patient)">
                                    {{ patientDemographics(patient) }}
                                </template>
                                <template v-if="patientDemographics(patient) && patient.phone">
                                    |
                                </template>
                                <template v-if="patient.phone">
                                    Phone: {{ patient.phone }}
                                </template>
                            </span>
                        </button>
                    </div>

                    <div
                        v-if="recentSearches.length > 0"
                        class="border-t px-3 py-3"
                    >
                        <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Recent searches
                        </p>
                        <div class="mt-2 flex flex-wrap gap-2">
                            <Button
                                v-for="entry in recentSearches"
                                :key="`recent-search-${entry}`"
                                type="button"
                                size="sm"
                                variant="outline"
                                class="h-7 px-2 text-xs"
                                @click="applyRecentSearch(entry)"
                            >
                                {{ entry }}
                            </Button>
                        </div>
                    </div>

                    <p
                        v-if="recentPatients.length === 0 && recentSearches.length === 0"
                        class="px-3 py-3 text-xs text-muted-foreground"
                    >
                        Start typing to search. Recent patients and recent searches will appear here.
                    </p>
                </template>

                <template v-else-if="quickSearchResults.length > 0">
                    <button
                        v-for="patient in quickSearchResults"
                        :key="`quick-patient-${patient.id}`"
                        type="button"
                        class="flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
                        @click="selectPatient(patient)"
                    >
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="font-medium">
                                {{ patientDisplayName(patient) }}
                            </span>
                            <Badge v-if="patient.patientNumber" variant="outline">
                                {{ patient.patientNumber }}
                            </Badge>
                            <Badge v-if="patient.status" variant="secondary">
                                {{ patient.status }}
                            </Badge>
                            <Badge
                                v-for="tag in patientMatchTags(patient)"
                                :key="`${patient.id}-${tag}`"
                                variant="secondary"
                                class="text-[10px]"
                            >
                                {{ tag }} match
                            </Badge>
                        </div>
                        <span class="text-xs text-muted-foreground">
                            <template v-if="patientDemographics(patient)">
                                {{ patientDemographics(patient) }}
                            </template>
                            <template v-if="patientDemographics(patient) && patient.phone">
                                |
                            </template>
                            <template v-if="patient.phone">
                                Phone: {{ patient.phone }}
                            </template>
                            <template
                                v-if="(patientDemographics(patient) || patient.phone) && patientLocation(patient)"
                            >
                                |
                            </template>
                            <template v-if="patientLocation(patient)">
                                {{ patientLocation(patient) }}
                            </template>
                        </span>
                        <span
                            v-if="patient.email || patient.nationalId"
                            class="text-xs text-muted-foreground"
                        >
                            <template v-if="patient.email">
                                Email: {{ patient.email }}
                            </template>
                            <template v-if="patient.email && patient.nationalId">
                                |
                            </template>
                            <template v-if="patient.nationalId">
                                National ID: {{ patient.nationalId }}
                            </template>
                        </span>
                    </button>
                </template>

                <p
                    v-else-if="searchQuery.trim().length === 1"
                    class="px-3 py-3 text-xs text-muted-foreground"
                >
                    Type at least 2 characters to search.
                </p>

                <p
                    v-else
                    class="px-3 py-3 text-xs text-muted-foreground"
                >
                    No patients found. Try patient number, name, phone, email, or national ID.
                </p>
            </template>

            <template #footer>
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <p class="text-[11px] leading-relaxed text-muted-foreground">
                        {{ quickSearchSummary }}
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        class="h-8 shrink-0 gap-1.5 rounded-lg px-3 text-xs"
                        :disabled="disabled"
                        @click="openAdvancedSearch"
                    >
                        <AppIcon name="search" class="size-3.5" />
                        Advanced search
                    </Button>
                </div>
            </template>
        </QuickLookupField>

        <AdvancedSearchDialog
            :open="advancedSearchOpen"
            title="Advanced patient search"
            description="Search the patient directory, filter quickly, and select the right chart."
            :search-input-id="`${inputId}-advanced`"
            search-label="Search patients"
            search-placeholder="Search by number, name, phone, email, or national ID"
            :query="searchQuery"
            :error-message="lookupError"
            content-class="sm:max-w-6xl"
            plain-results
            @update:open="advancedSearchOpen = $event"
            @update:query="searchQuery = $event"
        >
            <template v-if="advancedSearchLoading">
                <div class="space-y-2">
                    <div
                        v-for="n in 4"
                        :key="`advanced-patient-table-skeleton-${n}`"
                        class="rounded-md border px-3 py-2"
                    >
                        <div class="grid gap-2 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_5.5rem_4.5rem] md:items-center">
                            <Skeleton class="h-4 w-36" />
                            <Skeleton class="h-4 w-32" />
                            <Skeleton class="h-4 w-16" />
                            <Skeleton class="ml-auto h-8 w-14" />
                        </div>
                    </div>
                </div>
            </template>

            <template v-else>
                <div class="space-y-2">
                    <div class="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                        <span class="font-medium text-foreground/80">Patient directory</span>
                        <span>
                            <template v-if="searchQuery.trim().length > 0">
                                {{ advancedSearchResultCount }} match{{ advancedSearchResultCount === 1 ? '' : 'es' }}
                            </template>
                            <template v-else>
                                Browsing all available patients
                            </template>
                            &middot; {{ advancedSearchPageLabel }}
                        </span>
                    </div>

                    <p v-if="hasLockedPatientStatus" class="px-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Scoped to {{ props.patientStatus.trim() }} patients for this workflow.
                    </p>

                    <p
                        v-if="searchQuery.trim().length === 1"
                        class="rounded-md border border-dashed bg-muted/10 px-2.5 py-2.5 text-sm text-muted-foreground"
                    >
                        Type at least 2 characters to search, or clear the query to browse the directory.
                    </p>

                    <div v-else-if="advancedSearchResults.length > 0" class="overflow-x-auto rounded-md border bg-background">
                        <table class="min-w-full table-fixed text-[12px]">
                            <thead class="border-b bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th class="w-[34%] px-1.5 py-1 text-left font-medium">Patient</th>
                                    <th class="w-[42%] px-1.5 py-1 text-left font-medium">Profile</th>
                                    <th class="w-[12%] px-1.5 py-1 text-left font-medium">Status</th>
                                    <th class="w-[12%] px-1.5 py-1 text-right font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="patient in advancedSearchResults"
                                    :key="`advanced-result-${patient.id}`"
                                    class="border-b align-middle last:border-b-0"
                                >
                                    <td class="px-1.5 py-0.5">
                                        <div class="flex min-w-0 items-center gap-1 whitespace-nowrap">
                                            <span class="truncate font-medium text-foreground" :title="patientDisplayName(patient)">
                                                {{ patientDisplayName(patient) }}
                                            </span>
                                            <Badge v-if="patient.patientNumber" variant="outline" class="h-4 shrink-0 px-1.5 text-[10px]">
                                                {{ patient.patientNumber }}
                                            </Badge>
                                        </div>
                                    </td>
                                    <td class="px-1.5 py-0.5 text-[12px] text-muted-foreground">
                                        <div class="flex min-w-0 items-center gap-1 whitespace-nowrap" :title="patientDirectoryProfileSummary(patient)">
                                            <Badge v-if="patient.gender" variant="secondary" class="h-4 shrink-0 px-1.5 text-[10px]">
                                                {{ patient.gender }}
                                            </Badge>
                                            <Badge v-if="patientAgeLabel(patient)" variant="outline" class="h-4 shrink-0 px-1.5 text-[10px]">
                                                {{ patientAgeLabel(patient) }}
                                            </Badge>
                                            <span v-if="patientLocation(patient)" class="truncate text-[11px]">
                                                {{ patientLocation(patient) }}
                                            </span>
                                            <span v-else class="truncate text-[11px]">
                                                No address recorded
                                            </span>
                                        </div>
                                    </td>
                                    <td class="px-1.5 py-0.5 whitespace-nowrap">
                                        <Badge v-if="patient.status" variant="secondary" class="h-4 px-1.5 text-[10px]">
                                            {{ patient.status }}
                                        </Badge>
                                        <span v-else class="text-xs text-muted-foreground">No status</span>
                                    </td>
                                    <td class="px-1.5 py-0.5 text-right whitespace-nowrap">
                                        <Button type="button" size="sm" variant="outline" class="h-6 px-2 text-[11px]" @click="selectPatient(patient)">
                                            Select
                                        </Button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <p
                        v-else
                        class="rounded-md border border-dashed bg-muted/10 px-2.5 py-3 text-sm text-muted-foreground"
                    >
                        <template v-if="searchQuery.trim().length > 0">
                            No patients found. Refine the search or clear it to browse the directory.
                        </template>
                        <template v-else>
                            No patients are available in the directory right now.
                        </template>
                    </p>

                    <div class="flex flex-wrap items-center justify-between gap-2 border-t pt-1.5">
                        <p class="text-[11px] text-muted-foreground">
                            {{ advancedSearchResultCount }} total patient{{ advancedSearchResultCount === 1 ? '' : 's' }} in this result set.
                        </p>

                        <div class="flex items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                class="h-7 px-2.5 text-xs"
                                :disabled="advancedSearchLoading || (advancedSearchMeta?.currentPage ?? advancedSearchPage) <= 1"
                                @click="goToAdvancedSearchPage((advancedSearchMeta?.currentPage ?? advancedSearchPage) - 1)"
                            >
                                Previous
                            </Button>
                            <p class="text-[11px] text-muted-foreground">
                                {{ advancedSearchPageLabel }}
                            </p>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                class="h-7 px-2.5 text-xs"
                                :disabled="advancedSearchLoading || !advancedSearchMeta || (advancedSearchMeta.currentPage ?? advancedSearchPage) >= (advancedSearchMeta.lastPage ?? 1)"
                                @click="goToAdvancedSearchPage((advancedSearchMeta?.currentPage ?? advancedSearchPage) + 1)"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            </template>
        </AdvancedSearchDialog>

        <div
            v-if="selectedDisplay"
            :class="
                isFilterMode
                    ? 'rounded-lg border bg-muted/20 p-2'
                    : 'rounded-lg border p-2'
            "
        >
            <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-medium">
                    {{ selectedDisplay.title }}
                </p>
                <Badge v-if="selectedDisplay.patientNumber" variant="outline">
                    {{ selectedDisplay.patientNumber }}
                </Badge>
                <Badge v-if="selectedDisplay.status" variant="secondary">
                    {{ selectedDisplay.status }}
                </Badge>
                <span
                    v-if="hydrateLoading"
                    class="text-xs text-muted-foreground"
                >
                    Loading...
                </span>
            </div>
            <p
                v-if="selectedDisplay.phone || selectedDisplay.email || selectedDisplay.nationalId"
                class="mt-1 text-xs text-muted-foreground"
            >
                <template v-if="selectedDisplay.phone">
                    Phone: {{ selectedDisplay.phone }}
                </template>
                <template
                    v-if="selectedDisplay.phone && (selectedDisplay.email || selectedDisplay.nationalId)"
                >
                    |
                </template>
                <template v-if="selectedDisplay.email">
                    Email: {{ selectedDisplay.email }}
                </template>
                <template
                    v-if="selectedDisplay.email && selectedDisplay.nationalId"
                >
                    |
                </template>
                <template v-if="selectedDisplay.nationalId">
                    National ID: {{ selectedDisplay.nationalId }}
                </template>
            </p>
            <p
                v-if="selectedDisplay.demographics || selectedDisplay.location"
                class="mt-1 text-xs text-muted-foreground"
            >
                <template v-if="selectedDisplay.demographics">
                    {{ selectedDisplay.demographics }}
                </template>
                <template
                    v-if="selectedDisplay.demographics && selectedDisplay.location"
                >
                    |
                </template>
                <template v-if="selectedDisplay.location">
                    {{ selectedDisplay.location }}
                </template>
            </p>
        </div>
    </div>
</template>




































