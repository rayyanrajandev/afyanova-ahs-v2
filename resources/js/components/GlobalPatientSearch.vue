<script setup lang="ts">
import { router } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { apiGet } from '@/lib/apiClient';
import { patientChartHref } from '@/lib/patientChart';
import { hasRouteAccess } from '@/lib/routeAccess';

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
    avatarUrl?: string | null;
};

type PatientListResponse = {
    data: PatientSummary[];
    meta?: {
        total?: number | null;
    } | null;
};

const RECENT_PATIENTS_STORAGE_KEY = 'ahs.global-patient-search.recent.v1';
const PATIENT_SEARCH_MIN_LENGTH = 2;
const PATIENT_SEARCH_LIMIT = 6;
const LATEST_REGISTERED_LIMIT = 10;

const open = ref(false);
const searchQuery = ref('');
const searchResults = ref<PatientSummary[]>([]);
const recentPatients = ref<PatientSummary[]>([]);
const latestRegisteredPatients = ref<PatientSummary[]>([]);
const latestRegisteredLoading = ref(false);
const searchLoading = ref(false);
const searchError = ref<string | null>(null);
const searchTotal = ref(0);
let searchTimer: number | undefined;
let searchRequestId = 0;

const { permissionNames, hasUniversalAdminAccess, facilityEntitlementNames } = usePlatformAccess();

const canSearchPatients = computed(() =>
    hasRouteAccess(
        '/patients',
        permissionNames.value,
        hasUniversalAdminAccess.value,
        facilityEntitlementNames.value,
    ),
);

const canOpenPatientChart = computed(() =>
    hasRouteAccess(
        '/medical-records',
        permissionNames.value,
        hasUniversalAdminAccess.value,
        facilityEntitlementNames.value,
    ),
);

const canOpenPatientAppointments = computed(() =>
    hasRouteAccess(
        '/appointments',
        permissionNames.value,
        hasUniversalAdminAccess.value,
        facilityEntitlementNames.value,
    ),
);

const normalizedSearch = computed(() => searchQuery.value.trim());
const shouldSearchPatients = computed(
    () => canSearchPatients.value && normalizedSearch.value.length >= PATIENT_SEARCH_MIN_LENGTH,
);

function buildHref(
    path: string,
    query: Record<string, string | string[] | null | undefined>,
): string {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.filter(Boolean).forEach((item) => params.append(key, item));
            return;
        }
        if (!value) return;
        params.set(key, value);
    });

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
}

function normalizePatientText(value: string | null | undefined): string {
    return String(value ?? '').trim();
}

function sanitizePatient(patient: PatientSummary): PatientSummary {
    return {
        id: normalizePatientText(patient.id),
        patientNumber: normalizePatientText(patient.patientNumber) || null,
        firstName: normalizePatientText(patient.firstName) || null,
        middleName: normalizePatientText(patient.middleName) || null,
        lastName: normalizePatientText(patient.lastName) || null,
        gender: normalizePatientText(patient.gender) || null,
        dateOfBirth: normalizePatientText(patient.dateOfBirth) || null,
        status: normalizePatientText(patient.status) || null,
        phone: normalizePatientText(patient.phone) || null,
        email: normalizePatientText(patient.email) || null,
        nationalId: normalizePatientText(patient.nationalId) || null,
        region: normalizePatientText(patient.region) || null,
        district: normalizePatientText(patient.district) || null,
    };
}

function patientDisplayName(patient: PatientSummary): string {
    return (
        [patient.firstName, patient.middleName, patient.lastName]
            .map((part) => normalizePatientText(part))
            .filter(Boolean)
            .join(' ') ||
        patient.patientNumber ||
        'Unnamed patient'
    );
}

function patientInitials(patient: PatientSummary): string {
    const first = normalizePatientText(patient.firstName).charAt(0).toUpperCase();
    const last = normalizePatientText(patient.lastName).charAt(0).toUpperCase();
    return first + last || '?';
}

function patientAge(patient: PatientSummary): number | null {
    const dateOfBirth = normalizePatientText(patient.dateOfBirth);
    if (!dateOfBirth) return null;

    const birthDate = new Date(dateOfBirth);
    if (Number.isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDelta = today.getMonth() - birthDate.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
        age -= 1;
    }

    return age >= 0 && age < 130 ? age : null;
}

function patientMeta(patient: PatientSummary): string {
    const age = patientAge(patient);
    const parts = [
        patient.patientNumber,
        patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : null,
        age !== null ? `${age}y` : null,
        patient.phone,
    ]
        .map((part) => normalizePatientText(part))
        .filter(Boolean);

    return parts.join(' | ') || 'Patient record';
}

