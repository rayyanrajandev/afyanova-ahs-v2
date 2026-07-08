import { apiGet, apiPost } from '@/lib/apiClient';
import {
    type ClinicalCatalogItem,
    type EncounterDuplicateCheckResult,
    type EncounterOrderContext,
} from '@/lib/encounterInlineOrders';

/**
 * Theatre-procedure inline ordering — a deliberately separate module from
 * encounterInlineOrders.ts rather than a fourth branch added to it (see
 * reports/clinical-notes-frontend-rebuild-plan.md, Phase 3 revision note and
 * the theatre-ordering gap it flagged). Reason: encounterInlineOrders.ts's
 * types/components (EncounterInlineOrderType, EncounterInlineOrderPanel.vue,
 * EncounterOrdersCommandCenter.vue) are shared with the still-live
 * encounters/{id} Workspace.vue page. Extending that shared union/switch
 * would change behavior on production code outside this rebuild's scope.
 * This module and TheatreInlineOrderForm.vue are additive-only: new files,
 * used only from WorkspaceV2.vue, zero risk to the old page.
 *
 * Unlike lab/pharmacy/radiology, a theatre procedure has no encounterId in
 * its own create contract (StoreTheatreProcedureRequest) — only
 * patientId/appointmentId/admissionId — and requires an operating clinician
 * and a schedule. The full room-registry picker (a separate fetch) is
 * intentionally not included here; a free-text room name covers the common
 * quick-order case, matching the nullable theatreRoomName field, with the
 * full picker still available on the standalone /theatre-procedures page.
 */

export type TheatreStaffProfile = {
    id: string;
    userId: number | null;
    userName: string | null;
    employeeNumber: string | null;
    department: string | null;
    jobTitle: string | null;
    status: string | null;
};

type TheatreCatalogListResponse = { data: ClinicalCatalogItem[] };
type TheatreStaffListResponse = { data: TheatreStaffProfile[] };
type TheatreDuplicateCheckResponse = { data: EncounterDuplicateCheckResult };

export function theatreStaffLabel(profile: TheatreStaffProfile): string {
    const name = profile.userName?.trim();
    const jobTitle = profile.jobTitle?.trim();
    if (name) return jobTitle ? `${name} (${jobTitle})` : name;

    const employeeNumber = profile.employeeNumber?.trim();
    if (employeeNumber) return employeeNumber;

    return profile.userId !== null ? `User #${profile.userId}` : 'Unassigned';
}

export function defaultTheatreScheduleValue(): string {
    const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

export function toSqlDateTime(value: string | null | undefined): string | null {
    if (!value) return null;
    return `${value.replace('T', ' ')}:00`;
}

export async function fetchTheatreProcedureCatalog(): Promise<ClinicalCatalogItem[]> {
    const response = await apiGet<TheatreCatalogListResponse>(
        '/platform/admin/clinical-catalogs/theatre-procedures',
        { status: 'active', sortBy: 'name', sortDir: 'asc', perPage: 200, page: 1 },
    );
    return response.data ?? [];
}

export async function fetchTheatreClinicianDirectory(): Promise<TheatreStaffProfile[]> {
    const response = await apiGet<TheatreStaffListResponse>(
        '/theatre-procedures/clinician-directory',
        { status: 'active', page: 1, perPage: 200 },
    );
    return response.data ?? [];
}

export type TheatreInlineOrderInput = {
    theatreProcedureCatalogItemId: string;
    procedureType: string;
    procedureName: string;
    operatingClinicianUserId: number;
    anesthetistUserId: number | null;
    scheduledAt: string;
    theatreRoomName: string;
    notes: string;
};

export async function checkTheatreDuplicate(
    context: EncounterOrderContext,
    item: Pick<TheatreInlineOrderInput, 'theatreProcedureCatalogItemId' | 'procedureType'>,
): Promise<EncounterDuplicateCheckResult> {
    const response = await apiGet<TheatreDuplicateCheckResponse>(
        '/theatre-procedures/duplicate-check',
        {
            patientId: context.patientId.trim(),
            appointmentId: context.appointmentId?.trim() || null,
            admissionId: context.admissionId?.trim() || null,
            theatreProcedureCatalogItemId: item.theatreProcedureCatalogItemId.trim() || null,
            procedureType: item.procedureType.trim() || null,
        },
    );
    return response.data;
}

export async function createTheatreInlineOrder(
    context: EncounterOrderContext,
    item: TheatreInlineOrderInput,
) {
    return apiPost<{ data: Record<string, unknown> }>('/theatre-procedures', {
        body: {
            patientId: context.patientId.trim(),
            appointmentId: context.appointmentId?.trim() || null,
            admissionId: context.admissionId?.trim() || null,
            entryMode: 'active',
            theatreProcedureCatalogItemId: item.theatreProcedureCatalogItemId.trim() || null,
            procedureType: item.procedureType.trim() || null,
            procedureName: item.procedureName.trim() || null,
            operatingClinicianUserId: item.operatingClinicianUserId,
            anesthetistUserId: item.anesthetistUserId,
            theatreRoomName: item.theatreRoomName.trim() || null,
            scheduledAt: toSqlDateTime(item.scheduledAt),
            notes: item.notes.trim() || null,
        },
    });
}
