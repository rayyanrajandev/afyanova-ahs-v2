<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { usePatientList, usePatientStatusCounts, type PatientListItem } from '@/composables/patientsIndex/usePatientList';
import { usePatientListFilters } from '@/composables/patientsIndex/usePatientListFilters';
import { type BreadcrumbItem } from '@/types';

/**
 * Phase 0 (foundation) + Phase 1 (list/filters/status counts) of
 * reports/patients-index-modernization-plan.md.
 *
 * Foundation (Phase 0): usePlatformAccess()-based computed() permission
 * checks, no redundant GET /auth/me/permissions call, <Head>/access-gate/
 * sticky-header-in-bounded-scroll-container conventions matching
 * ShowV2.vue/WorkspaceV2.vue.
 *
 * Phase 1: usePatientList/usePatientStatusCounts/usePatientListFilters —
 * the list table, status-count KPI cards (clickable, doubling as the
 * active/inactive/all filter, matching the legacy page's own status-pill
 * behavior), and an inline search+gender+sort filter bar. Deliberately
 * simpler than the legacy page's separate "Filters" sheet — inline filters
 * match medical-records/IndexV2.vue's established shape instead of
 * replicating a legacy UI decision this rebuild isn't obligated to keep.
 * No row actions yet (view/edit/status-change/register — those arrive in
 * later phases); this table is read-only until then.
 *
 * Route remains unlinked (reports/patients-index-modernization-plan.md
 * §3.3): /patients keeps rendering the legacy page until Phase 6.
 */
const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canReadPatients = computed(() => hasAccess('patients.read'));

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Patients', href: '/patients/v2' },
]);

const filters = usePatientListFilters();
const list = usePatientList(filters);
const statusCounts = usePatientStatusCounts(filters);

const patients = computed(() => list.data.value?.data ?? []);
const meta = computed(() => list.data.value?.meta ?? null);

const STATUS_TABS: { value: string; label: string; dot: string }[] = [
    { value: 'active', label: 'Active', dot: 'bg-emerald-500' },
    { value: 'inactive', label: 'Inactive', dot: 'bg-rose-500' },
    { value: '', label: 'All', dot: 'bg-slate-400' },
];

function statusTabCount(value: string): number | null {
    const counts = statusCounts.data.value;
    if (!counts) return null;
    if (value === 'active') return counts.active;
    if (value === 'inactive') return counts.inactive;
    return counts.total;
}

function setStatus(value: string): void {
    filters.status = value;
    filters.page = 1;
}

function submitSearch(): void {
    filters.page = 1;
}

function patientName(patient: PatientListItem): string {
    return [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ') || 'Unnamed patient';
}

function patientInitials(patient: PatientListItem): string {
    const first = patient.firstName?.trim()?.[0] ?? '';
    const last = patient.lastName?.trim()?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
}

function statusVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
    if (status === 'active') return 'default';
    if (status === 'inactive') return 'outline';
    return 'secondary';
}

