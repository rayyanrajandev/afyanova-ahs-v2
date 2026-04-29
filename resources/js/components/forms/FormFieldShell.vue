<script setup lang="ts">
import { computed, type HTMLAttributes } from 'vue';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const props = withDefaults(
    defineProps<{
        inputId?: string;
        label?: string;
        required?: boolean;
        helperText?: string;
        errorMessage?: string | null;
        reserveMessageSpace?: boolean;
        containerClass?: HTMLAttributes['class'];
        labelClass?: HTMLAttributes['class'];
        messageClass?: HTMLAttributes['class'];
    }>(),
    {
        inputId: undefined,
        label: '',
        required: false,
        helperText: '',
        errorMessage: null,
        reserveMessageSpace: true,
        containerClass: undefined,
        labelClass: undefined,
        messageClass: undefined,
    },
);

const normalizedError = computed(() => (props.errorMessage ?? '').trim());
const normalizedHelper = computed(() => props.helperText.trim());
const resolvedMessage = computed(() => normalizedError.value || normalizedHelper.value);
const isErrorMessage = computed(() => normalizedError.value.length > 0);
</script>

<template>
    <div :class="cn('grid gap-1.5', containerClass)">
        <Label
            v-if="label"
            :for="inputId"
            :class="cn('text-xs leading-4', labelClass)"
        >
            {{ label }}
            <span v-if="required" class="text-destructive">*</span>
        </Label>

        <slot />

        <div
            :class="
                cn(
                    reserveMessageSpace ? 'min-h-4' : '',
                    messageClass,
                )
            "
        >
            <p
                v-if="resolvedMessage"
                :class="cn('text-xs leading-4', isErrorMessage ? 'text-destructive' : 'text-muted-foreground')"
            >
                {{ resolvedMessage }}
            </p>
        </div>
    </div>
</template>
