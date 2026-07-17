<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';

import type { SupplyChainSection } from '@/lib/inventoryProcurement';
import { nextActionClass, type RequestPipelineStage, type SupplyChainNextAction } from '../supplyChainOverview';

defineProps<{
    nextActions: SupplyChainNextAction[];
    requestPipelineStages: RequestPipelineStage[];
}>();

const emit = defineEmits<{
    'change-tab': [tab: SupplyChainSection];
    'refresh-pipeline': [];
    'open-pipeline-stage': [stage: RequestPipelineStage];
}>();
</script>

<template>
    <div class="flex flex-col gap-4 p-4">
        <section class="space-y-3">
            <div>
                <h3 class="text-base font-semibold">Request Pipeline</h3>
                <p class="mt-1 text-sm text-muted-foreground">
                    Department demand flows: requisition → issue or shortage → procurement → receipt → issue.
                </p>
            </div>

            <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
                <button
                    v-for="stage in requestPipelineStages"
                    :key="stage.key"
                    type="button"
                    class="group relative rounded-lg border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-muted/20"
                    @click="emit('open-pipeline-stage', stage)"
                >
                    <div class="flex items-start justify-between gap-2">
                        <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground group-hover:text-foreground">
                            <AppIcon :name="stage.icon" class="size-4" />
                        </span>
                        <span class="text-xl font-bold leading-none tabular-nums">{{ stage.value }}</span>
                    </div>
                    <p class="mt-3 text-sm font-semibold leading-tight">{{ stage.label }}</p>
                    <p class="mt-1 min-h-8 text-xs leading-relaxed text-muted-foreground">{{ stage.helper }}</p>
                </button>
            </div>
        </section>

        <div class="border-t border-sidebar-border/60"></div>

        <div class="grid gap-6 xl:grid-cols-3">
            <section class="space-y-4 xl:col-span-2">
                <div>
                    <h3 class="text-base font-semibold">Operations Queue</h3>
                    <p class="mt-1 text-sm text-muted-foreground">Start with work that changes patient-facing stock availability.</p>
                </div>

                <div class="grid gap-3">
                    <button type="button" class="rounded-lg border bg-muted/10 p-3 text-left transition hover:border-primary/40 sm:max-w-xs" @click="emit('change-tab', 'transfers')">
                        <AppIcon name="activity" class="mb-2 size-4 text-muted-foreground" />
                        <p class="text-sm font-medium">Transfers</p>
                        <p class="mt-1 text-xs text-muted-foreground">Pack, dispatch, receive, and review variance.</p>
                    </button>
                </div>
            </section>

            <section class="space-y-4 xl:border-l xl:border-sidebar-border/60 xl:pl-6">
                <div>
                    <h3 class="text-base font-semibold">Supervisor Tools</h3>
                    <p class="mt-1 text-sm text-muted-foreground">Use these after the immediate queues are under control.</p>
                </div>

                <div class="grid gap-2">
                    <Button variant="outline" class="justify-start gap-2" @click="emit('change-tab', 'inventory')">
                        <AppIcon name="package" class="size-4" />
                        Item master and stock alerts
                    </Button>
                    <Button variant="outline" class="justify-start gap-2" @click="emit('change-tab', 'procurement')">
                        <AppIcon name="clipboard-list" class="size-4" />
                        Procurement requests
                    </Button>
                    <Button variant="outline" class="justify-start gap-2" @click="emit('change-tab', 'msd-orders')">
                        <AppIcon name="package" class="size-4" />
                        MSD order drafts
                    </Button>
                    <Button variant="outline" class="justify-start gap-2" @click="emit('change-tab', 'analytics')">
                        <AppIcon name="activity" class="size-4" />
                        Analytics
                    </Button>
                </div>
            </section>
        </div>
    </div>
</template>


