<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import NotificationItemRow from '@/components/NotificationItem.vue';
import type { NotificationItem } from '@/composables/useNotifications';

defineProps<{
    notifications: NotificationItem[];
    unreadCount: number;
}>();

const emit = defineEmits<{
    'mark-read': [id: string];
    dismiss: [id: string];
}>();
</script>

<template>
    <div class="flex max-h-[360px] flex-col overflow-y-auto">
        <NotificationItemRow
            v-for="n in notifications"
            :key="n.id"
            :notification="n"
            @mark-read="emit('mark-read', $event)"
            @dismiss="emit('dismiss', $event)"
        />
        <div
            v-if="notifications.length === 0"
            class="flex flex-col items-center gap-1 px-4 py-8 text-center text-sm text-muted-foreground"
        >
            <p>No notifications yet</p>
            <p class="text-xs">You'll see notifications here when something needs your attention.</p>
        </div>
        <div class="border-t p-2">
            <Link
                href="/notifications"
                class="flex items-center justify-center rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
                View all notifications
            </Link>
        </div>
    </div>
</template>
