<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
    timeoutAt: string | null | undefined;
}>();

const now = ref(Date.now());
const intervalId = ref<ReturnType<typeof setInterval> | null>(null);

onMounted(() => {
    intervalId.value = setInterval(() => {
        now.value = Date.now();
    }, 60_000);
});

onBeforeUnmount(() => {
    if (intervalId.value !== null) {
        clearInterval(intervalId.value);
    }
});

const remaining = computed(() => {
    if (!props.timeoutAt) return null;
    const deadline = new Date(props.timeoutAt).getTime();
    const diff = deadline - now.value;
    if (diff <= 0) return { expired: true, hours: 0, minutes: 0 };
    return {
        expired: false,
        hours: Math.floor(diff / 3_600_000),
        minutes: Math.floor((diff % 3_600_000) / 60_000),
    };
});

const label = computed(() => {
    if (!remaining.value) return '—';
    if (remaining.value.expired) return 'Expired';
    if (remaining.value.hours < 1) return `${remaining.value.minutes}m`;
    return `${remaining.value.hours}h ${remaining.value.minutes}m`;
});

const isUrgent = computed(() => {
    if (!remaining.value || remaining.value.expired) return false;
    return remaining.value.hours < 24;
});
</script>

<template>
    <span v-if="remaining" class="inline-flex items-center gap-1 text-[11px]" :class="remaining.expired ? 'text-red-600 font-semibold' : isUrgent ? 'text-amber-600 font-medium' : 'text-muted-foreground'">
        <svg v-if="remaining.expired" class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <svg v-else class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        {{ label }}
    </span>
</template>
