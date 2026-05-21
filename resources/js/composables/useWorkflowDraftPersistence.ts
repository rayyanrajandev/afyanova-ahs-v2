import {
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
    type Ref,
    type WatchStopHandle,
} from 'vue';
import { clearSensitiveLocalStorageKey } from '@/lib/browserStoragePolicy';

type BooleanRef = Readonly<Ref<boolean>> | Ref<boolean>;

type WorkflowDraftEnvelope<T> = {
    version: number;
    data: T;
};

type WorkflowDraftPersistenceOptions<T> = {
    key: string;
    shouldPersist: BooleanRef;
    capture: () => T;
    restore: (draft: T) => void;
    canRestore?: (draft: T) => boolean;
    onRestored?: () => void;
    version?: number;
    allowPlainBrowserStorage?: boolean;
};

export function useWorkflowDraftPersistence<T>(
    options: WorkflowDraftPersistenceOptions<T>,
) {
    const restoredDraft = ref(false);
    const version = options.version ?? 1;
    const plainBrowserStorageEnabled = options.allowPlainBrowserStorage === true;
    let stopPersistenceWatch: WatchStopHandle | null = null;

    function clearPersistedDraft(): void {
        clearSensitiveLocalStorageKey(options.key);
    }

    onMounted(() => {
        if (!plainBrowserStorageEnabled) {
            clearPersistedDraft();
            return;
        }

        if (typeof window === 'undefined') return;

        try {
            const rawDraft = window.localStorage.getItem(options.key);
            if (rawDraft) {
                const parsedDraft = JSON.parse(rawDraft) as WorkflowDraftEnvelope<T>;
                const draftData = parsedDraft?.data;
                const draftVersion = Number(parsedDraft?.version ?? 0);

                if (
                    draftData
                    && draftVersion === version
                    && (options.canRestore?.(draftData) ?? true)
                ) {
                    options.restore(draftData);
                    restoredDraft.value = true;
                    options.onRestored?.();
                }
            }
        } catch {
            clearPersistedDraft();
        }

        stopPersistenceWatch = watch(
            [
                () => options.shouldPersist.value,
                () => options.capture(),
            ],
            ([shouldPersist, draftSnapshot]) => {
                if (typeof window === 'undefined') return;

                if (!shouldPersist) {
                    clearPersistedDraft();
                    return;
                }

                try {
                    window.localStorage.setItem(options.key, JSON.stringify({
                        version,
                        data: draftSnapshot,
                    } satisfies WorkflowDraftEnvelope<T>));
                } catch {
                    // Ignore storage failures so order entry can continue.
                }
            },
            {
                deep: true,
            },
        );
    });

    onBeforeUnmount(() => {
        stopPersistenceWatch?.();
        stopPersistenceWatch = null;
    });

    return {
        restoredDraft,
        clearPersistedDraft,
    };
}
