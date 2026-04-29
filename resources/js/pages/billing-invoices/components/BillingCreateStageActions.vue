<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const props = defineProps({
    createInvoiceStage: { type: String, required: true },
    createDraftSaveGuidanceDescription: { type: String, required: true },
    hasCreateFeedback: { type: Boolean, required: true },
    createLoading: { type: Boolean, required: true },
    canContinueFromContext: { type: Boolean, required: true },
    canContinueFromCharges: { type: Boolean, required: true },
    submitLabel: { type: String, required: true },
    submitLoadingLabel: { type: String, required: true },
});

defineEmits<{
    (event: 'dismiss-alerts'): void;
    (event: 'back'): void;
    (event: 'continue-to-charges'): void;
    (event: 'continue-to-review'): void;
    (event: 'submit'): void;
}>();
</script>

<template>
    <Separator />
    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p
            v-if="props.createInvoiceStage === 'finalize'"
            class="text-xs text-muted-foreground"
        >
            {{ props.createDraftSaveGuidanceDescription }}
        </p>
        <div class="flex flex-wrap items-center justify-end gap-2 lg:ml-auto">
            <Button
                v-if="props.hasCreateFeedback"
                variant="outline"
                size="sm"
                class="gap-1.5"
                :disabled="props.createLoading"
                @click="$emit('dismiss-alerts')"
            >
                <AppIcon name="circle-x" class="size-3.5" />
                Dismiss alerts
            </Button>
            <Button
                v-if="props.createInvoiceStage !== 'context'"
                type="button"
                variant="outline"
                class="gap-1.5"
                @click="$emit('back')"
            >
                <AppIcon name="chevron-left" class="size-3.5" />
                Back
            </Button>
            <Button
                v-if="props.createInvoiceStage === 'context'"
                type="button"
                class="gap-1.5"
                :disabled="!props.canContinueFromContext"
                @click="$emit('continue-to-charges')"
            >
                Continue to Charges
                <AppIcon name="arrow-right" class="size-3.5" />
            </Button>
            <Button
                v-else-if="props.createInvoiceStage === 'charges'"
                type="button"
                class="gap-1.5"
                :disabled="!props.canContinueFromCharges"
                @click="$emit('continue-to-review')"
            >
                Continue to Review
                <AppIcon name="arrow-right" class="size-3.5" />
            </Button>
            <Button
                v-else
                :disabled="props.createLoading"
                class="gap-1.5"
                @click="$emit('submit')"
            >
                <AppIcon name="plus" class="size-3.5" />
                {{
                    props.createLoading
                        ? props.submitLoadingLabel
                        : props.submitLabel
                }}
            </Button>
        </div>
    </div>
</template>
