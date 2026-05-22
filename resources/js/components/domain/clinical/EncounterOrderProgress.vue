<script setup lang="ts">
import { computed } from 'vue';
import { Badge } from '@/components/ui/badge';
import {
    buildLaboratoryOrderProgressSteps,
    buildPharmacyOrderProgressSteps,
    buildRadiologyOrderProgressSteps,
    buildTheatreProcedureProgressSteps,
    encounterOrderResultPreview,
    type EncounterOrderProgressStep,
} from '@/lib/encounterOrderProgress';

const props = defineProps<{
    orderType: 'laboratory' | 'pharmacy' | 'radiology' | 'theatre';
    order: Record<string, unknown>;
    formatDateTime: (value: string | null | undefined) => string;
}>();

const resultPreview = computed(() =>
    encounterOrderResultPreview(
        props.orderType,
        props.order as {
            resultSummary?: string | null;
            reportSummary?: string | null;
        },
    ),
);

const steps = computed<EncounterOrderProgressStep[]>(() => {
    const order = props.order as {
        status?: string | null;
        orderedAt?: string | null;
        resultedAt?: string | null;
        dispensedAt?: string | null;
        completedAt?: string | null;
        enteredInErrorAt?: string | null;
    };

    switch (props.orderType) {
        case 'laboratory':
            return buildLaboratoryOrderProgressSteps(order, props.formatDateTime);
        case 'pharmacy':
            return buildPharmacyOrderProgressSteps(order, props.formatDateTime);
        case 'radiology':
            return buildRadiologyOrderProgressSteps(order, props.formatDateTime);
        case 'theatre':
            return buildTheatreProcedureProgressSteps(
                props.order as {
                    status?: string | null;
                    scheduledAt?: string | null;
                    startedAt?: string | null;
                    completedAt?: string | null;
                    enteredInErrorAt?: string | null;
                    theatreRoomName?: string | null;
                    notes?: string | null;
                },
                props.formatDateTime,
            );
    }
});

function stepBadgeVariant(
    state: EncounterOrderProgressStep['state'],
): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (state) {
        case 'complete':
            return 'secondary';
        case 'current':
            return 'default';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
}
</script>

<template>
    <div class="space-y-2">
        <div
            v-if="resultPreview"
            class="rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/20"
        >
            <p class="text-[11px] font-medium uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
                Result preview
            </p>
            <p class="mt-1 text-sm leading-6 text-emerald-950 dark:text-emerald-50">
                {{ resultPreview }}
            </p>
        </div>

        <ol class="flex flex-wrap items-center gap-2">
            <li
                v-for="(step, index) in steps"
                :key="step.key"
                class="flex items-center gap-2"
            >
                <Badge :variant="stepBadgeVariant(step.state)" class="gap-1 text-[10px]">
                    {{ step.label }}
                    <span v-if="step.detail" class="font-normal opacity-80">
                        · {{ step.detail }}
                    </span>
                </Badge>
                <span
                    v-if="index < steps.length - 1"
                    class="hidden text-[10px] text-muted-foreground sm:inline"
                    aria-hidden="true"
                >
                    →
                </span>
            </li>
        </ol>
    </div>
</template>
