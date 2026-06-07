<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        stripeClass?: string | null;
        stripeEdge?: string;
        innerClass?: string;
        interactive?: boolean;
        flash?: boolean;
        hoverClass?: string;
        variant?: 'queue' | 'card';
        compact?: boolean;
    }>(),
    {
        stripeClass: null,
        stripeEdge: 'rounded-l',
        innerClass: '',
        interactive: false,
        flash: false,
        hoverClass: 'hover:bg-muted/30',
        variant: 'queue',
        compact: false,
    },
);

const emit = defineEmits<{
    activate: [];
}>();

const isCard = computed(() => props.variant === 'card');

const rowClass = computed(() => {
    if (isCard.value) {
        return [
            'relative outline-none transition-colors',
            props.compact ? 'rounded-lg border p-2.5' : 'rounded-lg border p-3',
            props.interactive ? 'cursor-pointer' : '',
            props.hoverClass,
            props.flash ? 'animate-inv-row-flash' : '',
        ];
    }

    return [
        'relative flex items-start gap-3 px-4 py-3.5 transition-colors',
        props.hoverClass,
        props.interactive ? 'cursor-pointer' : '',
        props.flash ? 'animate-inv-row-flash' : '',
    ];
});

const stripeEdgeClass = computed(() => {
    if (isCard.value) return 'rounded-l-lg';

    return props.stripeEdge;
});

function onActivate(event: MouseEvent): void {
    if (!props.interactive) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-row-action]')) return;
    emit('activate');
}
</script>

<template>
    <div :class="rowClass" @click="onActivate">
        <div
            v-if="stripeClass"
            class="absolute inset-y-0 left-0 w-[3px]"
            :class="[stripeClass, stripeEdgeClass]"
        />
        <template v-if="isCard">
            <div class="min-w-0 pl-2">
                <slot />
            </div>
            <div
                v-if="$slots.trailing || $slots.actions"
                class="mt-2.5 flex flex-wrap gap-2 pl-2"
                data-row-action
                @click.stop
            >
                <slot name="trailing" />
                <slot name="actions" />
            </div>
        </template>
        <template v-else>
            <slot name="leading" />
            <div class="min-w-0 flex-1" :class="innerClass">
                <slot />
            </div>
            <div
                v-if="$slots.trailing || $slots.actions"
                class="flex shrink-0 flex-wrap items-start gap-1.5"
                data-row-action
                @click.stop
            >
                <slot name="trailing" />
                <slot name="actions" />
            </div>
        </template>
    </div>
</template>
