<script setup lang="ts">
import { router } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import type { NotificationItem } from '@/composables/useNotifications';

const props = defineProps<{
    notification: NotificationItem;
}>();

const emit = defineEmits<{
    'mark-read': [id: string];
    dismiss: [id: string];
}>();

const isUnread = computed(() => !props.notification.readAt);

const categoryIcon = computed(() => {
    const map: Record<string, string> = {
        clinical: 'heart-pulse',
        laboratory: 'flask-conical',
        pharmacy: 'pill',
        billing: 'receipt',
        administration: 'building-2',
        system: 'shield-check',
    };
    return map[props.notification.category] ?? 'bell';
});

const priorityBorderClass = computed(() => {
    switch (props.notification.priority) {
        case 'critical': return 'border-l-destructive';
        case 'high': return 'border-l-orange-500';
        case 'normal': return 'border-l-blue-500';
        default: return 'border-l-muted';
    }
});

function handleClick() {
    if (isUnread.value) {
        emit('mark-read', props.notification.id);
    }
    if (props.notification.actionUrl) {
        router.visit(props.notification.actionUrl);
    }
}
</script>

<template>
    <div
        class="group relative flex cursor-pointer gap-3 border-l-2 px-4 py-3 text-sm transition-colors hover:bg-accent/30"
        :class="[priorityBorderClass, { 'bg-muted/20': isUnread }]"
        role="button"
        tabindex="0"
        @click="handleClick"
        @keydown.enter="handleClick"
    >
        <AppIcon
            :name="categoryIcon"
            class="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <div class="min-w-0 flex-1">
            <p
                class="truncate text-sm"
                :class="isUnread ? 'font-medium text-foreground' : 'text-muted-foreground'"
            >
                {{ notification.title }}
            </p>
            <p v-if="notification.body" class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {{ notification.body }}
            </p>
            <p class="mt-0.5 text-[10px] text-muted-foreground/60">
                {{ notification.category }} · {{ notification.priority }}
            </p>
        </div>
        <button
            class="absolute top-2 right-2 hidden size-5 items-center justify-center rounded-sm text-muted-foreground/40 hover:text-muted-foreground group-hover:flex"
            title="Dismiss"
            @click.stop="emit('dismiss', notification.id)"
        >
            <AppIcon name="x" class="size-3.5" />
        </button>
        <span
            v-if="isUnread"
            class="absolute top-3 right-3 size-2 rounded-full bg-blue-500"
        />
    </div>
</template>
