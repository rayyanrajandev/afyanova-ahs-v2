import { ref, watch, type Ref } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type AppointmentPatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
};

type PatientResponse = { data: AppointmentPatientSummary };

/**
 * GET /appointments returns patientId only — AppointmentResponseTransformer
 * has no patient identity fields — so a list of appointments has nothing to
 * display a name with on its own. The legacy appointments/Index.vue works
 * around this with page-local patientDirectory/hydratePatientSummary state
 * (appointments/Index.vue:733,2624-2723): one GET /patients/{id} per unique
 * patient on the loaded page, deduplicated and cached. This composable is
 * the same fix, extracted so both appointments/IndexV2.vue and any future
 * consumer can reuse it, not a new capability. No backend change — there is
 * no batch-fetch-by-ids endpoint (checked: ListPatientsUseCase has no `ids`
 * filter), so the per-page fan-out is an inherited cost, not something this
 * composable resolves.
 */
export function useAppointmentPatientDirectory(patientIds: Ref<string[]>) {
    const directory = ref<Record<string, AppointmentPatientSummary>>({});
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
