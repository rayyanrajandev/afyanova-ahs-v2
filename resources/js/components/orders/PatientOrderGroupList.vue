<script setup lang="ts" generic="T extends DirectServiceOrderLike">
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import PatientSummaryPopover from '@/components/patients/summary/PatientSummaryPopover.vue';
import type { DirectServiceOrderLike, PatientOrderGroup } from '@/lib/directServicePatientWorklist';

defineProps<{
    groups: PatientOrderGroup<T>[];
    isExpanded: (patientId: string) => boolean;
    compact?: boolean;
}>();

defineSlots<{
    orders: (props: { group: PatientOrderGroup<T> }) => unknown;
}>();

const emit = defineEmits<{
    'update:expanded': [patientId: string, open: boolean];
}>();
</script>

<template>
    <div :class="compact ? 'space-y-2' : 'space-y-3'">
        <Collapsible
            v-for="group in groups"
            :key="group.patientId"
            :open="isExpanded(group.patientId)"
            class="overflow-hidden rounded-lg border bg-background"
            @update:open="(open) => emit('update:expanded', group.patientId, open)"
        >
            <CollapsibleTrigger
                class="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40 [&[data-state=open]>div>.chevron]:rotate-180"
            >
                <div class="min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <PatientSummaryPopover :patient-id="group.patientId">
                            <template #trigger>
                                <span
                                    role="button"
                                    tabindex="0"
                                    class="text-sm font-semibold text-foreground hover:underline"
                                    @click.stop
                                    @keydown.enter.stop
                                    @keydown.space.stop.prevent
                                >
                                    {{ group.patientLabel }}
                                </span>
                            </template>
                            <template #actions>
                                <a :href="`/patients/${group.patientId}/chart`" class="text-xs font-medium text-primary hover:underline">
                                    View chart
                                </a>
                            </template>
                        </PatientSummaryPopover>
                        <Badge variant="secondary" class="tabular-nums">
                            {{ group.orders.length }}
                            {{ group.orders.length === 1 ? 'order' : 'orders' }}
                        </Badge>
                        <Badge variant="outline">
                            {{ group.summaryStatus }}
                        </Badge>
                    </div>
                    <p v-if="group.patientMeta" class="text-xs text-muted-foreground">
                        {{ group.patientMeta }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                        {{ group.summarySubtitle }}
                    </p>
                </div>
                <div class="flex shrink-0 items-center pt-0.5">
                    <AppIcon
                        name="chevron-down"
                        class="chevron size-4 text-muted-foreground transition-transform duration-200"
                    />
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div
                    class="space-y-2 border-t bg-muted/10 p-2"
                    :class="compact ? 'space-y-2' : 'space-y-3'"
                >
                    <slot name="orders" :group="group" />
                </div>
            </CollapsibleContent>
        </Collapsible>
    </div>
</template>
