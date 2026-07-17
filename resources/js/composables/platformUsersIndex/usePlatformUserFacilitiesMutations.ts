import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiPatch } from '@/lib/apiClient';
import type { PlatformUser, PlatformUserFacilityAssignment } from './usePlatformUserList';

export type FacilityAssignmentDraft = { facilityId: string; role: string; isPrimary: boolean; isActive: boolean };

export function toFacilityDrafts(assignments: PlatformUserFacilityAssignment[] | undefined): FacilityAssignmentDraft[] {
    return (assignments ?? [])
        .map((assignment): FacilityAssignmentDraft | null => {
            const facilityId = String(assignment.facilityId ?? '').trim();
            if (!facilityId) return null;
            return {
                facilityId,
                role: String(assignment.role ?? ''),
                isPrimary: Boolean(assignment.isPrimary),
                isActive: assignment.isActive === undefined ? true : Boolean(assignment.isActive),
            };
        })
        .filter((entry): entry is FacilityAssignmentDraft => entry !== null);
}

/** Keeps exactly one draft flagged `isPrimary` (first one wins on conflict, first draft is auto-primary when none is set). */
export function ensureSinglePrimaryFacilityDraft(drafts: FacilityAssignmentDraft[]): FacilityAssignmentDraft[] {
    const primaries = drafts.filter((entry) => entry.isPrimary);
    if (drafts.length > 0 && primaries.length === 0) {
        return drafts.map((entry, index) => (index === 0 ? { ...entry, isPrimary: true } : entry));
    }
    if (primaries.length > 1) {
        let first = true;
        return drafts.map((entry) => {
            if (!entry.isPrimary) return entry;
            if (first) {
                first = false;
                return entry;
            }
            return { ...entry, isPrimary: false };
        });
    }
    return drafts;
}

export type PlatformUserFacilitiesSyncInput = {
    userId: number;
    facilityAssignments: FacilityAssignmentDraft[];
    approvalCaseReference: string;
};

type PlatformUserResponse = { data: PlatformUser };

function toRequestAssignments(drafts: FacilityAssignmentDraft[]) {
    return drafts.map((entry) => ({
        facilityId: entry.facilityId,
        role: entry.role.trim() || null,
        isPrimary: entry.isPrimary,
        isActive: entry.isActive,
    }));
}

/** PATCH /platform/admin/users/{id}/facilities — details sheet's Access tab. */
export function usePlatformUserFacilitiesSync(): UseMutationReturnType<PlatformUser, Error, PlatformUserFacilitiesSyncInput, unknown> {
    return useMutation({
        mutationFn: async (input: PlatformUserFacilitiesSyncInput): Promise<PlatformUser> => {
            const response = await apiPatch<PlatformUserResponse>(`/platform/admin/users/${input.userId}/facilities`, {
                body: {
                    facilityAssignments: toRequestAssignments(input.facilityAssignments),
                    approvalCaseReference: input.approvalCaseReference.trim() || null,
                },
            });
            return response.data;
        },
    });
}

export type PlatformUserBulkFacilitiesSyncInput = {
    userIds: number[];
    facilityAssignments: FacilityAssignmentDraft[];
    approvalCaseReference: string;
};

export type PlatformUserBulkFacilitiesSyncResult = {
    requestedCount: number;
    updatedCount: number;
    skippedUserIds: number[];
    users: PlatformUser[];
};

type PlatformUserBulkFacilitiesResponse = { data: PlatformUserBulkFacilitiesSyncResult };

/** PATCH /platform/admin/users/bulk-facilities — bulk toolbar facility assignment. */
export function usePlatformUserBulkFacilitiesSync(): UseMutationReturnType<
    PlatformUserBulkFacilitiesSyncResult,
    Error,
    PlatformUserBulkFacilitiesSyncInput,
    unknown
> {
    return useMutation({
        mutationFn: async (input: PlatformUserBulkFacilitiesSyncInput): Promise<PlatformUserBulkFacilitiesSyncResult> => {
            const response = await apiPatch<PlatformUserBulkFacilitiesResponse>('/platform/admin/users/bulk-facilities', {
                body: {
                    userIds: input.userIds,
                    facilityAssignments: toRequestAssignments(input.facilityAssignments),
                    approvalCaseReference: input.approvalCaseReference.trim() || null,
                },
            });
            return response.data;
        },
    });
}
