<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type StaffGovernanceSetupStep = {
    id: string;
    label: string;
    detail: string;
    status: 'complete' | 'current' | 'upcoming' | 'skipped' | 'blocked';
};

const props = withDefaults(
    defineProps<{
        steps: StaffGovernanceSetupStep[];
        title?: string;
        description?: string;
        compact?: boolean;
    }>(),
    {
        title: 'Setup checklist',
        description: 'Follow these steps in order. New clinical staff often show as incomplete until regulatory data is recorded — that is expected.',
        compact: false,
    },
);

function statusLabel(status: StaffGovernanceSetupStep['status']): string {
    switch (status) {
        case 'complete':
            return 'Done';
        case 'current':
            return 'Next step';
        case 'blocked':
            return 'Needs attention';
        case 'skipped':
            return 'Not required';
        default:
            return 'Later';
    }
}

function statusBadgeVariant(status: StaffGovernanceSetupStep['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (status) {
        case 'complete':
            return 'secondary';
        case 'current':
            return 'default';
        case 'blocked':
            return 'destructive';
        case 'skipped':
            return 'outline';
        default:
            return 'outline';
    }
}

function iconName(status: StaffGovernanceSetupStep['status']): 'circle-check-big' | 'alert-triangle' | null {
    switch (status) {
        case 'complete':
            return 'circle-check-big';
        case 'blocked':
            return 'alert-triangle';
        default:
            return null;
    }
}
</script>

<template>
    <Card
        :class="
            cn(
                '!gap-0 overflow-hidden rounded-md border-border/50 bg-card/70 !py-0 shadow-none',
                props.compact && 'border-dashed',
            )
        "
    >
        <CardHeader class="border-b border-border/40 bg-muted/15 px-3 py-2">
            <CardTitle class="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <AppIcon name="clipboard-list" class="size-3.5" />
                {{ title }}
            </CardTitle>
            <CardDescription v-if="description && !compact" class="text-xs normal-case tracking-normal">
                {{ description }}
            </CardDescription>
        </CardHeader>
        <CardContent class="divide-y divide-border/50 px-3 py-0">
            <div
                v-for="(step, index) in steps"
                :key="step.id"
                class="flex items-start gap-3 py-2.5"
                :class="step.status === 'current' ? 'bg-primary/5 -mx-3 px-3' : ''"
            >
                <div
                    class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold"
                    :class="
                        step.status === 'complete'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : step.status === 'current'
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : step.status === 'blocked'
                                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                                : 'border-border bg-muted/40 text-muted-foreground'
                    "
                >
                    <AppIcon v-if="iconName(step.status)" :name="iconName(step.status)!" class="size-3.5" />
                    <span v-else>{{ index + 1 }}</span>
                </div>
                <div class="min-w-0 flex-1 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm font-medium">{{ step.label }}</p>
                        <Badge :variant="statusBadgeVariant(step.status)" class="h-5 px-1.5 text-[10px] leading-none">
                            {{ statusLabel(step.status) }}
                        </Badge>
                    </div>
                    <p class="text-xs text-muted-foreground">{{ step.detail }}</p>
                </div>
            </div>
        </CardContent>
    </Card>
</template>
