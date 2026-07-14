import { ref } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { apiGet } from '@/lib/apiClient';

/**
 * Deliberately minimal — just the fields a compact result row needs, not
 * PatientLookupField.vue's full PatientSummary (gender/DOB/contact/address
 * etc., used by its own richer selected-patient card). Extracted from
 * reception/Queue.vue's inline search, which duplicated a subset of
 * PatientLookupField.vue's own GET /patients debounced-search logic
 * without reusing it — this composable is the shared core both a compact
 * field (PatientQuickSearchField.vue) and any future consumer can build
 * on, without inheriting PatientLookupField's heavier UI (recent patients,
 * advanced search dialog, access-denied handling) when that's not needed.
 */
export type PatientQuickSearchResult = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    patientNumber: string | null;
};

type PatientQuickSearchResponse = { data: PatientQuickSearchResult[] };

export function usePatientQuickSearch(options?: { perPage?: number; minQueryLength?: number; debounceMs?: number }) {
    const perPage = options?.perPage ?? 5;
    const minQueryLength = options?.minQueryLength ?? 2;

    const results = ref<PatientQuickSearchResult[]>([]);
    const isPending = ref(false);

    const search = useDebounceFn(async (query: string) => {
        if (query.trim().length < minQueryLength) {
            results.value = [];
            return;
        }

        isPending.value = true;
        try {
            const response = await apiGet<PatientQuickSearchResponse>('/patients', {
                q: query.trim(),
                perPage,
            });
            results.value = response.data;
        } finally {
            isPending.value = false;
        }
    }, options?.debounceMs ?? 300);

    function clear(): void {
        results.value = [];
    }

    function displayName(patient: PatientQuickSearchResult): string {
        return [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unnamed patient';
    }

    return { results, isPending, search, clear, displayName };
}