function formatDate(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function goToPage(page: number): void {
    if (!meta.value) return;
    filters.page = Math.min(Math.max(page, 1), meta.value.lastPage);
}

// Same bounded-scroll-container pattern as ShowV2.vue/WorkspaceV2.vue/
// patient-flow/Board.vue/reception/Queue.vue.
const scrollContainerRef = useTemplateRef<HTMLDivElement>('scrollContainer');
const scrollContainerHeight = ref('98dvh');

function updateScrollContainerHeight(): void {
    const el = scrollContainerRef.value;
    if (!el) return;
    scrollContainerHeight.value = `calc(98dvh - ${el.getBoundingClientRect().top}px)`;
}

onMounted(() => {
    updateScrollContainerHeight();
    window.addEventListener('resize', updateScrollContainerHeight);
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', updateScrollContainerHeight);
});
</script>

<template>
    <Head title="Patients" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Patients</h1>
                        <p class="text-xs text-muted-foreground">Rebuild in progress — see reports/patients-index-modernization-plan.md.</p>
                    </div>
                    <Badge v-if="meta" variant="secondary">{{ meta.total }} patients</Badge>
                </div>

                <div v-if="canReadPatients" class="mt-3 flex flex-wrap gap-2">
                    <button
                        v-for="tab in STATUS_TABS"
                        :key="tab.value"
                        type="button"
                        class="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-accent"
                        :class="filters.status === tab.value ? 'border-primary bg-primary/5' : ''"
                        @click="setStatus(tab.value)"
                    >
                        <span class="inline-block h-2 w-2 rounded-full" :class="tab.dot" />
                        <span class="font-medium">{{ statusTabCount(tab.value) ?? '—' }}</span>
                        <span class="text-muted-foreground">{{ tab.label }}</span>
                    </button>
                </div>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canReadPatients" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing patients requires <code>patients.read</code>.</AlertDescription>
                </Alert>

                <template v-else>
                    <div class="flex flex-wrap items-center gap-2">
                        <div class="relative min-w-0 flex-1">
                            <AppIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                v-model="filters.q"
                                placeholder="Search name, MRN, phone, email, or ID…"
                                class="h-9 pl-9"
                                @keyup.enter="submitSearch"
                            />
                        </div>
                        <select
                            v-model="filters.gender"
                            class="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none"
                        >
                            <option value="">All genders</option>
                            <option value="female">Female</option>
                            <option value="male">Male</option>
                            <option value="other">Other</option>
                            <option value="unknown">Unknown</option>
                        </select>
                        <select
                            v-model="filters.sortBy"
                            class="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none"
                        >
                            <option value="createdAt">Newest first</option>
                            <option value="updatedAt">Recently updated</option>
                            <option value="firstName">First name</option>
                            <option value="lastName">Last name</option>
                            <option value="patientNumber">MRN</option>
                        </select>
                    </div>

                    <div v-if="list.isPending.value" class="space-y-2">
                        <Skeleton class="h-14 w-full" />
                        <Skeleton class="h-14 w-full" />
                        <Skeleton class="h-14 w-full" />
                    </div>

                    <Alert v-else-if="list.isError.value" variant="destructive">
                        <AlertTitle>Unable to load patients</AlertTitle>
                        <AlertDescription>{{ (list.error.value as Error | null)?.message ?? 'Unknown error.' }}</AlertDescription>
                    </Alert>

                    <div v-else-if="patients.length === 0" class="rounded-lg border border-dashed px-5 py-5">
                        <p class="text-sm font-medium text-foreground">No patients found</p>
                        <p class="mt-1 text-xs text-muted-foreground">Try adjusting the search query or status filter.</p>
                    </div>

                    <div v-else class="overflow-x-auto rounded-lg border">
                        <table class="w-full text-sm">
                            <thead class="border-b bg-muted/30 text-xs text-muted-foreground uppercase">
                                <tr>
                                    <th class="px-3 py-2 text-left">Patient</th>
                                    <th class="px-3 py-2 text-left">Status</th>
                                    <th class="px-3 py-2 text-left">Gender</th>
                                    <th class="px-3 py-2 text-left">Date of birth</th>
                                    <th class="px-3 py-2 text-left">Phone</th>
                                    <th class="px-3 py-2 text-left">Region / District</th>
                                    <th class="px-3 py-2 text-left">Registered</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="patient in patients" :key="patient.id" class="border-b last:border-b-0 hover:bg-muted/20">
                                    <td class="px-3 py-2">
                                        <div class="flex items-center gap-2.5">
                                            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                                {{ patientInitials(patient) }}
                                            </div>
                                            <div class="min-w-0">
                                                <p class="truncate font-medium text-foreground">{{ patientName(patient) }}</p>
                                                <p class="truncate text-xs text-muted-foreground">{{ patient.patientNumber || 'No MRN assigned' }}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-3 py-2">
                                        <Badge :variant="statusVariant(patient.status)">{{ patient.status || 'unknown' }}</Badge>
                                    </td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ patient.gender || '—' }}</td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ formatDate(patient.dateOfBirth) }}</td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ patient.phone || '—' }}</td>
                                    <td class="px-3 py-2 text-muted-foreground">
                                        {{ [patient.region, patient.district].filter(Boolean).join(' / ') || '—' }}
                                    </td>
                                    <td class="px-3 py-2 text-muted-foreground">{{ formatDate(patient.createdAt) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div v-if="meta && meta.lastPage > 1" class="flex items-center justify-between text-sm text-muted-foreground">
                        <p>Page {{ meta.currentPage }} of {{ meta.lastPage }} ({{ meta.total }} total)</p>
                        <div class="flex gap-2">
                            <Button size="sm" variant="outline" :disabled="meta.currentPage <= 1" @click="goToPage(meta.currentPage - 1)">
                                <AppIcon name="chevron-left" class="size-3.5" />Previous
                            </Button>
                            <Button size="sm" variant="outline" :disabled="meta.currentPage >= meta.lastPage" @click="goToPage(meta.currentPage + 1)">
                                Next<AppIcon name="chevron-right" class="size-3.5" />
                            </Button>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </AppLayout>
</template>
