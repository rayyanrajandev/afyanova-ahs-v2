<script setup lang="ts">
import { computed } from 'vue';
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { MasterDataSetupStep, MasterDataSetupStepKey } from '@/composables/useMasterDataSetupReadiness';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';

const props = defineProps<{
    currentStep: MasterDataSetupStepKey;
    steps: MasterDataSetupStep[];
    recommendedNextStep: MasterDataSetupStep | null;
    loading?: boolean;
}>();

const iconByStep: Record<MasterDataSetupStepKey, string> = {
    warehouses: 'building-2',
    suppliers: 'package',
    clinical: 'book-open',
    pricing: 'receipt',
    inventory: 'package',
    opening_stock: 'activity',
    department_requisitions: 'clipboard-list',
    procurement_requests: 'package',
};

const phaseByStep: Record<MasterDataSetupStepKey, string> = {
    warehouses: 'Foundation',
    suppliers: 'Foundation',
    clinical: 'Care model',
    pricing: 'Finance',
    inventory: 'Stock master',
    opening_stock: 'Go-live',
    department_requisitions: 'Live operations',
    procurement_requests: 'Live operations',
};

const currentStepConfig = computed(() => props.steps.find((step) => step.key === props.currentStep) ?? null);
const setupGuideHidden = useLocalStorageBoolean('facilitySetupSequence.hidden', false);
const readyCount = computed(() => props.steps.filter((step) => step.ready).length);
const pendingCount = computed(() => Math.max(props.steps.length - readyCount.value, 0));
const progressPercent = computed(() => {
    if (props.steps.length === 0) return 0;

    return Math.round((readyCount.value / props.steps.length) * 100);
});
const currentStepReady = computed(() => currentStepConfig.value?.ready ?? false);

const summaryText = computed(() => {
    if (props.loading) {
        return 'Refreshing readiness across facility setup, care catalog, pricing, stock, and first live operations.';
    }

    if (!currentStepConfig.value) {
        return 'Follow the master-data setup path so downstream workflows do not start from incomplete foundations.';
    }

    if (props.recommendedNextStep === null) {
        return 'Setup and first operational procurement checks are ready. The facility can continue into patient, order, billing, POS, transfer, and reporting workflows.';
    }

    if (props.recommendedNextStep.key === props.currentStep && !currentStepReady.value) {
        return `${currentStepConfig.value.label} is the current starting point. Finish this step before moving deeper into setup.`;
    }

    return `Next recommended step is ${props.recommendedNextStep.label}. ${currentStepConfig.value.label} is ${currentStepReady.value ? 'already in place' : 'still pending'}.`;
});

const nextActionLabel = computed(() => {
    if (props.recommendedNextStep === null) return 'Setup ready';
    if (props.recommendedNextStep.key === props.currentStep) return `Complete ${props.recommendedNextStep.label}`;
    return `Open ${props.recommendedNextStep.label}`;
});

function stepStatusLabel(step: MasterDataSetupStep): string {
    if (step.ready) return 'Ready';
    if (props.recommendedNextStep?.key === step.key) return 'Start here';
    return 'Pending';
}

function stepVariant(step: MasterDataSetupStep): 'default' | 'secondary' | 'outline' {
    if (step.key === props.currentStep && step.ready) return 'secondary';
    if (step.key === props.currentStep) return 'default';
    if (step.ready) return 'secondary';
    return 'outline';
}
</script>

