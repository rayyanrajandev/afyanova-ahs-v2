<script lang="ts" setup>
import type { ToasterProps } from 'vue-sonner';
import { onBeforeUnmount, onMounted } from 'vue';
import { Toaster as Sonner, toast } from 'vue-sonner';

const props = defineProps<ToasterProps>();

type NotifyEventDetail = {
    message?: string;
    type?: 'success' | 'error' | 'info' | 'warning';
};

function handleNotifyEvent(event: Event): void {
    const detail = (event as CustomEvent<NotifyEventDetail>).detail;
    const message = detail?.message?.trim();
    if (!message) return;

    const options = { duration: 7000, closeButton: true };

    if (detail?.type === 'success') {
        toast.success(message, options);
    } else if (detail?.type === 'error') {
        toast.error(message, { ...options, duration: 12000 });
    } else if (detail?.type === 'warning') {
        toast.warning(message, { ...options, duration: 12000 });
    } else {
        toast.info(message, options);
    }
}

onMounted(() => {
    window.addEventListener('afyanova:notify', handleNotifyEvent);
});

onBeforeUnmount(() => {
    window.removeEventListener('afyanova:notify', handleNotifyEvent);
});
</script>

<template>
    <Sonner v-bind="props" />
</template>
