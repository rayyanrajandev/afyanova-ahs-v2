<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

defineOptions({
    inheritAttrs: false,
});

type Props = {
    className?: HTMLAttributes['class'];
};

defineProps<Props>();
</script>

<template>
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        :class="className"
        v-bind="$attrs"
    >
        <path
            fill="currentColor"
            d="M24 4 6 44h9.12l3.24-7.52h11.28L32.88 44H42L24 4Zm0 17.72 4.2 9.72h-8.4L24 21.72Z"
        />
        <path
            fill="currentColor"
            d="M32 10h-4v4h-4v4h4v4h4v-4h4v-4h-4z"
        />
    </svg>
</template>
