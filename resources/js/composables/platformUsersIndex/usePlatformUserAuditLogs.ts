import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, reactive, type ComputedRef } from 'vue';
import { apiGetBlob, apiGet } from '@/lib/apiClient';
import type { Pagination } from './usePlatformUserList';

export type PlatformUserAuditLog = {
    id: string;
    actorId: number | null;
    actorType?: 'system' | 'user' | null;
    actor?: { displayName?: string | null } | null;
    action: string | null;
    actionLabel?: string | null;
    createdAt: string | null;
};

type PlatformUserAuditLogListResponse = { data: PlatformUserAuditLog[]; meta: Pagination };

export function usePlatformUserAuditLogFilters() {
    return reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', page: 1, perPage: 20 });
}

export type PlatformUserAuditLogFilters = ReturnType<typeof usePlatformUserAuditLogFilters>;

function auditLogQuery(filters: PlatformUserAuditLogFilters) {
    return {
        q: filters.q.trim() || null,
        action: filters.action.trim() || null,
        actorType: filters.actorType || null,
        actorId: filters.actorId.trim() || null,
        from: filters.from || null,
        to: filters.to || null,
    };
}

/** GET /platform/admin/users/{id}/audit-logs — details sheet's Audit tab, enabled only while the sheet is open for a real user. */
export function usePlatformUserAuditLogs(
    userId: ComputedRef<number | null>,
    filters: PlatformUserAuditLogFilters,
): UseQueryReturnType<PlatformUserAuditLogListResponse, Error> {
    return useQuery({
        queryKey: ['platform-users-audit-logs', userId, computed(() => ({ ...filters }))],
        queryFn: () =>
            apiGet<PlatformUserAuditLogListResponse>(`/platform/admin/users/${userId.value}/audit-logs`, {
                ...auditLogQuery(filters),
                page: filters.page,
                perPage: filters.perPage,
            }),
        enabled: computed(() => userId.value !== null),
    });
}

function triggerDownload(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
}

/** GET /platform/admin/users/{id}/audit-logs/export — CSV download, same blob pattern as PatientBulkSheet.vue. */
export async function exportPlatformUserAuditLogsCsv(userId: number, filters: PlatformUserAuditLogFilters): Promise<void> {
    const { blob, filename } = await apiGetBlob(`/platform/admin/users/${userId}/audit-logs/export`, {
        query: auditLogQuery(filters),
    });
    triggerDownload(blob, filename ?? `user-${userId}-audit-logs.csv`);
}
