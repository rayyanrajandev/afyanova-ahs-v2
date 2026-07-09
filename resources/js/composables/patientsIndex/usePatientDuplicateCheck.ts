import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type Ref } from 'vue';
import { apiPost } from '@/lib/apiClient';

/**
 * Phase 2 of reports/patients-index-modernization-plan.md — decided:
 * "Authoritative duplicate scoring: Server. Client: Thin UI layer that
 * calls the server and renders results." This composable is that thin
 * layer: it holds no scoring logic of its own, unlike the legacy page's
 * duplicateConfidenceScore()/duplicateComparisonRows()
 * (reports/patients-index-audit.md §1), which reimplemented
 * PatientDuplicateDetectionService's scoring client-side. Every result
 * here comes from POST /patients/duplicate-check, backed by the exact same
 * PatientDuplicateDetectionService::evaluate() call CreatePatientUseCase
 * makes on actual submission — so "what the check said" and "what
 * submission does" can never disagree.
 *
 * Matches both PatientDuplicateDetectionService::formatDuplicate() (hard
 * block: no confidence fields) and its warning shape (duplicateConfidence/
 * duplicateConfidenceLabel/matchedFields/code/message) — the same shape
 * POST /patients already returns in its `warnings` array, reused here
 * rather than inventing a second type for the same data.
 */
export type PatientDuplicateMatch = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    lastName: string | null;
    dateOfBirth: string | null;
    phone: string | null;
    gender: string | null;
    nationalId: string | null;
    countryCode: string | null;
    region: string | null;
    district: string | null;
    addressLine: string | null;
    status: string | null;
    createdAt: string | null;
    duplicateMatchType: 'hard_block' | 'strong_warning' | 'possible_warning';
    duplicateConfidence?: number;
    duplicateConfidenceLabel?: 'strong' | 'possible';
    matchedFields?: string[];
    code?: string;
    message?: string;
};

export type PatientDuplicateSeverity = 'none' | 'possible_warning' | 'strong_warning' | 'hard_block';

export type PatientDuplicateCheckIdentity = {
    firstName: string;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    phone: string;
    nationalId: string;
    addressLine: string;
    excludePatientId?: string | null;
};

type PatientDuplicateCheckResult = {
    severity: PatientDuplicateSeverity;
    duplicates: PatientDuplicateMatch[];
};

type PatientDuplicateCheckResponse = { data: PatientDuplicateCheckResult };

/**
 * A dry run isn't worth sending until there's enough identity for the
 * server to actually find something — mirrored 1:1 against what
 * EloquentPatientRepository can match on, not just the common case:
 * `findActiveHardDuplicateIdentifiers` matches on nationalId alone (no
 * name needed), and `findActiveDuplicateCandidates` matches on phone alone
 * or via its own `$hasDemographicCandidateKey` combinations (first+last,
 * last+DOB, first+DOB, gender+address). Gating on "first+last name only"
 * silently drops every one of those — e.g. typing a phone number or
 * national ID that matches an existing patient, without also typing a
 * matching name, would never trigger a check at all.
 */
function hasEnoughIdentity(identity: PatientDuplicateCheckIdentity): boolean {
    const firstName = identity.firstName.trim();
    const lastName = identity.lastName.trim();
    const phone = identity.phone.trim();
    const nationalId = identity.nationalId.trim();
    const dateOfBirth = identity.dateOfBirth.trim();
    const gender = identity.gender.trim();
    const addressLine = identity.addressLine.trim();

    return (
        nationalId.length >= 3 ||
        phone.length >= 6 ||
        (firstName.length >= 2 && lastName.length >= 2) ||
        (lastName.length >= 2 && dateOfBirth !== '') ||
        (firstName.length >= 2 && dateOfBirth !== '') ||
        (gender !== '' && addressLine.length >= 2)
    );
}

/**
 * `identity` is expected to already be debounced by the caller (e.g. via
 * @vueuse/core's refDebounced) — this composable reacts to whatever ref it's
 * given, it doesn't debounce itself, matching how useReceptionQueue.ts
 * leaves debouncing to its caller (reception/Queue.vue's patient search)
 * rather than baking a timing policy into the data-fetching composable.
 */
export function usePatientDuplicateCheck(
    identity: Ref<PatientDuplicateCheckIdentity>,
): UseQueryReturnType<PatientDuplicateCheckResult, Error> {
    return useQuery({
        queryKey: ['patient-duplicate-check', identity],
        queryFn: async () => {
            const current = identity.value;
            const response = await apiPost<PatientDuplicateCheckResponse>('/patients/duplicate-check', {
                body: {
                    firstName: current.firstName.trim() || null,
                    lastName: current.lastName.trim() || null,
                    gender: current.gender || null,
                    dateOfBirth: current.dateOfBirth || null,
                    phone: current.phone.trim() || null,
                    nationalId: current.nationalId.trim() || null,
                    addressLine: current.addressLine.trim() || null,
                    excludePatientId: current.excludePatientId ?? null,
                },
            });
            return response.data;
        },
        enabled: computed(() => hasEnoughIdentity(identity.value)),
    });
}
