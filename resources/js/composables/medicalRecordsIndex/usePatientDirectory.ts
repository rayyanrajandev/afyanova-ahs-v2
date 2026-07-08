import { ref, watch, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type PatientDirectorySummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
};

type PatientResponse = { data: PatientDirectorySummary };

/**
 * The medical records list endpoint deliberately doesn't join patient name
 * (MedicalRecordResponseTransformer only has patientId — confirmed in Phase 0,
 * not an oversight to "fix": this is a cross-domain read the MedicalRecord
 * module doesn't own). The old Index.vue enriches the visible page of rows
 * with individual GET /patients/{id} lookups, cached in a directory map so the
 * same patient isn't re-fetched across pages/re-renders. Ported as-is rather
 * than adding a list-specific backend transformer, since that would violate
 * this rebuild's "no new backend contract" scope.
 */
export function usePatientDirectory(patientIds: Ref<string[]>) {
    const directory = ref<Record<string, PatientDirectorySummary>>({});
    const pending = new Set<string>();

    async function hydrate(ids: string[]): Promise<void> {
        const uncached = [...new Set(ids)].filter(
            (id) => id !== '' && !directory.value[id] && !pending.has(id),
        );
        if (uncached.length === 0) return;

        uncached.forEach((id) => pending.add(id));

        const results = await Promise.allSettled(
            uncached.map((id) => apiGet<PatientResponse>(`/patients/${id}`)),
        );

        const next = { ...directory.value };
        results.forEach((result, index) => {
            const id = uncached[index];
            pending.delete(id);
            if (result.status === 'fulfilled') {
                next[id] = result.value.data;
            }
        });
        directory.value = next;
    }

    watch(patientIds, (ids) => void hydrate(ids), { immediate: true });

    return { directory, hydrate };
}
