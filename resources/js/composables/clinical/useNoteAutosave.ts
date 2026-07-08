import { onBeforeUnmount, onMounted, ref } from 'vue';

export type AutosaveFlushReason =
    | 'debounce'
    | 'max-wait'
    | 'visibility'
    | 'pagehide'
    | 'blur'
    | 'online'
    | 'manual'
    | 'unmount';

type AutosaveSave = (context: {
    reason: AutosaveFlushReason;
    keepalive: boolean;
}) => Promise<unknown> | unknown;

/**
 * Autosave scheduler, isolated from persistence so it can be unit-tested with
 * fake timers. Reproduces the contract documented in
 * reports/clinical-note-audit/05-saving-mechanism.md §5.2:
 *   - 1.5s debounce, reset on every change
 *   - 15s max-wait ceiling that fires even while the user keeps typing
 *   - flush on tab-hide / pagehide / blur / regained connectivity / unmount
 * The save callback owns single-flight and keepalive delivery; this composable
 * only decides *when* to call it.
 */
export function useNoteAutosave(options: {
    save: AutosaveSave;
    isDirty: () => boolean;
    canSave: () => boolean;
    debounceMs?: number;
    maxWaitMs?: number;
    /** Test seam — skip real window/document listener wiring. */
    wireLifecycleListeners?: boolean;
}) {
    const debounceMs = options.debounceMs ?? 1500;
    const maxWaitMs = options.maxWaitMs ?? 15000;
    const wireLifecycleListeners = options.wireLifecycleListeners ?? true;

    const pending = ref(false);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

    function clearDebounce(): void {
        if (debounceTimer !== null) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
    }

    function clearMaxWait(): void {
        if (maxWaitTimer !== null) {
            clearTimeout(maxWaitTimer);
            maxWaitTimer = null;
        }
    }

    function clearTimers(): void {
        clearDebounce();
        clearMaxWait();
        pending.value = false;
    }

    /** Call on every content change. */
    function notifyChange(): void {
        if (!options.canSave() || !options.isDirty()) {
            return;
        }

        pending.value = true;
        clearDebounce();
        debounceTimer = setTimeout(() => void flush('debounce'), debounceMs);

        // Max-wait is armed once per change-run and NOT reset by subsequent
        // keystrokes, so continuous typing can't defer a save indefinitely.
        if (maxWaitTimer === null) {
            maxWaitTimer = setTimeout(() => void flush('max-wait'), maxWaitMs);
        }
    }

    async function flush(
        reason: AutosaveFlushReason,
        opts: { keepalive?: boolean } = {},
    ): Promise<void> {
        clearTimers();

        if (!options.canSave() || !options.isDirty()) {
            return;
        }

        await options.save({ reason, keepalive: opts.keepalive ?? false });

        // If the content changed again while the save was in flight (or the save
        // was skipped due to single-flight), re-arm so the trailing edit persists.
        if (options.canSave() && options.isDirty()) {
            notifyChange();
        }
    }

    function handleVisibility(): void {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            void flush('visibility', { keepalive: true });
        }
    }
    function handlePageHide(): void {
        void flush('pagehide', { keepalive: true });
    }
    function handleBlur(): void {
        void flush('blur');
    }
    function handleOnline(): void {
        void flush('online');
    }

    if (wireLifecycleListeners) {
        onMounted(() => {
            if (typeof window === 'undefined') return;
            document.addEventListener('visibilitychange', handleVisibility);
            window.addEventListener('pagehide', handlePageHide);
            window.addEventListener('blur', handleBlur);
            window.addEventListener('online', handleOnline);
        });

        onBeforeUnmount(() => {
            if (typeof window !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisibility);
                window.removeEventListener('pagehide', handlePageHide);
                window.removeEventListener('blur', handleBlur);
                window.removeEventListener('online', handleOnline);
            }
            void flush('unmount', { keepalive: true });
        });
    }

    return {
        pending,
        notifyChange,
        flush,
        clearTimers,
    };
}
