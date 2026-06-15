<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        statusDotClass?: string | null;
        statusTitle?: string | null;
        primaryLabel?: string | null;
        secondaryLabel?: string | null;
        meta?: string | null;
        flash?: boolean;
        selectable?: boolean;
        variant?: 'list' | 'picker';
        selected?: boolean;
        align?: 'center' | 'start';
        surfaceClass?: string | Record<string, boolean> | Array<string | Record<string, boolean>>;
        statusDotOffset?: boolean;
    }>(),
    {
        statusDotClass: null,
        statusTitle: null,
        primaryLabel: null,
        secondaryLabel: null,
        meta: null,
        flash: false,
        selectable: true,
        variant: 'list',
        selected: false,
        align: 'center',
        surfaceClass: undefined,
        statusDotOffset: false,
    },
);

const emit = defineEmits<{
    select: [];
}>();

const slots = defineSlots<{
    leading?: () => unknown;
    default?: () => unknown;
    title?: () => unknown;
    meta?: () => unknown;
    badges?: () => unknown;
    actions?: () => unknown;
}>();

const useBuiltInBody = computed(
    () => !slots.default && !slots.title && !slots.meta && Boolean(props.primaryLabel),
);
const useCustomBody = computed(() => Boolean(slots.title || slots.default || slots.meta));
const isPicker = computed(() => props.variant === 'picker');
const canUseBuiltInSelect = computed(() => props.selectable && useBuiltInBody.value && !isPicker.value);
const canUseCustomSelect = computed(
    () => props.selectable && useCustomBody.value && !useBuiltInBody.value && !isPicker.value,
);
const canPickerSelect = computed(() => props.selectable && isPicker.value);

const rowClass = computed(() => {
    if (isPicker.value) {
        return [
            'group flex w-full items-center gap-3 rounded-lg border border-border/70 bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/30',
            props.selected ? 'border-primary/50 bg-primary/5 shadow-sm' : '',
            props.surfaceClass,
            props.flash ? 'animate-inv-row-flash' : '',
        ];
    }

    return [
        'flex gap-3 py-3 transition-colors hover:bg-muted/30',
        props.align === 'start' ? 'items-start' : 'items-center',
        props.surfaceClass,
        props.flash ? 'animate-inv-row-flash' : '',
    ];
});

function onSelect(): void {
    if (!props.selectable) return;
    emit('select');
}
</script>

<template>
    <button
        v-if="canPickerSelect"
        type="button"
        :class="rowClass"
        @click="onSelect"
    >
        <slot name="leading" />
        <span
            v-if="statusDotClass"
            class="size-2 shrink-0 rounded-full"
            :class="[statusDotClass, statusDotOffset ? 'mt-1.5' : '']"
            :title="statusTitle ?? undefined"
        />
        <div class="min-w-0 flex-1 space-y-0.5">
            <div v-if="useBuiltInBody" class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <span class="truncate text-sm font-medium transition-colors group-hover:text-primary">
                    {{ primaryLabel }}
                </span>
                <span v-if="secondaryLabel" class="shrink-0 text-xs text-muted-foreground">
                    {{ secondaryLabel }}
                </span>
            </div>
            <slot v-else name="title" />
            <p v-if="useBuiltInBody && meta" class="truncate text-xs text-muted-foreground">
                {{ meta }}
            </p>
            <slot v-else name="meta" />
            <slot />
        </div>
        <div v-if="$slots.badges" class="hidden shrink-0 flex-wrap items-center gap-1.5 sm:flex">
            <slot name="badges" />
        </div>
        <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1.5">
            <slot name="actions" />
        </div>
    </button>
    <div v-else :class="rowClass">
        <slot name="leading" />
        <span
            v-if="statusDotClass"
            class="size-2 shrink-0 rounded-full"
            :class="[statusDotClass, statusDotOffset ? 'mt-1.5' : '']"
            :title="statusTitle ?? undefined"
        />
        <button
            v-if="canUseBuiltInSelect"
            type="button"
            class="min-w-0 flex-1 space-y-0.5 text-left"
            @click="onSelect"
        >
            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <span class="truncate text-sm font-medium transition-colors hover:text-primary">
                    {{ primaryLabel }}
                </span>
                <span v-if="secondaryLabel" class="shrink-0 text-xs text-muted-foreground">
                    {{ secondaryLabel }}
                </span>
            </div>
            <p v-if="meta" class="truncate text-xs text-muted-foreground">
                {{ meta }}
            </p>
        </button>
        <button
            v-else-if="canUseCustomSelect"
            type="button"
            class="min-w-0 flex-1 space-y-0.5 text-left"
            @click="onSelect"
        >
            <slot name="title" />
            <slot name="meta" />
            <slot />
        </button>
        <div v-else-if="useBuiltInBody" class="min-w-0 flex-1 space-y-0.5">
            <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <span class="truncate text-sm font-medium">
                    {{ primaryLabel }}
                </span>
                <span v-if="secondaryLabel" class="shrink-0 text-xs text-muted-foreground">
                    {{ secondaryLabel }}
                </span>
            </div>
            <p v-if="meta" class="truncate text-xs text-muted-foreground">
                {{ meta }}
            </p>
        </div>
        <div v-else class="min-w-0 flex-1 space-y-0.5">
            <slot name="title" />
            <slot name="meta" />
            <slot />
        </div>
        <div v-if="$slots.badges" class="hidden shrink-0 flex-wrap items-center gap-1.5 sm:flex">
            <slot name="badges" />
        </div>
        <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1.5">
            <slot name="actions" />
        </div>
    </div>
</template>
