<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue';
import type { Component } from 'vue';
import { computed } from 'vue';
import { useUiPreferences } from '@/composables/useUiPreferences';
import { resolveAppIcon, resolveHugeIcon, type AppIconName } from '@/lib/icons';

const props = withDefaults(
    defineProps<{
        name?: AppIconName | null;
        fallback?: Component | null;
        class?: string;
    }>(),
    {
        name: null,
        fallback: null,
        class: 'size-4',
    },
);

const { iconPack } = useUiPreferences();

const hugeIconData = computed(() => {
    if (iconPack.value !== 'huge') {
        return null;
    }

    return resolveHugeIcon(props.name);
});

const iconComponent = computed<Component | null>(() => {
    return resolveAppIcon(props.name, 'lucide') ?? props.fallback ?? null;
});
</script>

<template>
    <HugeiconsIcon
        v-if="hugeIconData"
        :icon="hugeIconData"
        :class="props.class"
        data-app-icon="true"
        :stroke-width="1.8"
    />
    <component
        v-else-if="iconComponent"
        :is="iconComponent"
        :class="props.class"
        data-app-icon="true"
    />
</template>
