import { usePage } from '@inertiajs/vue3';
import { useEcho, useConnectionStatus } from '@laravel/echo-vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { computed } from 'vue';
import { apiGet, apiPatch, apiDelete } from '@/lib/apiClient';

export type NotificationItem = {
    id: string;
    userId: number;
    category: 'clinical' | 'laboratory' | 'pharmacy' | 'billing' | 'administration' | 'system';
    priority: 'critical' | 'high' | 'normal' | 'informational';
    title: string;
    body: string | null;
    actionUrl: string | null;
    actionLabel: string | null;
    contextType: string | null;
    contextId: string | null;
    readAt: string | null;
    dismissedAt: string | null;
    createdAt: string;
};

type NotificationListResponse = {
    data: NotificationItem[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
};

type UnreadCountResponse = { data: { count: number } };

export function useNotifications() {
    const page = usePage();
    const userId = computed(() => (page.props.auth as { user?: { id: number } } | undefined)?.user?.id ?? null);
    const hasUser = computed(() => userId.value !== null);
    const queryClient = useQueryClient();
    const connectionStatus = useConnectionStatus();
    const isLive = computed(() => connectionStatus.value === 'connected' && hasUser.value);

    const list = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            const response = await apiGet<NotificationListResponse>('/notifications', { per_page: 20 });
            return response;
        },
        enabled: hasUser,
        refetchInterval: 60_000,
    });

    const unreadCountQuery = useQuery({
        queryKey: ['notifications-unread-count'],
        queryFn: async () => {
            const response = await apiGet<UnreadCountResponse>('/notifications/unread-count');
            return response.data.count;
        },
        enabled: hasUser,
        refetchInterval: 60_000,
    });

    const invalidateQueries = () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    };

    const markAsRead = useMutation({
        mutationFn: async (id: string) => {
            await apiPatch(`/notifications/${id}/read`);
        },
        onSuccess: invalidateQueries,
    });

    const markAllAsRead = useMutation({
        mutationFn: async () => {
            await apiPatch('/notifications/read-all');
        },
        onSuccess: invalidateQueries,
    });

    const dismiss = useMutation({
        mutationFn: async (id: string) => {
            await apiDelete(`/notifications/${id}`);
        },
        onSuccess: invalidateQueries,
    });

    useEcho(
        `notifications.${userId.value ?? 'unresolved'}`,
        '.notification.dispatched',
        (payload: { unreadCount: number }) => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.setQueryData(['notifications-unread-count'], payload.unreadCount);
        },
        [userId.value],
    );

    return {
        notifications: computed(() => list.data.value?.data ?? []),
        meta: computed(() => list.data.value?.meta ?? null),
        isLoading: computed(() => list.isLoading.value),
        unreadCount: computed(() => unreadCountQuery.data.value ?? 0),
        isLive,
        markAsRead: markAsRead.mutate,
        markAllAsRead: markAllAsRead.mutate,
        dismiss: dismiss.mutate,
        refresh: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
        },
    };
}
