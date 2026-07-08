import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { attestationActorLabel, useMedicalRecordAttestations } from './useMedicalRecordAttestations';

async function mount(build: () => ReturnType<typeof useMedicalRecordAttestations>) {
    let composable!: ReturnType<typeof useMedicalRecordAttestations>;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const TestComponent = defineComponent({
        setup() {
            composable = build();
            return () => h('div');
        },
    });

    render(TestComponent, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));

    return composable;
}

describe('useMedicalRecordAttestations', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('loads the attestation list for the given record', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
            data: [
                {
                    id: 'att-1',
                    medicalRecordId: 'rec-1',
                    attestedByUserId: 5,
                    attestedByUserName: 'Dr. Amina',
                    attestationNote: 'Reviewed and confirmed.',
                    attestedAt: '2026-01-01T00:00:00Z',
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-01-01T00:00:00Z',
                },
            ],
        });

        const attestations = await mount(() => useMedicalRecordAttestations(() => 'rec-1'));

        expect(attestations.attestations.value).toHaveLength(1);
        expect(attestationActorLabel(attestations.attestations.value[0])).toBe('Dr. Amina');
    });

    it('rejects submitting a blank note without calling the API', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [] });
        const postSpy = vi.spyOn(apiClient, 'apiPost');

        const attestations = await mount(() => useMedicalRecordAttestations(() => 'rec-1'));
        attestations.note.value = '   ';
        const ok = await attestations.submit();

        expect(ok).toBe(false);
        expect(postSpy).not.toHaveBeenCalled();
        expect(attestations.submitError.value).toBe('Attestation note is required.');
    });

    it('submits the trimmed note and clears it on success', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [] });
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: {
                id: 'att-2',
                medicalRecordId: 'rec-1',
                attestedByUserId: 5,
                attestedByUserName: 'Dr. Amina',
                attestationNote: 'Confirmed.',
                attestedAt: '2026-01-02T00:00:00Z',
                createdAt: '2026-01-02T00:00:00Z',
                updatedAt: '2026-01-02T00:00:00Z',
            },
        });

        const attestations = await mount(() => useMedicalRecordAttestations(() => 'rec-1'));
        attestations.note.value = '  Confirmed.  ';
        const ok = await attestations.submit();

        expect(ok).toBe(true);
        expect(postSpy).toHaveBeenCalledWith('/medical-records/rec-1/signer-attestations', {
            body: { attestationNote: 'Confirmed.' },
        });
        expect(attestations.note.value).toBe('');
    });

    it('surfaces the server error and returns false on failure', async () => {
        vi.spyOn(apiClient, 'apiGet').mockResolvedValue({ data: [] });
        vi.spyOn(apiClient, 'apiPost').mockRejectedValue(new Error('nope'));

        const attestations = await mount(() => useMedicalRecordAttestations(() => 'rec-1'));
        attestations.note.value = 'Confirmed.';
        const ok = await attestations.submit();

        expect(ok).toBe(false);
        expect(attestations.submitError.value).toBe('nope');
    });
});
