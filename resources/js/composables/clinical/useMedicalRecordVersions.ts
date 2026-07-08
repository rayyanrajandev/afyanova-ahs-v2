import { useQuery } from '@tanstack/vue-query';
import { computed, ref, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type MedicalRecordVersion = {
    id: string;
    medicalRecordId: string | null;
    versionNumber: number | null;
    snapshot: Record<string, unknown>;
    changedFields: string[];
    createdByUserId: number | null;
    createdAt: string | null;
};

export type MedicalRecordVersionDiffRow = {
    field: string | null;
    before: unknown;
    after: unknown;
};

export type MedicalRecordVersionDiffMeta = {
    id: string | null;
    medicalRecordId: string | null;
    versionNumber: number | null;
    changedFields: string[];
    createdByUserId: number | null;
    createdAt: string | null;
};

export type MedicalRecordVersionDiff = {
    targetVersion: MedicalRecordVersionDiffMeta | null;
    baseVersion: MedicalRecordVersionDiffMeta | null;
    diff: MedicalRecordVersionDiffRow[];
    summary: { changedFieldCount: number };
};

type VersionListEnvelope = { data: MedicalRecordVersion[] };
type VersionDiffEnvelope = { data: MedicalRecordVersionDiff };

/**
 * Version history + diff viewing (reports/clinical-notes-frontend-rebuild-plan.md
 * §3/§4). Same endpoints as the current Workspace.vue
 * (GET /medical-records/{id}/versions, GET .../versions/{id}/diff), just backed
 * by TanStack Query instead of hand-rolled loading/error refs. Diffing against
 * the previous version is the default (againstVersionId omitted); comparing
 * against an arbitrary earlier version is opt-in via setAgainstVersionId.
 */
export function useMedicalRecordVersions(recordId: MaybeRefOrGetter<string | null | undefined>) {
    const selectedVersionId = ref('');
    const againstVersionId = ref('');

    const versionsQuery = useQuery({
        queryKey: ['medical-record-versions', computed(() => toValue(recordId))],
        queryFn: async () => {
            const id = toValue(recordId);
            const response = await apiGet<VersionListEnvelope>(`/medical-records/${id}/versions`, {
                page: 1,
                perPage: 20,
            });
            return response.data;
        },
        enabled: computed(() => Boolean(toValue(recordId))),
    });

    watch(
        () => versionsQuery.data.value,
        (versions) => {
            selectedVersionId.value = versions?.[0]?.id ?? '';
            againstVersionId.value = '';
        },
    );

    const diffQuery = useQuery({
        queryKey: [
            'medical-record-version-diff',
            computed(() => toValue(recordId)),
            selectedVersionId,
            againstVersionId,
        ],
        queryFn: async () => {
            const id = toValue(recordId);
            const response = await apiGet<VersionDiffEnvelope>(
                `/medical-records/${id}/versions/${selectedVersionId.value}/diff`,
                { againstVersionId: againstVersionId.value.trim() || null },
            );
            return response.data;
        },
        enabled: computed(() => Boolean(toValue(recordId)) && Boolean(selectedVersionId.value)),
    });

    return {
        versions: computed(() => versionsQuery.data.value ?? []),
        isLoading: versionsQuery.isPending,
        error: versionsQuery.error,
        selectedVersionId,
        againstVersionId,
        diff: computed(() => diffQuery.data.value ?? null),
        isDiffLoading: diffQuery.isFetching,
        diffError: diffQuery.error,
    };
}

export function versionLabel(version: MedicalRecordVersion, formatDateTime: (value: string | null) => string): string {
    const number = version.versionNumber ?? '?';
    return `v${number} (${formatDateTime(version.createdAt)})`;
}

export function formatDiffValue(value: unknown): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return value === '' ? "''" : value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}
