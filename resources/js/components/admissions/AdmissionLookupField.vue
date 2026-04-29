<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import AdvancedSearchDialog from '@/components/lookup/AdvancedSearchDialog.vue';
import QuickLookupField from '@/components/lookup/QuickLookupField.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AdmissionSummary = {
    id: string;
    admissionNumber?: string | null;
    patientId?: string | null;
    patientNumber?: string | null;
    patientName?: string | null;
    ward?: string | null;
    bed?: string | null;
    admittedAt?: string | null;
    status?: string | null;
    statusReason?: string | null;
};

type AdmissionListMeta = {
    currentPage?: number;
    perPage?: number;
    total?: number;
    lastPage?: number;
};

type AdmissionListResponse = {
    data: AdmissionSummary[];
    meta?: AdmissionListMeta;
};

type ValidationErrorResponse = {
    message?: string;
};

type ApiError = Error & {
    status?: number;
    payload?: ValidationErrorResponse;
};

const RECENT_SEARCHES_KEY = 'admission-lookup.recent-searches.v1';
const RECENT_ADMISSIONS_KEY = 'admission-lookup.recent-admissions.v1';
const RECENT_SEARCH_LIMIT = 6;
const RECENT_ADMISSION_LIMIT = 6;

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
    }>(),
    {
        placeholder: 'Search by admission number, patient name, patient number, ward, or bed',
        helperText: 'Search current inpatient admissions or browse the active census.',
        errorMessage: null,
        disabled: false,
        perPage: 10,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
    selected: [admission: AdmissionSummary | null];
}>();

const searchQuery = ref('');
const selectedAdmission = ref<AdmissionSummary | null>(null);
const searchResults = ref<AdmissionSummary[]>([]);
const searchLoading = ref(false);
const hydrateLoading = ref(false);
const lookupError = ref<string | null>(null);
const accessDenied = ref(false);
const accessDeniedMessage = ref<string | null>(null);
const open = ref(false);
const advancedSearchOpen = ref(false);
const recentSearches = ref<string[]>([]);
const recentAdmissions = ref<AdmissionSummary[]>([]);
const searchResultCount = ref(0);
const advancedSearchResults = ref<AdmissionSummary[]>([]);
const advancedSearchMeta = ref<AdmissionListMeta | null>(null);
const advancedSearchLoading = ref(false);
const advancedSearchPage = ref(1);
const advancedSearchPerPage = computed(() => Math.max(props.perPage, 10));

let debounceTimer: number | null = null;
let suppressSearchWatch = false;

function clearDebounce() {
    if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
    }
}

function normalizeValue(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function admissionNumberLabel(admission: AdmissionSummary): string {
    return admission.admissionNumber?.trim() || admission.id;
}

function patientLabel(admission: AdmissionSummary): string {
    const patientName = admission.patientName?.trim();
    const patientNumber = admission.patientNumber?.trim();
    const patientId = admission.patientId?.trim();

    if (patientName && patientNumber) return `${patientName} | ${patientNumber}`;
    if (patientName) return patientName;
    if (patientNumber) return patientNumber;
    return patientId ? `Patient ${patientId}` : 'Patient not loaded';
}

function placementLabel(admission: AdmissionSummary): string {
    const parts = [
        admission.ward?.trim() || null,
        admission.bed?.trim() ? `Bed ${admission.bed.trim()}` : null,
    ].filter((value): value is string => Boolean(value));

    return parts.length > 0 ? parts.join(' / ') : 'No ward or bed assigned';
}

function formatDateTime(value: string | null | undefined): string | null {
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

function admittedLabel(admission: AdmissionSummary): string | null {
    const label = formatDateTime(admission.admittedAt);
    return label ? `Admitted ${label}` : null;
}

function sanitizeAdmission(admission: AdmissionSummary): AdmissionSummary {
    return {
        id: admission.id,
        admissionNumber: admission.admissionNumber ?? null,
        patientId: admission.patientId ?? null,
        patientNumber: admission.patientNumber ?? null,
        patientName: admission.patientName ?? null,
        ward: admission.ward ?? null,
        bed: admission.bed ?? null,
        admittedAt: admission.admittedAt ?? null,
        status: admission.status ?? null,
        statusReason: admission.statusReason ?? null,
    };
}

function loadRecentLookupActivity() {
    if (typeof window === 'undefined') return;

    try {
        const storedSearches = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]');
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
        const storedAdmissions = JSON.parse(window.localStorage.getItem(RECENT_ADMISSIONS_KEY) ?? '[]');
        recentAdmissions.value = Array.isArray(storedAdmissions)
            ? storedAdmissions
                .filter((value): value is AdmissionSummary => Boolean(value) && typeof value === 'object' && typeof (value as AdmissionSummary).id === 'string')
                .map((admission) => sanitizeAdmission(admission))
                .slice(0, RECENT_ADMISSION_LIMIT)
            : [];
    } catch {
        recentAdmissions.value = [];
    }
}

function persistRecentSearches() {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(recentSearches.value.slice(0, RECENT_SEARCH_LIMIT)),
    );
}

