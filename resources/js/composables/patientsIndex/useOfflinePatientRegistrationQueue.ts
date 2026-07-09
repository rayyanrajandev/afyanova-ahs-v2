import { useOnline } from '@vueuse/core';
import { ref, watch, type Ref } from 'vue';
import {
    countPendingOfflinePatientRegistrations,
    enqueueOfflinePatientRegistration,
    syncPendingOfflinePatientRegistrations,
    type OfflinePatientRegistrationPayload,
    type OfflinePatientRegistrationRecord,
} from '@/lib/offlinePatientRegistration';

/**
 * Real offline resilience for patient registration, not a legacy artifact
 * this rebuild is entitled to drop: Tanzania clinic connectivity is
 * unreliable enough that "the form silently fails when the network drops
 * mid-entry" is a genuine regression versus the legacy sheet's draft-
 * autosave + offline-queue wiring. Reuses @/lib/offlinePatientRegistration
 * (the same IndexedDB-backed outbox the legacy page wrote to) so records
 * saved offline by either sheet land in the same queue and sync the same
 * way — this is a UI-layer wiring gap being closed, not new storage
 * infrastructure.
 *
 * Module-level singleton state (matches usePlatformCountryProfile.ts's
 * established shape): every caller — the registration sheet and
 * IndexV2.vue's header badge — shares one live isOnline/pendingCount, so
 * a sync triggered from one place is immediately reflected in the other.
 */
const pendingCount = ref(0);
const syncing = ref(false);
const lastSyncError = ref<string | null>(null);

async function refreshPendingCount(): Promise<void> {
    try {
        pendingCount.value = await countPendingOfflinePatientRegistrations();
    } catch {
        // IndexedDB unavailable (e.g. private browsing) — offline queueing
        // simply won't be offered; this isn't fatal to the online path.
    }
}

let hasLoadedInitialCount = false;

export function useOfflinePatientRegistrationQueue(): {
    isOnline: Readonly<Ref<boolean>>;
    pendingCount: Ref<number>;
    syncing: Ref<boolean>;
    lastSyncError: Ref<string | null>;
    saveOffline: (payload: OfflinePatientRegistrationPayload) => Promise<OfflinePatientRegistrationRecord>;
    syncNow: () => Promise<{ synced: number; failed: number }>;
} {
    const isOnline = useOnline();

    if (!hasLoadedInitialCount) {
        hasLoadedInitialCount = true;
        void refreshPendingCount();
    }

    async function syncNow(): Promise<{ synced: number; failed: number }> {
        if (syncing.value || !isOnline.value) {
            return { synced: 0, failed: 0 };
        }

        syncing.value = true;
        lastSyncError.value = null;
        try {
            const result = await syncPendingOfflinePatientRegistrations();
            await refreshPendingCount();
            return { synced: result.synced, failed: result.failed };
        } catch (error) {
            lastSyncError.value = error instanceof Error ? error.message : 'Unable to sync offline registrations.';
            return { synced: 0, failed: 0 };
        } finally {
            syncing.value = false;
        }
    }

    async function saveOffline(payload: OfflinePatientRegistrationPayload): Promise<OfflinePatientRegistrationRecord> {
        const record = await enqueueOfflinePatientRegistration(payload);
        await refreshPendingCount();
        return record;
    }

    watch(isOnline, (online, wasOnline) => {
        if (online && !wasOnline) {
            void syncNow();
        }
    });

    return {
        isOnline,
        pendingCount,
        syncing,
        lastSyncError,
        saveOffline,
        syncNow,
    };
}
