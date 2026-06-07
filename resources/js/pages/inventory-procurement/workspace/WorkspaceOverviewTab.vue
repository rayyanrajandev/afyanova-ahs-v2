<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { InventoryWorkspaceSection } from '@/lib/inventoryProcurement';
import { nextActionClass, type RequestPipelineStage, type WorkspaceNextAction } from './workspaceOverview';

defineProps<{
    workspaceNextActions: WorkspaceNextAction[];
    requestPipelineStages: RequestPipelineStage[];
    requisitionsReadyCount: number;
    requisitionsWaitingCount: number;
    departmentRequisitionTotal: number;
}>();

const emit = defineEmits<{
    'change-tab': [tab: InventoryWorkspaceSection];
    'refresh-pipeline': [];
    'open-pipeline-stage': [stage: RequestPipelineStage];
}>();
</script>

<template>
    <div class="flex flex-col gap-4">
        <div class="grid gap-3 lg:grid-cols-4">
            <button
                v-for="action in workspaceNextActions"
                :key="action.key"
                type="button"
                :class="[
                    'rounded-lg border px-4 py-3 text-left shadow-sm transition hover:border-primary/40',
                    nextActionClass(action.tone),
                ]"
                @click="emit('change-tab', action.target)"
            >
                <div class="flex items-start justify-between gap-3">
                    <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/70">
                        <AppIcon :name="action.icon" class="size-4" />
                    </span>
                    <span class="text-2xl font-bold leading-none tabular-nums">{{ action.value }}</span>
                </div>
                <p class="mt-3 text-sm font-semibold">{{ action.label }}</p>
                <p class="mt-1 text-xs leading-relaxed opacity-80">{{ action.helper }}</p>
            </button>
        </div>

        <Card class="rounded-lg border-sidebar-border/70 shadow-sm">
            <CardHeader class="pb-3">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <CardTitle class="text-base">Request Pipeline</CardTitle>
                        <CardDescription>
                            Department demand flows: requisition → issue or shortage → procurement → receipt → issue.
                        </CardDescription>
                    </div>
                    <Button size="sm" variant="outline" class="h-8 gap-1.5 text-xs" @click="emit('refresh-pipeline')">
                        <AppIcon name="refresh-cw" class="size-3.5" />
                        Refresh pipeline
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
                    <button
                        v-for="stage in requestPipelineStages"
                        :key="stage.key"
                        type="button"
                        class="group relative rounded-lg border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-muted/20"
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
            </CardContent>
        </Card>

        <div class="grid gap-4 xl:grid-cols-3">
            <Card class="rounded-lg border-sidebar-border/70 shadow-sm xl:col-span-2">
                <CardHeader class="pb-2">
                    <CardTitle class="text-base">Operations Queue</CardTitle>
                    <CardDescription>Start with work that changes patient-facing stock availability.</CardDescription>
                </CardHeader>
                <CardContent class="grid gap-3 sm:grid-cols-3">
                    <button type="button" class="rounded-lg border bg-muted/10 p-3 text-left transition hover:border-primary/40" @click="emit('change-tab', 'shortage-queue')">
                        <AppIcon name="alert-triangle" class="mb-2 size-4 text-muted-foreground" />
                        <p class="text-sm font-medium">Shortage queue</p>
                        <p class="mt-1 text-xs text-muted-foreground">{{ requisitionsReadyCount }} ready, {{ requisitionsWaitingCount }} waiting.</p>
                    </button>
                    <button type="button" class="rounded-lg border bg-muted/10 p-3 text-left transition hover:border-primary/40" @click="emit('change-tab', 'requisitions')">
                        <AppIcon name="clipboard-list" class="mb-2 size-4 text-muted-foreground" />
                        <p class="text-sm font-medium">Department requisitions</p>
                        <p class="mt-1 text-xs text-muted-foreground">{{ departmentRequisitionTotal }} request{{ departmentRequisitionTotal === 1 ? '' : 's' }} in view.</p>
                    </button>
                    <button type="button" class="rounded-lg border bg-muted/10 p-3 text-left transition hover:border-primary/40" @click="emit('change-tab', 'transfers')">
                        <AppIcon name="activity" class="mb-2 size-4 text-muted-foreground" />
                        <p class="text-sm font-medium">Transfers</p>
                        <p class="mt-1 text-xs text-muted-foreground">Pack, dispatch, receive, and review variance.</p>
                    </button>
                </CardContent>
            </Card>

            <Card class="rounded-lg border-sidebar-border/70 shadow-sm">
                <CardHeader class="pb-2">
                    <CardTitle class="text-base">Supervisor Tools</CardTitle>
                    <CardDescription>Use these after the immediate queues are under control.</CardDescription>
                </CardHeader>
                <CardContent class="grid gap-2">
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
                </CardContent>
            </Card>
        </div>
    </div>
</template>
