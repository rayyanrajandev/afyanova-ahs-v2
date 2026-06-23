<script setup lang="ts">
import { computed } from 'vue';
import { Badge } from '@/components/ui/badge';

const props = defineProps<{
    currentStep: number;
    totalSteps: number;
    status: string;
}>();

const isComplete = computed(() => ['approved', 'rejected', 'recalled'].includes(props.status));

const steps = computed(() => {
    const result = [];
    for (let i = 1; i <= props.totalSteps; i++) {
        const isCurrent = i === props.currentStep && !isComplete.value;
        const isDone = i < props.currentStep || (i === props.currentStep && isComplete.value);
        result.push({ step: i, label: `Step ${i}`, isCurrent, isDone });
    }
    return result;
});

const statusBadgeVariant = computed(() => {
    switch (props.status) {
        case 'approved': return 'default' as const;
        case 'rejected': return 'destructive' as const;
        case 'recalled': return 'secondary' as const;
        default: return 'secondary' as const;
    }
});

const statusLabel = computed(() => {
    return props.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
});
</script>

<template>
    <div class="space-y-2">
        <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-muted-foreground">Workflow Progress</span>
            <Badge v-if="isComplete" :variant="statusBadgeVariant" class="text-[10px]">{{ statusLabel }}</Badge>
        </div>
        <div class="flex items-center gap-1">
            <template v-for="(step, idx) in steps" :key="step.step">
                <div class="flex items-center gap-1">
                    <div
                        class="flex size-6 items-center justify-center rounded-full text-[11px] font-medium"
                        :class="step.isDone ? 'bg-primary text-primary-foreground' : step.isCurrent ? 'ring-2 ring-primary ring-offset-1 bg-primary/10 text-primary font-semibold' : 'bg-muted text-muted-foreground'"
                    >{{ step.step }}</div>
                    <span v-if="step.isCurrent && !isComplete" class="text-[11px] font-medium text-primary">{{ step.label }}</span>
                </div>
                <div v-if="idx < steps.length - 1" class="h-px flex-1 bg-border mx-1" :class="step.isDone ? 'bg-primary' : ''"></div>
            </template>
        </div>
    </div>
</template>
