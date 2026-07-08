<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { EncounterLifecycleAction, EncounterLifecycleTargetKind } from '@/lib/encounterWorkspaceLifecycle';
import type { PatientChartOrderCardViewModel } from '@/composables/patientChart/patientChartOrderCardViewModel';

const props = defineProps<{
    card: PatientChartOrderCardViewModel;
}>();

const emit = defineEmits<{
    'lifecycle-action': [kind: EncounterLifecycleTargetKind, id: string, action: EncounterLifecycleAction, defaultReason: string | null];
}>();

function openLifecycleAction(action: EncounterLifecycleAction): void {
    emit('lifecycle-action', props.card.kind, props.card.id, action, props.card.defaultCancelReason);
}
</script>

<template>
    <div :class="['rounded-lg border px-3 py-2.5', card.surfaceClass]">
        <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
                <p class="truncate text-sm font-medium text-foreground">{{ card.title }}</p>
                <p class="mt-1 text-xs text-muted-foreground">{{ card.metaLine }}</p>
            </div>
            <Badge :variant="card.statusVariant">{{ card.statusLabel }}</Badge>
        </div>

        <div v-if="card.signal" class="mt-2 flex flex-wrap items-center gap-2">
            <Badge :variant="card.signal.variant">{{ card.signal.label }}</Badge>
        </div>

        <p class="mt-2 text-xs text-muted-foreground">{{ card.summary }}</p>

        <p v-if="card.linkageText" class="mt-1 text-xs text-muted-foreground">{{ card.linkageText }}</p>

        <div
            v-if="card.nextActionLabel || card.reorderHref || card.addOnHref || card.moreActions.length > 0"
            class="mt-3 flex flex-wrap items-center gap-2"
        >
            <Button v-if="card.nextActionLabel && card.nextActionHref" size="sm" :variant="card.nextActionVariant" as-child class="h-9 gap-1.5 px-2.5 text-xs">
                <Link :href="card.nextActionHref"><AppIcon :name="card.nextActionIcon" class="size-3.5" />{{ card.nextActionLabel }}</Link>
            </Button>
            <Button v-if="card.reorderHref" size="sm" variant="outline" as-child class="h-9 gap-1.5 px-2.5 text-xs">
                <Link :href="card.reorderHref">Reorder</Link>
            </Button>
            <Button v-if="card.addOnHref" size="sm" variant="outline" as-child class="h-9 gap-1.5 px-2.5 text-xs">
                <Link :href="card.addOnHref">Add linked test</Link>
            </Button>
            <DropdownMenu v-if="card.moreActions.length > 0">
                <DropdownMenuTrigger as-child>
                    <Button size="sm" variant="outline" class="h-9 gap-1.5 px-2.5 text-xs">More</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" class="w-48">
                    <template v-for="(action, index) in card.moreActions" :key="action.action">
                        <DropdownMenuSeparator v-if="index > 0" />
                        <DropdownMenuItem class="cursor-pointer text-sm" @select="openLifecycleAction(action.action)">
                            {{ action.label }}
                        </DropdownMenuItem>
                    </template>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>

        <p v-if="card.workflowHint" class="mt-2 text-xs leading-4 text-muted-foreground">{{ card.workflowHint }}</p>
    </div>
</template>