function patientSearchValue(patient: PatientSummary): string {
    return [
        'patient',
        patientDisplayName(patient),
        patient.patientNumber,
        patient.phone,
        patient.email,
        patient.nationalId,
        patient.region,
        patient.district,
        patient.status,
    ]
        .map((part) => normalizePatientText(part))
        .filter(Boolean)
        .join(' ');
}

function patientDirectoryHref(patient: PatientSummary): string {
    return buildHref('/patients', {
        q: patient.patientNumber || patientDisplayName(patient),
    });
}

function patientAppointmentHref(patient: PatientSummary): string {
    return buildHref('/appointments', {
        patientId: patient.id,
        patientName: patientDisplayName(patient),
        patientNumber: patient.patientNumber,
        open: 'schedule',
    });
}

function patientSearchHref(): string {
    return buildHref('/patients', { q: normalizedSearch.value });
}

function loadRecentPatients() {
    if (typeof window === 'undefined') return;

    try {
        const parsed = JSON.parse(window.localStorage.getItem(RECENT_PATIENTS_STORAGE_KEY) ?? '[]');
        if (!Array.isArray(parsed)) return;
        recentPatients.value = parsed
            .map((patient) => sanitizePatient(patient as PatientSummary))
            .filter((patient) => patient.id)
            .slice(0, PATIENT_SEARCH_LIMIT);
    } catch {
        recentPatients.value = [];
    }
}