function persistRecentAdmissions() {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(
        RECENT_ADMISSIONS_KEY,
        JSON.stringify(recentAdmissions.value.slice(0, RECENT_ADMISSION_LIMIT)),
    );
}

function rememberSearchQuery(value: string) {
    const normalized = value.trim();
    if (normalized.length < 2) return;

    recentSearches.value = [
        normalized,
        ...recentSearches.value.filter((entry) => normalizeValue(entry) !== normalizeValue(normalized)),
    ].slice(0, RECENT_SEARCH_LIMIT);
    persistRecentSearches();
}

function rememberAdmission(admission: AdmissionSummary) {
    const normalized = sanitizeAdmission(admission);
    recentAdmissions.value = [
        normalized,
        ...recentAdmissions.value.filter((entry) => entry.id !== normalized.id),
    ].slice(0, RECENT_ADMISSION_LIMIT);
    persistRecentAdmissions();
}

function admissionSearchScore(admission: AdmissionSummary): number {
    const query = normalizeValue(searchQuery.value);
    if (!query) return 0;

    const admissionNumber = normalizeValue(admission.admissionNumber);
    const patientId = normalizeValue(admission.patientId);
    const patientNumber = normalizeValue(admission.patientNumber);
    const patientName = normalizeValue(admission.patientName);
    const ward = normalizeValue(admission.ward);
    const bed = normalizeValue(admission.bed);
    const id = normalizeValue(admission.id);

    if (admissionNumber === query) return 500;
    if (id === query) return 450;
    if (patientNumber === query) return 435;
    if (patientId === query) return 425;
    if (admissionNumber.startsWith(query)) return 320;
    if (patientName.startsWith(query)) return 300;
    if (ward.startsWith(query)) return 250;
    if (bed.startsWith(query)) return 240;
    if (patientNumber.includes(query)) return 210;
    if (patientId.includes(query)) return 200;
    if (patientName.includes(query)) return 190;
    if (ward.includes(query)) return 180;
    if (bed.includes(query)) return 170;
    if (id.includes(query)) return 160;

    return 0;
}

const rankedSearchResults = computed(() =>
    [...searchResults.value].sort((left, right) => {
        const scoreDifference = admissionSearchScore(right) - admissionSearchScore(left);
        if (scoreDifference !== 0) return scoreDifference;
        return admissionNumberLabel(left).localeCompare(admissionNumberLabel(right));
    }),
);

const quickSearchResults = computed(() => rankedSearchResults.value.slice(0, 6));

const quickSearchSummary = computed(() => {
    const query = searchQuery.value.trim();

    if (query.length < 2) {
        return 'Recent admissions stay here. Use advanced search for the wider active census.';
    }

    if (searchResultCount.value > quickSearchResults.value.length) {
        return `Showing top ${quickSearchResults.value.length} of ${searchResultCount.value} matches.`;
    }

    if (searchResultCount.value > 0) {
        return `${searchResultCount.value} match${searchResultCount.value === 1 ? '' : 'es'} found.`;
    }

    return 'No match yet. Open advanced search to browse the active inpatient census.';
});

const advancedSearchResultCount = computed(() => Number(advancedSearchMeta.value?.total ?? advancedSearchResults.value.length));
const advancedSearchPageLabel = computed(() => {
    const currentPage = Number(advancedSearchMeta.value?.currentPage ?? advancedSearchPage.value ?? 1);
    const lastPage = Number(advancedSearchMeta.value?.lastPage ?? 1);
    return `Page ${currentPage} of ${lastPage}`;
});

const selectedDisplay = computed(() => {
    if (!selectedAdmission.value) return null;

    return {
        title: admissionNumberLabel(selectedAdmission.value),
        patient: patientLabel(selectedAdmission.value),
        placement: placementLabel(selectedAdmission.value),
        admittedAt: admittedLabel(selectedAdmission.value),
        status: selectedAdmission.value.status?.trim() || null,
    };
});

const hasSelection = computed(() => Boolean(props.modelValue.trim() || selectedAdmission.value));

