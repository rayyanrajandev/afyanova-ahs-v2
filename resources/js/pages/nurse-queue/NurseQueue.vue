<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import AppLayout from '@/layouts/AppLayout.vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import QuickAssessmentDialog from '@/components/nurse-queue/QuickAssessmentDialog.vue';
import { useNurseQueue, useNurseQueueFilters, type NurseQueueEncounter } from '@/composables/nurse-queue/useNurseQueue';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import { type BreadcrumbItem } from '@/types';

const { hasPermission, isFacilitySuperAdmin } = usePlatformAccess();

function hasAccess(permission: string): boolean {
    return isFacilitySuperAdmin.value || hasPermission(permission);
}

const canRead = computed(() => hasAccess('service.requests.read'));
const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Nurse Queue', href: '/nurse-queue' },
]);

const filters = useNurseQueueFilters();
const list = useNurseQueue(filters);
const queryClient = useQueryClient();

const encounters = computed(() => list.data.value?.data ?? []);
const meta = computed(() => list.data.value?.meta ?? null);
const waitingCount = computed(() => meta.value?.total ?? 0);

function formatDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function waitTimeMinutes(openedAt: string | null | undefined): number | null {
    if (!openedAt) return null;
    const diff = Date.now() - new Date(openedAt).getTime();
    return Math.floor(diff / 60000);
}

function patientName(encounter: NurseQueueEncounter): string {
    const p = encounter.patient;
    if (!p) return 'Unknown';
    return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || 'Unknown';
}

function patientGenderAge(encounter: NurseQueueEncounter): string {
    const p = encounter.patient;
    if (!p) return '';
    const parts: string[] = [];
    if (p.gender) parts.push(p.gender.toUpperCase());
    if (p.age !== null && p.age !== undefined) parts.push(`${p.age}y`);
    return parts.join(', ');
}

/* Assessment dialog */
const assessmentDialogOpen = ref(false);
const assessmentEncounter = ref<NurseQueueEncounter | null>(null);

function openAssessment(encounter: NurseQueueEncounter): void {
    assessmentEncounter.value = encounter;
    assessmentDialogOpen.value = true;
}

async function invalidateQueue(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['nurse-queue'] });
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Nurse Queue" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <h1 class="text-lg font-bold tracking-tight md:text-xl">Nurse Queue</h1>
                        <p class="text-xs text-muted-foreground">Patients awaiting nurse assessment.</p>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">{{ waitingCount }} waiting</Badge>
                    </div>
                </div>
            </div>

            <div class="space-y-4 px-6 pb-6">
                <Alert v-if="!canRead" variant="destructive">
                    <AlertTitle>Access required</AlertTitle>
                    <AlertDescription>Viewing the nurse queue requires <code>service.requests.read</code>.</AlertDescription>
                </Alert>

                <template v-else>
                    <div v-if="list.isPending.value" class="space-y-2">
                        <Skeleton class="h-20 w-full" />
                        <Skeleton class="h-20 w-full" />
                        <Skeleton class="h-20 w-full" />
                    </div>

                    <Alert v-else-if="list.isError.value" variant="destructive">
                        <AlertTitle>Unable to load nurse queue</AlertTitle>
                        <AlertDescription>{{ list.error.value?.message ?? 'Unknown error.' }}</AlertDescription>
                    </Alert>

                    <div
                        v-else-if="encounters.length === 0"
                        class="rounded-lg bg-muted/25 px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border/30"
                    >
                        No patients waiting for nurse assessment.
                    </div>

                    <ul v-else class="space-y-2">
                        <li
                            v-for="encounter in encounters"
                            :key="encounter.id"
                            class="rounded-lg border bg-card px-4 py-3 shadow-sm transition-colors"
                        >
                            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div class="min-w-0 flex-1 space-y-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <p class="truncate text-sm font-medium text-foreground">
                                            {{ patientName(encounter) }}
                                        </p>
                                        <span class="text-xs text-muted-foreground">
                                            {{ patientGenderAge(encounter) }}
                                        </span>
                                        <Badge variant="outline" class="text-[10px]">
                                            {{ encounter.patient?.patientNumber || '—' }}
                                        </Badge>
                                        <span class="text-xs text-muted-foreground">
                                            ⏱ {{ waitTimeMinutes(encounter.openedAt) }} min
                                        </span>
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        Checked in {{ formatDateTime(encounter.openedAt) }}
                                    </p>
                                </div>
                                <div class="flex shrink-0 items-center gap-1.5">
                                    <Button
                                        size="sm"
                                        class="h-7 px-2 text-xs"
                                        @click="openAssessment(encounter)"
                                    >
                                        Start Assessment
                                        <AppIcon name="chevron-right" class="ml-0.5 size-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </li>
                    </ul>
                </template>
            </div>

            <QuickAssessmentDialog
                v-if="assessmentEncounter"
                v-model:open="assessmentDialogOpen"
                :encounter="assessmentEncounter"
                @completed="invalidateQueue"
            />
        </div>
    </AppLayout>
</template>