<template>
    <Card v-if="setupGuideHidden" class="rounded-lg border-sidebar-border/70 bg-muted/20 shadow-sm">
        <CardContent class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex min-w-0 items-center gap-3">
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                    <AppIcon name="clipboard-list" class="size-4" />
                </div>
                <div class="min-w-0">
                    <p class="text-sm font-semibold">Facility setup sequence hidden</p>
                    <p class="truncate text-xs text-muted-foreground">
                        {{ recommendedNextStep ? `Next: ${recommendedNextStep.label}` : 'Setup ready for operations' }}
                    </p>
                </div>
            </div>
            <Button type="button" size="sm" variant="outline" class="h-8 shrink-0 gap-1.5" @click="setupGuideHidden = false">
                <AppIcon name="eye" class="size-3.5" />
                Show sequence
            </Button>
        </CardContent>
    </Card>

    <Card v-else class="overflow-hidden rounded-lg border-sidebar-border/70 bg-card/95 shadow-sm">
        <CardContent class="p-0">
            <div class="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.35fr)]">
                <div class="space-y-4 p-4 md:p-5">
                    <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div class="min-w-0 space-y-2">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between xl:justify-start">
                                <div class="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">Readiness Path</Badge>
                                    <Badge :variant="recommendedNextStep ? 'outline' : 'secondary'">
                                        {{ loading ? 'Refreshing' : `${readyCount}/${steps.length} ready` }}
                                    </Badge>
                                    <Badge v-if="pendingCount > 0" variant="outline">
                                        {{ pendingCount }} pending
                                    </Badge>
                                </div>
                            </div>
                            <div class="space-y-1">
                                <h2 class="text-lg font-semibold tracking-tight">Facility setup sequence</h2>
                                <p class="max-w-3xl text-sm text-muted-foreground">
                                    {{ summaryText }}
                                </p>
                            </div>
                        </div>

                        <div class="flex min-w-[11rem] flex-col gap-2 sm:flex-row sm:items-center xl:flex-col xl:items-stretch">
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                class="h-8 w-fit shrink-0 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground sm:order-2 xl:order-none xl:self-end"
                                @click="setupGuideHidden = true"
                            >
                                <AppIcon name="eye-off" class="size-3.5" />
                                Hide sequence
                            </Button>
                            <div class="rounded-lg border bg-background/70 px-3 py-2.5">
                                <div class="flex items-center justify-between gap-3">
                                    <span class="text-xs font-medium text-muted-foreground">Progress</span>
                                    <span class="text-sm font-semibold">{{ progressPercent }}%</span>
                                </div>
                                <div class="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                                    <div
                                        class="h-full rounded-full bg-primary transition-all duration-500"
                                        :style="{ width: `${progressPercent}%` }"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <Link
                            v-for="(step, index) in steps"
                            :key="step.key"
                            :href="step.href"
                            class="group min-w-0 rounded-lg border p-3 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:bg-muted/30 hover:shadow-sm"
                            :class="[
                                step.key === currentStep
                                    ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/10'
                                    : step.ready
                                        ? 'bg-background'
                                        : 'bg-muted/10',
                            ]"
                            :aria-current="step.key === currentStep ? 'step' : undefined"
                        >
                            <div class="flex items-start gap-2.5">
                                <div
                                    class="flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold"
                                    :class="step.ready ? 'border-primary/20 bg-primary/10 text-primary' : 'bg-background text-muted-foreground'"
                                >
                                    {{ index + 1 }}
                                </div>
                                <div class="min-w-0 flex-1 space-y-1">
                                    <div class="flex min-w-0 items-start justify-between gap-2">
                                        <div class="min-w-0">
                                            <p class="truncate text-sm font-semibold">{{ step.label }}</p>
                                            <p class="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                                {{ phaseByStep[step.key] }}
                                            </p>
                                        </div>
                                        <AppIcon
                                            :name="iconByStep[step.key]"
                                            class="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                                        />
                                    </div>
                                    <p class="line-clamp-2 min-h-8 text-xs leading-4 text-muted-foreground">
                                        {{ step.description }}
                                    </p>
                                    <div class="flex items-center justify-between gap-2 pt-1">
                                        <Badge :variant="stepVariant(step)" class="h-5 px-2 text-[10px]">
                                            {{ stepStatusLabel(step) }}
                                        </Badge>
                                        <span class="text-[11px] text-muted-foreground">
                                            {{ step.total ?? 'N/A' }} records
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>

                <div class="border-t bg-muted/20 p-4 lg:border-l lg:border-t-0 md:p-5">
                    <div class="flex h-full flex-col justify-between gap-4 rounded-lg border bg-background/80 p-4">
                        <div class="space-y-3">
                            <div class="flex items-center gap-2">
                                <div class="rounded-lg bg-primary/10 p-2 text-primary">
                                    <AppIcon
                                        :name="recommendedNextStep ? iconByStep[recommendedNextStep.key] : 'shield-check'"
                                        class="size-4"
                                    />
                                </div>
                                <div>
                                    <p class="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Next best action</p>
                                    <p class="text-sm font-semibold">
                                        {{ recommendedNextStep ? recommendedNextStep.label : 'Setup ready' }}
                                    </p>
                                </div>
                            </div>
                            <p class="text-sm text-muted-foreground">
                                <template v-if="recommendedNextStep">
                                    Complete this before moving deeper. It prevents fake stock, duplicated billing names, and broken downstream workflows.
                                </template>
                                <template v-else>
                                    The first setup and supply-chain smoke test are complete. Continue testing live hospital workflows.
                                </template>
                            </p>
                        </div>

                        <Button v-if="recommendedNextStep" size="sm" as-child class="w-full gap-1.5">
                            <Link :href="recommendedNextStep.href">
                                <AppIcon :name="iconByStep[recommendedNextStep.key]" class="size-3.5" />
                                {{ nextActionLabel }}
                            </Link>
                        </Button>
                        <Badge v-else variant="secondary" class="w-fit">Ready for operations</Badge>
                    </div>
                </div>
            </div>
        </CardContent>
    </Card>
</template>
