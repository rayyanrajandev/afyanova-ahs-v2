import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const onlineRef = ref(true);
vi.mock('@vueuse/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@vueuse/core')>();
    return { ...actual, useOnline: () => onlineRef };
});

const countPendingRegistrationsMock = vi.fn();
const countPendingUpdatesMock = vi.fn();
const enqueueRegistrationMock = vi.fn();
const enqueueUpdateMock = vi.fn();
const syncRegistrationsMock = vi.fn();
const syncUpdatesMock = vi.fn();
vi.mock('@/lib/offlinePatientRegistration', () => ({
    countPendingOfflinePatientRegistrations: (...args: unknown[]) => countPendingRegistrationsMock(...args),
    countPendingOfflinePatientUpdates: (...args: unknown[]) => countPendingUpdatesMock(...args),
    enqueueOfflinePatientRegistration: (...args: unknown[]) => enqueueRegistrationMock(...args),
    enqueueOfflinePatientUpdate: (...args: unknown[]) => enqueueUpdateMock(...args),
    syncPendingOfflinePatientRegistrations: (...args: unknown[]) => syncRegistrationsMock(...args),
    syncPendingOfflinePatientUpdates: (...args: unknown[]) => syncUpdatesMock(...args),
}));

async function mount<T>(build: () => T): Promise<T> {
    let composable!: T;
    const TestComponent = defineComponent({
        setup() {
            composable = build();
            return () => h('div');
        },
    });

    render(TestComponent);
    await flushPromises();

    return composable;
}

describe('useOfflinePatientQueue', () => {
    beforeEach(() => {
        vi.resetModules();
        onlineRef.value = true;
        countPendingRegistrationsMock.mockReset().mockResolvedValue(0);
        countPendingUpdatesMock.mockReset().mockResolvedValue(0);
        enqueueRegistrationMock.mockReset();
        enqueueUpdateMock.mockReset();
        syncRegistrationsMock.mockReset();
        syncUpdatesMock.mockReset();
    });

    it('combines registration and update pending counts on first use', async () => {
        countPendingRegistrationsMock.mockResolvedValue(2);
        countPendingUpdatesMock.mockResolvedValue(3);
        const { useOfflinePatientQueue } = await import('./useOfflinePatientQueue');
        const queue = await mount(() => useOfflinePatientQueue());

        expect(queue.pendingCount.value).toBe(5);
    });

    it('saveOfflineRegistration enqueues and refreshes the combined count', async () => {
        countPendingRegistrationsMock.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
        enqueueRegistrationMock.mockResolvedValue({ id: 'offline-1', temporaryPatientNumber: 'TMP-PAT-1' });
        const { useOfflinePatientQueue } = await import('./useOfflinePatientQueue');
        const queue = await mount(() => useOfflinePatientQueue());

        const record = await queue.saveOfflineRegistration({ firstName: 'Amina' } as never);

        expect(enqueueRegistrationMock).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Amina' }));
        expect(record.temporaryPatientNumber).toBe('TMP-PAT-1');
        expect(queue.pendingCount.value).toBe(1);
    });

    it('saveOfflineUpdate enqueues and refreshes the combined count', async () => {
        countPendingUpdatesMock.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
        enqueueUpdateMock.mockResolvedValue({ id: 'offline-update-1', patientId: 'pat-1' });
        const { useOfflinePatientQueue } = await import('./useOfflinePatientQueue');
        const queue = await mount(() => useOfflinePatientQueue());

        const record = await queue.saveOfflineUpdate(
            { id: 'pat-1', patientNumber: 'PT1', patientName: 'Amina Moshi' },
            { firstName: 'Amina' } as never,
        );

        expect(enqueueUpdateMock).toHaveBeenCalledWith(
            { id: 'pat-1', patientNumber: 'PT1', patientName: 'Amina Moshi' },
            expect.objectContaining({ firstName: 'Amina' }),
        );
        expect(record.id).toBe('offline-update-1');
        expect(queue.pendingCount.value).toBe(1);
    });

    it('syncNow syncs both registrations and updates, summing the results', async () => {
        syncRegistrationsMock.mockResolvedValue({ attempted: 1, synced: 1, failed: 0, remaining: 0 });
        syncUpdatesMock.mockResolvedValue({ attempted: 2, synced: 1, failed: 1, remaining: 1 });
        const { useOfflinePatientQueue } = await import('./useOfflinePatientQueue');
        const queue = await mount(() => useOfflinePatientQueue());

        const result = await queue.syncNow();

        expect(syncRegistrationsMock).toHaveBeenCalledTimes(1);
        expect(syncUpdatesMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ synced: 2, failed: 1 });
    });

    it('syncNow is a no-op while offline', async () => {
        onlineRef.value = false;
        const { useOfflinePatientQueue } = await import('./useOfflinePatientQueue');
        const queue = await mount(() => useOfflinePatientQueue());

        const result = await queue.syncNow();

        expect(syncRegistrationsMock).not.toHaveBeenCalled();
        expect(syncUpdatesMock).not.toHaveBeenCalled();
        expect(result).toEqual({ synced: 0, failed: 0 });
    });

    it('auto-syncs both stores when the connection transitions from offline to online', async () => {
        onlineRef.value = false;
        syncRegistrationsMock.mockResolvedValue({ attempted: 1, synced: 1, failed: 0, remaining: 0 });
        syncUpdatesMock.mockResolvedValue({ attempted: 0, synced: 0, failed: 0, remaining: 0 });
        const { useOfflinePatientQueue } = await import('./useOfflinePatientQueue');
        await mount(() => useOfflinePatientQueue());

        onlineRef.value = true;
        await flushPromises();

        expect(syncRegistrationsMock).toHaveBeenCalledTimes(1);
        expect(syncUpdatesMock).toHaveBeenCalledTimes(1);
    });
});
