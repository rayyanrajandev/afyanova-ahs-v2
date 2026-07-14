import { ref, watch, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type DirectServicePatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
};

type PatientResponse = { data: DirectServicePatientSummary };

/**
 * GET /service-requests returns patientId only — same inherited gap
 * useAppointmentPatientDirectory.ts/useEmergencyCasePatientDirectory.ts
 * document for their own list endpoints (no batch-fetch-by-ids endpoint
 * exists). Kept as its own small composable rather than reusing one of
 * those — same reasoning as useEmergencyCasePatientDirectory.ts's docblock.
 */
export function useDirectServicePatientDirectory(patientIds: Ref<string[]>) {
    const directory = ref<Record<string, DirectServicePatientSummary>>({});
    const pending = new Set<string>();

    async function hydrate(id: string): Promise<void> {
        if (!id || directory.value[id] || pending.has(id)) return;
        pending.add(id);
        try {
            const response = await apiGet<PatientResponse>(`/patients/${id}`);
            directory.value = { ...directory.value, [id]: response.data };
        } catch {
            // Keep the list usable when a single patient lookup fails.
        } finally {
            pending.delete(id);
        }
    }

    watch(
        patientIds,
        (ids) => {
            for (const id of new Set(ids.filter(Boolean))) {
                void hydrate(id);
            }
        },
        { immediate: true },
    );

    function displayName(patientId: string | null | undefined): string {
        const id = String(patientId ?? '').trim();
        if (!id) return 'Patient pending';
        const patient = directory.value[id];
        if (!patient) return 'Loading…';
        const fullName = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ').trim();
        return fullName || patient.patientNumber || `Patient ${id.slice(0, 8)}…`;
    }

    function patientNumber(patientId: string | null | undefined): string {
        const id = String(patientId ?? '').trim();
        if (!id) return '';
        return directory.value[id]?.patientNumber ?? '';
    }

    return { directory, displayName, patientNumber };
}