async function apiRequest<T>(query?: Record<string, string | number | null | undefined>): Promise<T> {
    const url = new URL('/api/v1/inpatient-ward/census', window.location.origin);

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

function setAccessDeniedFallback() {
    accessDenied.value = true;
    accessDeniedMessage.value = 'Admission lookup is restricted by permissions. Enter admission UUID manually.';
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

async function searchAdmissions() {
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
        const response = await apiRequest<AdmissionListResponse>({
            q: query,
            perPage: props.perPage,
            page: 1,
        });
        searchResults.value = response.data ?? [];
        searchResultCount.value = Number(response.meta?.total ?? response.data?.length ?? 0);
    } catch (error) {
        if (isForbiddenError(error)) {
            setAccessDeniedFallback();
            return;
        }
        searchResults.value = [];
        searchResultCount.value = 0;
        lookupError.value = error instanceof Error ? error.message : 'Unable to search admissions.';
    } finally {
        searchLoading.value = false;
    }
}

async function searchAdvancedAdmissions(page = 1) {
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
        const response = await apiRequest<AdmissionListResponse>({
            q: query || null,
            perPage: advancedSearchPerPage.value,
            page,
        });
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
        lookupError.value = error instanceof Error ? error.message : 'Unable to search admissions.';
    } finally {
        advancedSearchLoading.value = false;
    }
}

function goToAdvancedSearchPage(page: number) {
    if (advancedSearchLoading.value) return;
    if (page < 1) return;
    void searchAdvancedAdmissions(page);
}

async function hydrateSelectedAdmission(admissionId: string) {
    if (!admissionId) {
        selectedAdmission.value = null;
        emit('selected', null);
        return;
    }

    if (selectedAdmission.value?.id === admissionId || accessDenied.value) return;

    hydrateLoading.value = true;
    lookupError.value = null;

    try {
        const response = await apiRequest<AdmissionListResponse>({
            q: admissionId,
            page: 1,
            perPage: 25,
        });
        const exactMatch = (response.data ?? []).find((item) => {
            const id = item.id?.trim() ?? '';
            const admissionNumber = item.admissionNumber?.trim() ?? '';
            return id === admissionId || admissionNumber === admissionId;
        }) ?? null;

        selectedAdmission.value = exactMatch;
        emit('selected', exactMatch);

        if (!exactMatch) {
            lookupError.value = 'Unable to load selected admission.';
        }
    } catch (error) {
        if (isForbiddenError(error)) {
            setAccessDeniedFallback();
            emit('selected', null);
            return;
        }
        selectedAdmission.value = null;
        lookupError.value = error instanceof Error ? error.message : 'Unable to load selected admission.';
        emit('selected', null);
    } finally {
        hydrateLoading.value = false;
    }
}

function selectAdmission(admission: AdmissionSummary) {
    const recentQuery = searchQuery.value.trim();
    suppressSearchWatch = true;
    selectedAdmission.value = admission;
    searchResults.value = [];
    searchResultCount.value = 0;
    advancedSearchResults.value = [];
    advancedSearchMeta.value = null;
    advancedSearchPage.value = 1;
    searchQuery.value = '';
    lookupError.value = null;
    open.value = false;
    advancedSearchOpen.value = false;
    rememberAdmission(admission);
    rememberSearchQuery(recentQuery);
    window.setTimeout(() => {
        suppressSearchWatch = false;
    }, 0);
    emit('update:modelValue', admission.id);
    emit('selected', admission);
}

function clearSelection() {
    suppressSearchWatch = true;
    selectedAdmission.value = null;
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
    open.value = true;

    if (searchQuery.value.trim().length >= 2 && searchResults.value.length === 0 && !searchLoading.value) {
        void searchAdmissions();
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
        const admissionId = value.trim();
        if (!admissionId) {
            selectedAdmission.value = null;
            emit('selected', null);
            return;
        }

        void hydrateSelectedAdmission(admissionId);
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
            void searchAdvancedAdmissions(1);
            debounceTimer = null;
        }, 300);
        return;
    }

    open.value = true;
    debounceTimer = window.setTimeout(() => {
        void searchAdmissions();
        debounceTimer = null;
    }, 300);
});