function rememberPatient(patient: PatientSummary) {
    if (typeof window === 'undefined' || !patient.id) return;

    const normalized = sanitizePatient(patient);
    const next = [
        normalized,
        ...recentPatients.value.filter((entry) => entry.id !== normalized.id),
    ].slice(0, PATIENT_SEARCH_LIMIT);

    recentPatients.value = next;

    try {
        window.localStorage.setItem(RECENT_PATIENTS_STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Local recents are only a speed boost; search and navigation should continue without them.
    }
}

async function searchPatients(query: string, requestId: number) {
    searchLoading.value = true;
    searchError.value = null;

    try {
        const response = await apiGet<PatientListResponse>(
            '/patients',
            {
                q: query,
                perPage: PATIENT_SEARCH_LIMIT,
                page: 1,
            },
            { entitlementContext: 'Global patient search' },
        );

        if (requestId !== searchRequestId) return;

        const rows = (response.data ?? [])
            .map((patient) => sanitizePatient(patient))
            .filter((patient) => patient.id);

        searchResults.value = rows;
        searchTotal.value = Number(response.meta?.total ?? rows.length);
    } catch {
        if (requestId !== searchRequestId) return;
        searchResults.value = [];
        searchTotal.value = 0;
        searchError.value = 'Patient search is unavailable right now.';
    } finally {
        if (requestId === searchRequestId) {
            searchLoading.value = false;
        }
    }
}

async function fetchLatestRegisteredPatients() {
    if (!canSearchPatients.value) return;
    latestRegisteredLoading.value = true;

    try {
        const response = await apiGet<PatientListResponse>(
            '/patients',
            {
                perPage: LATEST_REGISTERED_LIMIT,
                page: 1,
                sort: 'latest',
            },
            { entitlementContext: 'Global patient search' },
        );

        latestRegisteredPatients.value = (response.data ?? [])
            .map((patient) => sanitizePatient(patient))
            .filter((patient) => patient.id);
    } catch {
        latestRegisteredPatients.value = [];
    } finally {
        latestRegisteredLoading.value = false;
    }
}

function runSearchNow() {
    if (searchTimer !== undefined) {
        window.clearTimeout(searchTimer);
        searchTimer = undefined;
    }

    if (!open.value || !shouldSearchPatients.value) return;

    const query = normalizedSearch.value;
    const requestId = searchRequestId + 1;
    searchRequestId = requestId;

    void searchPatients(query, requestId);
}

function toggleSearch() {
    open.value = !open.value;
}

function goToRoute(href: string) {
    open.value = false;
    router.visit(href);
}

function openPatientDirectory(patient: PatientSummary) {
    rememberPatient(patient);
    goToRoute(patientDirectoryHref(patient));
}

function openPatientChart(patient: PatientSummary) {
    rememberPatient(patient);
    goToRoute(patientChartHref(patient.id, { from: 'global-patient-search' }));
}

function openPatientAppointments(patient: PatientSummary) {
    rememberPatient(patient);
    goToRoute(patientAppointmentHref(patient));
}

watch([open, normalizedSearch, canSearchPatients], ([isOpen], [wasOpen]) => {
    if (searchTimer !== undefined) {
        window.clearTimeout(searchTimer);
        searchTimer = undefined;
    }

    if (!isOpen && searchQuery.value !== '') {
        searchQuery.value = '';
    }

    // Fetch latest registered patients when sheet first opens
    if (isOpen && !wasOpen && latestRegisteredPatients.value.length === 0) {
        void fetchLatestRegisteredPatients();
    }

    if (!isOpen || !shouldSearchPatients.value) {
        searchRequestId += 1;
        searchLoading.value = false;
        searchError.value = null;
        searchResults.value = [];
        searchTotal.value = 0;
        return;
    }

    const query = normalizedSearch.value;
    const requestId = searchRequestId + 1;
    searchRequestId = requestId;

    searchTimer = window.setTimeout(() => {
        searchTimer = undefined;
        void searchPatients(query, requestId);
    }, 250);
});

onMounted(loadRecentPatients);

onBeforeUnmount(() => {
    if (searchTimer !== undefined) {
        window.clearTimeout(searchTimer);
    }
});
</script>

<template>
    <div v-if="canSearchPatients" class="flex items-center">
        <Button
            type="button"
            variant="outline"
            size="sm"
            class="h-9 w-9 justify-center gap-2 px-0 text-muted-foreground shadow-xs md:w-[240px] md:justify-start md:px-3 lg:w-[280px]"
            @click="toggleSearch"
        >
            <AppIcon name="search" class="size-4 shrink-0" />
            <span class="hidden min-w-0 flex-1 truncate text-left md:inline">Search patients...</span>
            <span class="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline">
                MRN
            </span>
            <span class="sr-only md:hidden">Find Patient</span>
        </Button>

        <Sheet v-model:open="open">
            <SheetContent side="left" size="2xl" :show-close-button="true" class="flex flex-col gap-0 p-0">
                <SheetHeader class="border-b px-4 py-4">
                    <SheetTitle class="flex items-center gap-2 text-base">
                        <AppIcon name="search" class="size-4 text-muted-foreground" />
                        Find Patient
                    </SheetTitle>
                    <SheetDescription class="text-xs text-muted-foreground">
                        Search by name, number, phone, or national ID
                    </SheetDescription>
                    <div class="relative mt-2">
                        <AppIcon name="search" class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                            v-model="searchQuery"
                            placeholder="Search patients..."
                            class="pl-9 pr-4"
                            autofocus
                            @keydown.enter.prevent="runSearchNow"
                        />
                    </div>
                </SheetHeader>

                <div class="flex-1 overflow-y-auto">
                    <!-- Search results state -->
                    <template v-if="normalizedSearch.length >= PATIENT_SEARCH_MIN_LENGTH">
                        <div class="px-4 py-3">
                            <p class="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Search results
                            </p>

                            <!-- Loading -->
                            <div v-if="searchLoading" class="space-y-2">
                                <div
                                    v-for="n in 4"
                                    :key="n"
                                    class="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 animate-pulse"
                                >
                                    <div class="size-10 rounded-full bg-muted" />
                                    <div class="flex-1 space-y-1.5">
                                        <div class="h-3.5 w-2/3 rounded bg-muted" />
                                        <div class="h-3 w-1/2 rounded bg-muted" />
                                    </div>
                                </div>
                            </div>

                            <!-- Error -->
                            <div
                                v-else-if="searchError"
                                class="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground"
                            >
                                <AppIcon name="alert-triangle" class="size-8 text-destructive/60" />
                                <p>{{ searchError }}</p>
                                <Button variant="outline" size="sm" @click="goToRoute(patientSearchHref())">
                                    Open patient directory
                                </Button>
                            </div>

                            <!-- No results -->
                            <div
                                v-else-if="!searchResults.length"
                                class="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground"
                            >
                                <AppIcon name="user-x" class="size-8 opacity-40" />
                                <p>No patients match "{{ normalizedSearch }}"</p>
                                <Button variant="outline" size="sm" @click="goToRoute(patientSearchHref())">
                                    Search full directory
                                </Button>
                            </div>

                            <!-- Results list -->
                            <div v-else class="space-y-2">
                                <div
                                    v-for="patient in searchResults"
                                    :key="patient.id"
                                    class="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5"
                                >
                                    <Avatar class="size-10 shrink-0">
                                        <AvatarImage v-if="patient.avatarUrl" :src="patient.avatarUrl" :alt="patientDisplayName(patient)" />
                                        <AvatarFallback class="bg-primary/10 text-xs font-semibold text-primary">
                                            {{ patientInitials(patient) }}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div class="min-w-0 flex-1">
                                        <p class="truncate text-sm font-medium">{{ patientDisplayName(patient) }}</p>
                                        <p class="truncate text-xs text-muted-foreground">{{ patientMeta(patient) }}</p>
                                    </div>
                                    <div class="flex shrink-0 items-center gap-1.5">
                                        <Button
                                            v-if="canOpenPatientChart"
                                            size="sm"
                                            class="gap-1.5"
                                            @click="openPatientChart(patient)"
                                        >
                                            <AppIcon name="stethoscope" class="size-3.5" />
                                            Open Chart
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="gap-1.5"
                                            @click="openPatientDirectory(patient)"
                                        >
                                            <AppIcon name="users" class="size-3.5" />
                                            View in List
                                        </Button>
                                    </div>
                                </div>

                                <button
                                    v-if="searchTotal > searchResults.length"
                                    type="button"
                                    class="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:bg-accent transition-colors"
                                    @click="goToRoute(patientSearchHref())"
                                >
                                    <AppIcon name="arrow-right" class="size-4 shrink-0" />
                                    View all {{ searchTotal }} matching patients
                                </button>
                            </div>
                        </div>
                    </template>

                    <!-- Default state: Recently accessed + Latest registered -->
                    <template v-else>
                        <!-- Recently Accessed -->
                        <div v-if="recentPatients.length > 0" class="px-4 py-3">
                            <p class="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Recently accessed
                            </p>
                            <div class="space-y-2">
                                <div
                                    v-for="patient in recentPatients"
                                    :key="`recent-${patient.id}`"
                                    class="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5"
                                >
                                    <Avatar class="size-10 shrink-0">
                                        <AvatarImage v-if="patient.avatarUrl" :src="patient.avatarUrl" :alt="patientDisplayName(patient)" />
                                        <AvatarFallback class="bg-muted text-xs font-semibold text-muted-foreground">
                                            {{ patientInitials(patient) }}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div class="min-w-0 flex-1">
                                        <p class="truncate text-sm font-medium">{{ patientDisplayName(patient) }}</p>
                                        <p class="truncate text-xs text-muted-foreground">{{ patientMeta(patient) }}</p>
                                    </div>
                                    <div class="flex shrink-0 items-center gap-1.5">
                                        <Button
                                            v-if="canOpenPatientChart"
                                            size="sm"
                                            class="gap-1.5"
                                            @click="openPatientChart(patient)"
                                        >
                                            <AppIcon name="stethoscope" class="size-3.5" />
                                            Open Chart
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="gap-1.5"
                                            @click="openPatientDirectory(patient)"
                                        >
                                            <AppIcon name="users" class="size-3.5" />
                                            View in List
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Separator v-if="recentPatients.length > 0" class="mx-4" />

                        <!-- Latest Registered -->
                        <div class="px-4 py-3">
                            <p class="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Latest registered patients
                            </p>

                            <!-- Loading skeleton -->
                            <div v-if="latestRegisteredLoading" class="space-y-2">
                                <div
                                    v-for="n in 6"
                                    :key="n"
                                    class="flex items-center gap-3 rounded-lg border bg-muted/30 p-3 animate-pulse"
                                >
                                    <div class="size-10 rounded-full bg-muted" />
                                    <div class="flex-1 space-y-1.5">
                                        <div class="h-3.5 w-2/3 rounded bg-muted" />
                                        <div class="h-3 w-1/2 rounded bg-muted" />
                                    </div>
                                </div>
                            </div>

                            <div v-else-if="!latestRegisteredPatients.length" class="py-6 text-center text-xs text-muted-foreground">
                                No recent registrations found.
                            </div>

                            <div v-else class="space-y-2">
                                <div
                                    v-for="patient in latestRegisteredPatients"
                                    :key="`latest-${patient.id}`"
                                    class="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5"
                                >
                                    <Avatar class="size-10 shrink-0">
                                        <AvatarImage v-if="patient.avatarUrl" :src="patient.avatarUrl" :alt="patientDisplayName(patient)" />
                                        <AvatarFallback class="bg-primary/5 text-xs font-semibold text-primary/70">
                                            {{ patientInitials(patient) }}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div class="min-w-0 flex-1">
                                        <p class="truncate text-sm font-medium">{{ patientDisplayName(patient) }}</p>
                                        <p class="truncate text-xs text-muted-foreground">{{ patientMeta(patient) }}</p>
                                    </div>
                                    <div class="flex shrink-0 items-center gap-1.5">
                                        <Button
                                            v-if="canOpenPatientChart"
                                            size="sm"
                                            class="gap-1.5"
                                            @click="openPatientChart(patient)"
                                        >
                                            <AppIcon name="stethoscope" class="size-3.5" />
                                            Open Chart
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            class="gap-1.5"
                                            @click="openPatientDirectory(patient)"
                                        >
                                            <AppIcon name="users" class="size-3.5" />
                                            View in List
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Empty hint when no recents and no query -->
                        <div
                            v-if="!recentPatients.length && !latestRegisteredLoading && !latestRegisteredPatients.length"
                            class="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground"
                        >
                            <AppIcon name="search" class="size-8 opacity-30" />
                            <p>Type to search for a patient</p>
                            <p class="text-xs">Name, patient number, phone, or national ID</p>
                        </div>
                    </template>
                </div>
            </SheetContent>
        </Sheet>
    </div>
</template>
