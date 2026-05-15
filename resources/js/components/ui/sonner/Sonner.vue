<script lang="ts" setup>
import type { ToasterProps } from 'vue-sonner';
import {
    CircleCheckIcon,
    InfoIcon,
    Loader2Icon,
    OctagonXIcon,
    TriangleAlertIcon,
    XIcon,
} from 'lucide-vue-next';
import { onBeforeUnmount, onMounted } from 'vue';
import { Toaster as Sonner, toast } from 'vue-sonner';
import { cn } from '@/lib/utils';
import './sonner-theme.css';

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
    <Sonner
        :class="cn('toaster group', props.class)"
        :style="{
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
            '--border-radius': 'var(--radius)',
        }"
        position="top-right"
        close-button
        rich-colors
        expand
        :visible-toasts="4"
        :duration="7000"
        v-bind="props"
    >
        <template #success-icon>
            <CircleCheckIcon class="size-4" />
        </template>
        <template #info-icon>
            <InfoIcon class="size-4" />
        </template>
        <template #warning-icon>
            <TriangleAlertIcon class="size-4" />
        </template>
        <template #error-icon>
            <OctagonXIcon class="size-4" />
        </template>
        <template #loading-icon>
            <div>
                <Loader2Icon class="size-4 animate-spin" />
            </div>
        </template>
        <template #close-icon>
            <XIcon class="size-4" />
        </template>
    </Sonner>
</template>
