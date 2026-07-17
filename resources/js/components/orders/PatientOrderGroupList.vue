<script setup lang="ts" generic="T extends DirectServiceOrderLike">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
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
            <!--
                Not CollapsibleTrigger: that renders one real <button> around
                everything inside it, and the patient-name popover trigger
                needs to be its own independently-focusable control in the
                same header — nesting a role="button" span inside a real
                <button> is invalid and unreliable for AT/keyboard users
                (see reports/v2-navigation-actions-ux-audit.md §8.1). Instead
                the header is a plain clickable div (mouse convenience only —
                not required for a11y) with two real, sibling <button>s: the
                patient name (opens the popover) and the chevron (toggles
                expansion, with aria-expanded/aria-controls wired manually
                since Collapsible's own trigger isn't used).
            -->
            <div
                class="flex w-full cursor-pointer items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40"
                @click="emit('update:expanded', group.patientId, !isExpanded(group.patientId))"
            >
                <div class="min-w-0 space-y-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <PatientSummaryPopover :patient-id="group.patientId">
                            <template #trigger>
                                <button
                                    type="button"
                                    class="text-sm font-semibold text-foreground hover:underline"
                                    @click.stop
                                >
                                    {{ group.patientLabel }}
                                </button>
                            </template>
                            <template #actions>
                                <Link :href="`/patients/${group.patientId}/chart`" class="text-xs font-medium text-primary hover:underline">
                                    View chart
                                </Link>
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
                <button
                    type="button"
                    class="flex shrink-0 items-center pt-0.5"
                    :aria-expanded="isExpanded(group.patientId)"
                    :aria-controls="`patient-order-group-${group.patientId}`"
                    :aria-label="isExpanded(group.patientId) ? 'Collapse patient orders' : 'Expand patient orders'"
                    @click.stop="emit('update:expanded', group.patientId, !isExpanded(group.patientId))"
                >
                    <AppIcon
                        name="chevron-down"
                        :class="['chevron size-4 text-muted-foreground transition-transform duration-200', isExpanded(group.patientId) ? 'rotate-180' : '']"
                    />
                </button>
            </div>
            <CollapsibleContent :id="`patient-order-group-${group.patientId}`">
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
