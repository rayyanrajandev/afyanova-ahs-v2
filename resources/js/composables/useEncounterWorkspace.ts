import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet } from '@/lib/apiClient';

/**
 * Response shape from GET /api/v1/encounters/{id}?view=workspace, per
 * EncounterWorkspaceResponseTransformer (see
 * reports/clinical-note-audit/08-api-inventory.md §8.5). Deliberately loose
 * (`Record<string, unknown>` for the nested clinical objects) rather than a
 * hand-maintained full interface — replacing this with contract-generated
 * types is an explicit open item in
 * reports/clinical-notes-frontend-rebuild-plan.md §7, not decided yet.
 */
export type EncounterDiagnosis = {
    id: string;
    encounterId: string | null;
    diagnosisCode: string | null;
    diagnosisDescription: string | null;
    diagnosisType: 'primary' | 'secondary' | string;
    recordedByUserId: number | null;
    recordedByUserName: string | null;
    recordedAt: string | null;
    createdAt: string | null;
};

export type EncounterWorkspaceResponse = {
    encounter: Record<string, unknown>;
    /** Deliberately minimal — see EncounterWorkspaceResponseTransformer::transformPatientSummary() on the backend. Identification fields only, not the full patient record. */
    patient: {
        id: string | null;
        patientNumber: string | null;
        firstName: string | null;
        middleName: string | null;
        lastName: string | null;
        gender: string | null;
        dateOfBirth: string | null;
    } | null;
    appointment: Record<string, unknown> | null;
    /** Minimal — ward/bed only, used to derive an inpatient encounter's "location" for display. */
    admission: { id: string | null; ward: string | null; bed: string | null } | null;
    diagnoses: EncounterDiagnosis[];
    primaryMedicalRecord: Record<string, unknown> | null;
    laboratoryOrders: Record<string, unknown>[];
    pharmacyOrders: Record<string, unknown>[];
    radiologyOrders: Record<string, unknown>[];
    theatreProcedures: Record<string, unknown>[];
    closeReadiness: {
        canClose: boolean;
        requiresAcknowledgement: boolean;
        blockingCount: number;
        warningCount: number;
        items: Record<string, unknown>[];
        billingSummary: Record<string, unknown>;
    };
};

type EncounterWorkspaceApiEnvelope = {
    data: EncounterWorkspaceResponse;
};

/**
 * First working vertical slice of the frontend rebuild
 * (reports/clinical-notes-frontend-rebuild-plan.md §3). Wraps the existing,
 * unchanged backend endpoint in a TanStack Query, replacing the manual
 * loading/error ref bookkeeping the current Workspace.vue hand-rolls per call
 * site. No backend change — this targets the exact same contract documented
 * in reports/clinical-note-audit/08-api-inventory.md.
 */
export function useEncounterWorkspace(
    encounterId: MaybeRefOrGetter<string | null | undefined>,
): UseQueryReturnType<EncounterWorkspaceResponse, Error> {
    return useQuery({
        queryKey: ['encounter-workspace', computed(() => toValue(encounterId))],
        queryFn: async () => {
            const id = toValue(encounterId);
            if (!id) {
                throw new Error(
                    'An encounter id is required to load the workspace.',
                );
            }

            const response = await apiGet<EncounterWorkspaceApiEnvelope>(
                `/encounters/${id}`,
                { view: 'workspace' },
            );

            return response.data;
        },
        enabled: computed(() => Boolean(toValue(encounterId))),
    });
}
