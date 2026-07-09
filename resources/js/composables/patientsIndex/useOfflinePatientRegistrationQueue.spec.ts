import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const onlineRef = ref(true);
vi.mock('@vueuse/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@vueuse/core')>();
    return { ...actual, useOnline: () => onlineRef };
});

const countPendingMock = vi.fn();
const enqueueMock = vi.fn();
const syncMock = vi.fn();
vi.mock('@/lib/offlinePatientRegistration', () => ({
    countPendingOfflinePatientRegistrations: (...args: unknown[]) => countPendingMock(...args),
    enqueueOfflinePatientRegistration: (...args: unknown[]) => enqueueMock(...args),
    syncPendingOfflinePatientRegistrations: (...args: unknown[]) => syncMock(...args),
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

describe('useOfflinePatientRegistrationQueue', () => {
    beforeEach(() => {
        vi.resetModules();
        onlineRef.value = true;
        countPendingMock.mockReset().mockResolvedValue(0);
        enqueueMock.mockReset();
        syncMock.mockReset();
    });

    it('loads the pending count on first use', async () => {
        countPendingMock.mockResolvedValue(3);
        const { useOfflinePatientRegistrationQueue } = await import('./useOfflinePatientRegistrationQueue');
        const queue = await mount(() => useOfflinePatientRegistrationQueue());

        expect(queue.pendingCount.value).toBe(3);
    });

    it('saveOffline enqueues the payload and refreshes the pending count', async () => {
        countPendingMock.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
        enqueueMock.mockResolvedValue({ id: 'offline-1', temporaryPatientNumber: 'TMP-PAT-1' });
        const { useOfflinePatientRegistrationQueue } = await import('./useOfflinePatientRegistrationQueue');
        const queue = await mount(() => useOfflinePatientRegistrationQueue());

        const record = await queue.saveOffline({ firstName: 'Amina' } as never);

        expect(enqueueMock).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Amina' }));
        expect(record.temporaryPatientNumber).toBe('TMP-PAT-1');
        expect(queue.pendingCount.value).toBe(1);
    });

    it('syncNow is a no-op while offline', async () => {
        onlineRef.value = false;
        const { useOfflinePatientRegistrationQueue } = await import('./useOfflinePatientRegistrationQueue');
        const queue = await mount(() => useOfflinePatientRegistrationQueue());

        const result = await queue.syncNow();

        expect(syncMock).not.toHaveBeenCalled();
        expect(result).toEqual({ synced: 0, failed: 0 });
    });

    it('syncNow syncs pending records while online and refreshes the count', async () => {
        syncMock.mockResolvedValue({ attempted: 2, synced: 2, failed: 0, remaining: 0 });
        countPendingMock.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
        const { useOfflinePatientRegistrationQueue } = await import('./useOfflinePatientRegistrationQueue');
        const queue = await mount(() => useOfflinePatientRegistrationQueue());

        const result = await queue.syncNow();

        expect(syncMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ synced: 2, failed: 0 });
        expect(queue.pendingCount.value).toBe(0);
    });

    it('auto-syncs when the connection transitions from offline to online', async () => {
        onlineRef.value = false;
        syncMock.mockResolvedValue({ attempted: 1, synced: 1, failed: 0, remaining: 0 });
        const { useOfflinePatientRegistrationQueue } = await import('./useOfflinePatientRegistrationQueue');
        await mount(() => useOfflinePatientRegistrationQueue());

        onlineRef.value = true;
        await flushPromises();

        expect(syncMock).toHaveBeenCalledTimes(1);
    });

    it('surfaces a sync failure message without throwing', async () => {
        syncMock.mockRejectedValue(new Error('Network unreachable'));
        const { useOfflinePatientRegistrationQueue } = await import('./useOfflinePatientRegistrationQueue');
        const queue = await mount(() => useOfflinePatientRegistrationQueue());

        const result = await queue.syncNow();

        expect(result).toEqual({ synced: 0, failed: 0 });
        expect(queue.lastSyncError.value).toBe('Network unreachable');
    });
});
