<script setup lang="ts">
import { computed } from 'vue';
import AppLogoIcon from '@/components/AppLogoIcon.vue';
import { normalizeBranding } from '@/lib/branding';
import type { SharedBranding } from '@/types/branding';

const props = withDefaults(
    defineProps<{
        branding?: Partial<SharedBranding> | null;
        className?: string;
        alt?: string;
    }>(),
    {
        branding: null,
        className: 'size-5',
        alt: '',
    },
);

const resolvedBranding = computed(() => normalizeBranding(props.branding));
const altText = computed(
    () => props.alt.trim() || `${resolvedBranding.value.systemName} logo`,
);
</script>

<template>
    <img
        v-if="resolvedBranding.logoUrl"
        :src="resolvedBranding.logoUrl"
        :alt="altText"
        :class="props.className"
    />
    <AppLogoIcon v-else :class-name="props.className" aria-hidden="true" />
</template>