watch(advancedSearchOpen, (value) => {
    if (value) {
        open.value = false;
        void searchAdvancedAdmissions(advancedSearchPage.value);
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
                            placeholder="Enter admission UUID"
                            class="h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent py-1.5 pl-2 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            @input="updateManualInput"
                        />
                    </div>
                    <Alert variant="destructive">
                        <AlertDescription class="text-xs">
                            {{ accessDeniedMessage }}
                        </AlertDescription>
                    </Alert>
                </div>
            </template>

            <template #results>
                <div v-if="searchLoading || hydrateLoading" class="px-3 py-3 text-xs text-muted-foreground">
                    Searching admissions...
                </div>

                <Alert v-else-if="lookupError" variant="destructive" class="m-1">
                    <AlertDescription class="text-xs">
                        {{ lookupError }}
                    </AlertDescription>
                </Alert>

                <template v-else-if="searchQuery.trim().length === 0">
                    <div v-if="recentAdmissions.length > 0" class="space-y-1">
                        <p class="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Recent admissions
                        </p>
                        <button
                            v-for="admission in recentAdmissions"
                            :key="`recent-admission-${admission.id}`"
                            type="button"
                            class="flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
                            @click="selectAdmission(admission)"
                        >
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="font-medium">{{ admissionNumberLabel(admission) }}</span>
                                <Badge v-if="admission.status" variant="secondary">{{ admission.status }}</Badge>
                            </div>
                            <span class="text-xs text-muted-foreground">
                                {{ patientLabel(admission) }}
                                <template v-if="placementLabel(admission)"> | {{ placementLabel(admission) }}</template>
                            </span>
                        </button>
                    </div>

                    <div v-if="recentSearches.length > 0" class="border-t px-3 py-3">
                        <p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Recent searches
                        </p>
                        <div class="mt-2 flex flex-wrap gap-2">
                            <Button
                                v-for="entry in recentSearches"
                                :key="`recent-admission-search-${entry}`"
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

                    <p v-if="recentAdmissions.length === 0 && recentSearches.length === 0" class="px-3 py-3 text-xs text-muted-foreground">
                        Start typing to search. Recent admissions and recent searches will appear here.
                    </p>
                </template>

                <template v-else-if="quickSearchResults.length > 0">
                    <button
                        v-for="admission in quickSearchResults"
                        :key="`quick-admission-${admission.id}`"
                        type="button"
                        class="flex w-full flex-col items-start gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
                        @click="selectAdmission(admission)"
                    >
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="font-medium">{{ admissionNumberLabel(admission) }}</span>
                            <Badge v-if="admission.status" variant="secondary">{{ admission.status }}</Badge>
                        </div>
                        <span class="text-xs text-muted-foreground">
                            {{ patientLabel(admission) }} | {{ placementLabel(admission) }}
                        </span>
                        <span v-if="admittedLabel(admission)" class="text-xs text-muted-foreground">
                            {{ admittedLabel(admission) }}
                        </span>
                    </button>
                </template>

                <p v-else-if="searchQuery.trim().length === 1" class="px-3 py-3 text-xs text-muted-foreground">
                    Type at least 2 characters to search.
                </p>

                <p v-else class="px-3 py-3 text-xs text-muted-foreground">
                    No admissions found. Try admission number, patient ID, ward, or bed.
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
            title="Advanced admission search"
            description="Search the active inpatient census, compare placement and status, then select the right admission."
            :search-input-id="`${inputId}-advanced`"
            search-label="Search admissions"
            search-placeholder="Search by admission number, patient name, patient number, ward, or bed"
            :query="searchQuery"
            :error-message="lookupError"
            content-class="sm:max-w-5xl"
            plain-results
            @update:open="advancedSearchOpen = $event"
            @update:query="searchQuery = $event"
        >
            <template v-if="advancedSearchLoading">
                <div class="space-y-2">
                    <div v-for="n in 4" :key="`advanced-admission-skeleton-${n}`" class="rounded-md border px-3 py-2">
                        <div class="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1fr)_5rem] md:items-center">
                            <div class="h-4 w-32 rounded bg-muted"></div>
                            <div class="h-4 w-24 rounded bg-muted"></div>
                            <div class="h-4 w-32 rounded bg-muted"></div>
                            <div class="ml-auto h-6 w-14 rounded bg-muted"></div>
                        </div>
                    </div>
                </div>
            </template>

            <template v-else>
                <div class="space-y-2">
                    <div class="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                        <span class="font-medium text-foreground/80">Active inpatient admissions</span>
                        <span>
                            <template v-if="searchQuery.trim().length > 0">
                                {{ advancedSearchResultCount }} match{{ advancedSearchResultCount === 1 ? '' : 'es' }}
                            </template>
                            <template v-else>
                                Browsing the active inpatient census
                            </template>
                            &middot; {{ advancedSearchPageLabel }}
                        </span>
                    </div>

                    <p v-if="searchQuery.trim().length === 1" class="rounded-md border border-dashed bg-muted/10 px-2.5 py-2.5 text-sm text-muted-foreground">
                        Type at least 2 characters to search, or clear the query to browse the active census.
                    </p>

                    <div v-else-if="advancedSearchResults.length > 0" class="overflow-x-auto rounded-md border bg-background">
                        <table class="min-w-full table-fixed text-[12px]">
                            <thead class="border-b bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th class="w-[28%] px-1.5 py-1 text-left font-medium">Admission</th>
                                    <th class="w-[20%] px-1.5 py-1 text-left font-medium">Patient</th>
                                    <th class="w-[32%] px-1.5 py-1 text-left font-medium">Placement</th>
                                    <th class="w-[10%] px-1.5 py-1 text-left font-medium">Status</th>
                                    <th class="w-[10%] px-1.5 py-1 text-right font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="admission in advancedSearchResults" :key="`advanced-admission-${admission.id}`" class="border-b align-middle last:border-b-0">
                                    <td class="px-1.5 py-0.5">
                                        <div class="min-w-0 whitespace-nowrap">
                                            <div class="truncate font-medium text-foreground" :title="admissionNumberLabel(admission)">
                                                {{ admissionNumberLabel(admission) }}
                                            </div>
                                            <div v-if="admittedLabel(admission)" class="truncate text-[11px] text-muted-foreground" :title="admittedLabel(admission) || ''">
                                                {{ admittedLabel(admission) }}
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                        <div class="truncate" :title="patientLabel(admission)">
                                            {{ patientLabel(admission) }}
                                        </div>
                                    </td>
                                    <td class="px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                        <div class="truncate" :title="placementLabel(admission)">
                                            {{ placementLabel(admission) }}
                                        </div>
                                    </td>
                                    <td class="px-1.5 py-0.5 whitespace-nowrap">
                                        <Badge v-if="admission.status" variant="secondary" class="h-4 px-1.5 text-[10px]">
                                            {{ admission.status }}
                                        </Badge>
                                        <span v-else class="text-xs text-muted-foreground">No status</span>
                                    </td>
                                    <td class="px-1.5 py-0.5 text-right whitespace-nowrap">
                                        <Button type="button" size="sm" variant="outline" class="h-6 px-2 text-[11px]" @click="selectAdmission(admission)">
                                            Select
                                        </Button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <p v-else class="rounded-md border border-dashed bg-muted/10 px-2.5 py-3 text-sm text-muted-foreground">
                        <template v-if="searchQuery.trim().length > 0">
                            No admissions found. Refine the search or clear it to browse the active census.
                        </template>
                        <template v-else>
                            No active admissions are available right now.
                        </template>
                    </p>

                    <div class="flex flex-wrap items-center justify-between gap-2 border-t pt-1.5">
                        <p class="text-[11px] text-muted-foreground">
                            {{ advancedSearchResultCount }} total admission{{ advancedSearchResultCount === 1 ? '' : 's' }} in this result set.
                        </p>
                        <div class="flex items-center gap-2">
                            <Button type="button" size="sm" variant="outline" class="h-7 px-2.5 text-xs" :disabled="advancedSearchLoading || (advancedSearchMeta?.currentPage ?? advancedSearchPage) <= 1" @click="goToAdvancedSearchPage((advancedSearchMeta?.currentPage ?? advancedSearchPage) - 1)">
                                Previous
                            </Button>
                            <p class="text-[11px] text-muted-foreground">{{ advancedSearchPageLabel }}</p>
                            <Button type="button" size="sm" variant="outline" class="h-7 px-2.5 text-xs" :disabled="advancedSearchLoading || !advancedSearchMeta || (advancedSearchMeta.currentPage ?? advancedSearchPage) >= (advancedSearchMeta.lastPage ?? 1)" @click="goToAdvancedSearchPage((advancedSearchMeta?.currentPage ?? advancedSearchPage) + 1)">
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            </template>
        </AdvancedSearchDialog>

        <div v-if="selectedDisplay" class="rounded-lg border p-2">
            <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-medium">{{ selectedDisplay.title }}</p>
                <Badge v-if="selectedDisplay.status" variant="secondary">{{ selectedDisplay.status }}</Badge>
                <span v-if="hydrateLoading" class="text-xs text-muted-foreground">Loading...</span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
                {{ selectedDisplay.patient }} | {{ selectedDisplay.placement }}
            </p>
            <p v-if="selectedDisplay.admittedAt" class="mt-1 text-xs text-muted-foreground">
                {{ selectedDisplay.admittedAt }}
            </p>
        </div>
    </div>
</template>
