import { useOnline } from '@vueuse/core';
import { ref, watch, type Ref } from 'vue';
import {
    countPendingOfflinePatientRegistrations,
    countPendingOfflinePatientUpdates,
    enqueueOfflinePatientRegistration,
    enqueueOfflinePatientUpdate,
    syncPendingOfflinePatientRegistrations,
    syncPendingOfflinePatientUpdates,
    type OfflinePatientRegistrationPayload,
    type OfflinePatientRegistrationRecord,
    type OfflinePatientUpdatePayload,
    type OfflinePatientUpdateRecord,
} from '@/lib/offlinePatientRegistration';

/**
 * Real offline resilience for both patient registration AND edits, not a
 * legacy artifact this rebuild is entitled to drop: Tanzania clinic
 * connectivity is unreliable enough that "the form silently fails when the
 * network drops mid-entry" is a genuine regression versus the legacy
 * sheet's draft-autosave + offline-queue wiring, which the audit found
 * already covered updates too, not just registration (@/lib/
 * offlinePatientRegistration.ts's enqueueOfflinePatientUpdate/
 * syncPendingOfflinePatientUpdates existed but had no frontend caller
 * until PatientEditSheet.vue was brought to parity with
 * PatientRegistrationSheet.vue's UX).
 *
 * Originally useOfflinePatientRegistrationQueue.ts, renamed on that
 * extension — registration and update are two IndexedDB stores in the
 * same outbox, but one shared pendingCount/syncNow so IndexV2.vue's "N
 * saved offline" badge and sync action cover both without the page
 * needing to know which sheet produced which record, matching the legacy
 * page's own combined sync (Promise.all([syncRegistrations,
 * syncUpdates])).
 *
 * Module-level singleton state (matches usePlatformCountryProfile.ts's
 * established shape): every caller — both sheets and IndexV2.vue's header
 * badge — shares one live isOnline/pendingCount, so a sync triggered from
 * one place is immediately reflected in the other.
 */
const pendingCount = ref(0);
const syncing = ref(false);
const lastSyncError = ref<string | null>(null);

async function refreshPendingCount(): Promise<void> {
    try {
        const [registrations, updates] = await Promise.all([
            countPendingOfflinePatientRegistrations(),
            countPendingOfflinePatientUpdates(),
        ]);
        pendingCount.value = registrations + updates;
    } catch {
        // IndexedDB unavailable (e.g. private browsing) — offline queueing
        // simply won't be offered; this isn't fatal to the online path.
    }
}

let hasLoadedInitialCount = false;

export function useOfflinePatientQueue(): {
    isOnline: Readonly<Ref<boolean>>;
    pendingCount: Ref<number>;
    syncing: Ref<boolean>;
    lastSyncError: Ref<string | null>;
    saveOfflineRegistration: (payload: OfflinePatientRegistrationPayload) => Promise<OfflinePatientRegistrationRecord>;
    saveOfflineUpdate: (
        patient: { id: string; patientNumber: string | null; patientName: string },
        payload: OfflinePatientUpdatePayload,
    ) => Promise<OfflinePatientUpdateRecord>;
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
            const [registrationResult, updateResult] = await Promise.all([
                syncPendingOfflinePatientRegistrations(),
                syncPendingOfflinePatientUpdates(),
            ]);
            await refreshPendingCount();
            return {
                synced: registrationResult.synced + updateResult.synced,
                failed: registrationResult.failed + updateResult.failed,
            };
        } catch (error) {
            lastSyncError.value = error instanceof Error ? error.message : 'Unable to sync offline patient changes.';
            return { synced: 0, failed: 0 };
        } finally {
            syncing.value = false;
        }
    }

    async function saveOfflineRegistration(payload: OfflinePatientRegistrationPayload): Promise<OfflinePatientRegistrationRecord> {
        const record = await enqueueOfflinePatientRegistration(payload);
        await refreshPendingCount();
        return record;
    }

    async function saveOfflineUpdate(
        patient: { id: string; patientNumber: string | null; patientName: string },
        payload: OfflinePatientUpdatePayload,
    ): Promise<OfflinePatientUpdateRecord> {
        const record = await enqueueOfflinePatientUpdate(patient, payload);
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
        saveOfflineRegistration,
        saveOfflineUpdate,
        syncNow,
    };
}
