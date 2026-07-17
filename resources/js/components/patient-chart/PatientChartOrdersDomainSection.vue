<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { EncounterLifecycleAction, EncounterLifecycleTargetKind } from '@/lib/encounterWorkspaceLifecycle';
import type { PatientChartOrderCardViewModel } from '@/composables/patientChart/patientChartOrderCardViewModel';
import PatientChartOrderCard from '@/components/patient-chart/PatientChartOrderCard.vue';

defineProps<{
    title: string;
    activeCount: number;
    completedCount: number;
    activeLabel: string;
    completedLabel: string;
    isLoading: boolean;
    error: string | null;
    emptyTitle: string;
    emptyDescription: string;
    scopeLabel: string;
    scopeDescription: string;
    cards: PatientChartOrderCardViewModel[];
    criticalAlertTitle?: string | null;
    criticalAlertDescription?: string | null;
    createHref?: string | null;
    createLabel?: string | null;
    createIcon?: string;
}>();

defineEmits<{
    'lifecycle-action': [kind: EncounterLifecycleTargetKind, id: string, action: EncounterLifecycleAction, defaultReason: string | null];
    'review-lab-result': [id: string];
}>();
</script>

<template>
    <Card class="rounded-lg">
        <CardHeader class="pb-3">
            <CardTitle>{{ title }}</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
            <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                    <p class="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">{{ activeLabel }}</p>
                    <p class="mt-1.5 text-lg font-semibold text-foreground">{{ activeCount }}</p>
                </div>
                <div class="rounded-lg border bg-muted/20 px-3 py-2.5">
                    <p class="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">{{ completedLabel }}</p>
                    <p class="mt-1.5 text-lg font-semibold text-foreground">{{ completedCount }}</p>
                </div>
            </div>

            <div class="rounded-lg border bg-muted/10 px-3 py-3">
                <template v-if="isLoading">
                    <Skeleton class="h-4 w-40 rounded-lg" />
                    <Skeleton class="mt-2 h-3 w-full rounded-lg" />
                </template>
                <template v-else-if="error">
                    <p class="text-sm text-destructive">{{ error }}</p>
                </template>
                <template v-else-if="cards.length === 0">
                    <p class="text-sm font-medium text-foreground">{{ emptyTitle }}</p>
                    <p class="mt-1 text-xs text-muted-foreground">{{ emptyDescription }}</p>
                </template>
                <template v-else>
                    <div class="space-y-3" aria-live="polite" aria-atomic="false">
                        <Alert v-if="criticalAlertTitle" variant="destructive" role="alert">
                            <AppIcon name="alert-triangle" class="size-4" aria-hidden="true" />
                            <AlertTitle>{{ criticalAlertTitle }}</AlertTitle>
                            <AlertDescription>{{ criticalAlertDescription }}</AlertDescription>
                        </Alert>
                        <div>
                            <p class="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">{{ scopeLabel }}</p>
                            <p class="mt-1 text-xs text-muted-foreground">{{ scopeDescription }}</p>
                        </div>
                        <div class="grid gap-2">
                            <PatientChartOrderCard
                                v-for="card in cards"
                                :key="`chart-order-${card.kind}-${card.id}`"
                                :card="card"
                                @lifecycle-action="(...args) => $emit('lifecycle-action', ...args)"
                                @review-lab-result="(id) => $emit('review-lab-result', id)"
                            />
                        </div>
                    </div>
                </template>
            </div>

            <div v-if="createHref" class="flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" class="gap-1.5" as-child>
                    <Link :href="createHref"><AppIcon :name="createIcon ?? 'plus'" class="size-3.5" />{{ createLabel }}</Link>
                </Button>
            </div>
        </CardContent>
    </Card>
</template>
