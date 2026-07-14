<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    useEncounterList,
    useEncounterListFilters,
    useEncounterStatusCounts,
    type EncounterListItem,
} from '@/composables/useEncounterList';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { medicalRecordNoteTypeLabel } from '@/pages/medical-records/noteTypes';
import { type BreadcrumbItem } from '@/types';

/**
 * Encounter-centric visit list. There was no dormant encounter-centric list
 * anywhere in the codebase to reuse — medical-records/Index.vue is
 * record-centric (one row per note), not encounter-centric — so this is
 * built fresh against the GET /encounters + /encounters/status-counts
 * endpoints, TanStack Query from the start rather than hand-rolled loading
 * refs. Brought to full V2 structural parity (bounded scroll container,
 * sticky header, real Tabs status filter) to match every other V2 page.
 */
const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Encounters', href: '/encounters' },
]);

const filters = useEncounterListFilters();
const encounters = useEncounterList(filters);
const statusCounts = useEncounterStatusCounts(filters);

const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'opened', label: 'Opened' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'ready_for_sign', label: 'Ready for sign' },
    { value: 'signed', label: 'Signed' },
    { value: 'closed', label: 'Closed' },
    { value: 'amended', label: 'Amended' },
    { value: 'cancelled', label: 'Cancelled' },
] as const;

function statusCount(status: string): number {
    if (!statusCounts.data.value) return 0;
    if (status === 'all') return statusCounts.data.value.total;
    return (statusCounts.data.value as Record<string, number>)[status] ?? 0;
}

function setStatus(value: string | number): void {
    filters.status = value === 'all' ? '' : String(value);
    filters.page = 1;
}

const { scrollContainerHeight } = useStickyScrollContainer();

function encounterStatusVariant(status: string | null) {
    switch (status) {
        case 'closed':
            return 'secondary' as const;
        case 'cancelled':
            return 'destructive' as const;
        case 'signed':
        case 'amended':
            return 'default' as const;
        default:
            return 'outline' as const;
    }
}

function noteStatusLabel(row: EncounterListItem): string {
    if (!row.hasMedicalRecord) return 'No note yet';
    const typeLabel = medicalRecordNoteTypeLabel(row.latestMedicalRecordType);
    return `${typeLabel} — ${row.latestMedicalRecordStatus}`;
}

function formatDateTime(value: string | null): string {
    if (!value) return 'N/A';
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

function resetFilters(): void {
    filters.q = '';
    filters.status = '';
    filters.patientId = '';
    filters.primaryClinicianUserId = '';
    filters.from = '';
    filters.to = '';
    filters.page = 1;
}

function goToPage(page: number): void {
    const last = encounters.data.value?.meta.lastPage ?? 1;
    filters.page = Math.max(1, Math.min(page, last));
}
</script>

<template>
    <Head title="Encounters" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <Tabs :model-value="filters.status || 'all'" class="contents" @update:model-value="setStatus">
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Encounters</h1>
                        <p class="text-xs text-muted-foreground">Every visit, regardless of whether a note has been started yet.</p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">{{ statusCount('all') }} encounters</Badge>
                        <Button variant="outline" size="sm" class="h-8 gap-1.5" @click="resetFilters()">
                            Clear filters
                        </Button>
                    </div>
                </div>

                <div class="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCount('all') }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Opened</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCount('opened') }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">In progress</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCount('in_progress') }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Ready for sign</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCount('ready_for_sign') }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Signed</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCount('signed') }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Closed</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCount('closed') }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Amended</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCount('amended') }}</p>
                    </div>
                    <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                        <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Cancelled</p>
                        <p class="text-sm font-bold tabular-nums">{{ statusCount('cancelled') }}</p>
                    </div>
                </div>

                <TabsList class="mt-3 grid w-full grid-cols-4 sm:grid-cols-8">
                    <TabsTrigger
                        v-for="option in statusOptions"
                        :key="option.value"
                        :value="option.value"
                        class="inline-flex items-center gap-1.5"
                    >
                        {{ option.label }}
                        <Badge variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                            {{ statusCount(option.value) }}
                        </Badge>
                    </TabsTrigger>
                </TabsList>
            </div>

            <div class="space-y-4 px-6 pb-6">
            <div class="flex flex-wrap items-start gap-2">
                <div class="relative min-w-72 flex-1">
                    <Input
                        v-model="filters.q"
                        placeholder="Search by patient or encounter number…"
                        class="h-9"
                        @update:model-value="filters.page = 1"
                    />
                </div>
                <Input v-model="filters.from" type="date" class="h-9 w-40" />
                <span class="text-xs text-muted-foreground self-center">to</span>
                <Input v-model="filters.to" type="date" class="h-9 w-40" />
            </div>

            <div v-if="encounters.isPending.value" class="space-y-2">
                <Skeleton class="h-16 w-full" />
                <Skeleton class="h-16 w-full" />
                <Skeleton class="h-16 w-full" />
            </div>

            <Alert v-else-if="encounters.isError.value" variant="destructive">
                <AlertTitle>Unable to load encounters</AlertTitle>
                <AlertDescription>
                    {{ encounters.error.value?.message ?? 'Unknown error.' }}
                </AlertDescription>
            </Alert>

            <div
                v-else-if="!encounters.data.value?.data.length"
                class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
            >
                No encounters match these filters.
            </div>

            <div v-else class="space-y-2">
                <Link
                    v-for="row in encounters.data.value.data"
                    :key="row.id"
                    :href="`/encounters/${row.id}`"
                    class="block rounded-lg border bg-card p-3 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/20"
                >
                    <div
                        class="flex flex-wrap items-start justify-between gap-3"
                    >
                        <div class="min-w-0 space-y-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <p class="font-medium text-foreground">
                                    {{ row.patientName ?? 'Unknown patient' }}
                                </p>
                                <span
                                    v-if="row.patientNumber"
                                    class="text-xs text-muted-foreground"
                                    >{{ row.patientNumber }}</span
                                >
                            </div>
                            <p class="text-xs text-muted-foreground">
                                {{ row.encounterNumber }} ·
                                {{ noteStatusLabel(row) }}
                                <span v-if="row.primaryClinicianName">
                                    · {{ row.primaryClinicianName }}</span
                                >
                            </p>
                        </div>
                        <div class="flex shrink-0 flex-col items-end gap-1">
                            <Badge
                                :variant="encounterStatusVariant(row.status)"
                            >
                                {{ row.status }}
                            </Badge>
                            <p class="text-[11px] text-muted-foreground">
                                {{
                                    row.closedAt
                                        ? `Closed ${formatDateTime(row.closedAt)}`
                                        : `Opened ${formatDateTime(row.openedAt)}`
                                }}
                            </p>
                        </div>
                    </div>
                </Link>

                <div
                    v-if="encounters.data.value.meta.lastPage > 1"
                    class="flex items-center justify-between pt-2"
                >
                    <Button
                        size="sm"
                        variant="outline"
                        :disabled="filters.page <= 1"
                        @click="goToPage(filters.page - 1)"
                    >
                        Previous
                    </Button>
                    <p class="text-xs text-muted-foreground">
                        Page {{ encounters.data.value.meta.currentPage }} of
                        {{ encounters.data.value.meta.lastPage }} ·
                        {{ encounters.data.value.meta.total }} total
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        :disabled="
                            filters.page >= encounters.data.value.meta.lastPage
                        "
                        @click="goToPage(filters.page + 1)"
                    >
                        Next
                    </Button>
                </div>
            </div>
            </div>
            </Tabs>
        </div>
    </AppLayout>
</template>
