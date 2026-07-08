import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, ref, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet, apiPost } from '@/lib/apiClient';
import { messageFromUnknown } from '@/lib/notify';

export type MedicalRecordSignerAttestation = {
    id: string;
    medicalRecordId: string | null;
    attestedByUserId: number | null;
    attestedByUserName: string | null;
    attestationNote: string | null;
    attestedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type AttestationListEnvelope = { data: MedicalRecordSignerAttestation[] };
type AttestationEnvelope = { data: MedicalRecordSignerAttestation };

/**
 * Signer attestation list + create (reports/clinical-notes-frontend-rebuild-plan.md
 * §3/§4). Same endpoints as the current Workspace.vue
 * (GET/POST /medical-records/{id}/signer-attestations). Eligibility
 * (finalized/amended status + medical.records.attest permission) is the
 * caller's job — this composable only owns the fetch/submit mechanics.
 */
export function useMedicalRecordAttestations(recordId: MaybeRefOrGetter<string | null | undefined>) {
    const queryClient = useQueryClient();
    const note = ref('');
    const submitError = ref<string | null>(null);

    const queryKey = computed(() => ['medical-record-attestations', toValue(recordId)]);

    const query = useQuery({
        queryKey,
        queryFn: async () => {
            const id = toValue(recordId);
            const response = await apiGet<AttestationListEnvelope>(
                `/medical-records/${id}/signer-attestations`,
                { page: 1, perPage: 20 },
            );
            return response.data;
        },
        enabled: computed(() => Boolean(toValue(recordId))),
    });

    const mutation = useMutation({
        mutationFn: async () => {
            const id = toValue(recordId);
            const trimmed = note.value.trim();
            if (!trimmed) {
                throw new Error('Attestation note is required.');
            }

            const response = await apiPost<AttestationEnvelope>(
                `/medical-records/${id}/signer-attestations`,
                { body: { attestationNote: trimmed } },
            );
            return response.data;
        },
        onSuccess: () => {
            note.value = '';
            submitError.value = null;
            void queryClient.invalidateQueries({ queryKey: queryKey.value });
        },
        onError: (error) => {
            submitError.value = messageFromUnknown(error, 'Unable to create signer attestation.');
        },
    });

    async function submit(): Promise<boolean> {
        try {
            await mutation.mutateAsync();
            return true;
        } catch {
            return false;
        }
    }

    return {
        attestations: computed(() => query.data.value ?? []),
        isLoading: query.isPending,
        error: query.error,
        note,
        submitError,
        isSubmitting: mutation.isPending,
        submit,
    };
}

export function attestationActorLabel(attestation: MedicalRecordSignerAttestation): string {
    if (attestation.attestedByUserName) return attestation.attestedByUserName;
    return attestation.attestedByUserId === null || attestation.attestedByUserId === undefined
        ? 'System'
        : `User #${attestation.attestedByUserId}`;
}
