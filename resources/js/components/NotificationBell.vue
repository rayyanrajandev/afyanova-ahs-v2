<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import NotificationDropdown from '@/components/NotificationDropdown.vue';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/composables/useNotifications';

const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismiss,
} = useNotifications();

const hasUnread = computed(() => unreadCount.value > 0);
</script>

<template>
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button
                variant="ghost"
                size="sm"
                class="relative h-9 w-9 px-0 text-muted-foreground"
                aria-label="Notifications"
            >
                <AppIcon name="bell" class="size-4 shrink-0" />
                <span
                    v-if="hasUnread"
                    class="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold leading-none text-destructive-foreground"
                >
                    {{ unreadCount > 9 ? '9+' : unreadCount }}
                </span>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
            align="end"
            class="w-[380px]"
            :side-offset="4"
        >
            <DropdownMenuLabel class="flex items-center justify-between">
                <span class="text-sm font-medium">Notifications</span>
                <button
                    v-if="hasUnread"
                    class="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    @click="markAllAsRead()"
                >
                    Mark all as read
                </button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <NotificationDropdown
                :notifications="notifications"
                :unread-count="unreadCount"
                @mark-read="markAsRead"
                @dismiss="dismiss"
            />
        </DropdownMenuContent>
    </DropdownMenu>
</template>
