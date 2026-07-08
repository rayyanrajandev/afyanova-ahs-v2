import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useNoteAutosave } from './useNoteAutosave';

/**
 * Proves the autosave scheduler reproduces the exact contract documented in
 * reports/clinical-note-audit/05-saving-mechanism.md §5.2: 1.5s debounce reset
 * on every change, a 15s max-wait ceiling that is NOT reset by further typing,
 * and single re-arming after a flush if content changed mid-save.
 */
describe('useNoteAutosave', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function makeHarness(overrides: { dirty?: boolean; canSave?: boolean } = {}) {
        const save = vi.fn().mockResolvedValue(undefined);
        let dirty = overrides.dirty ?? true;
        let canSave = overrides.canSave ?? true;

        const autosave = useNoteAutosave({
            save,
            isDirty: () => dirty,
            canSave: () => canSave,
            wireLifecycleListeners: false,
        });

        return {
            save,
            autosave,
            setDirty: (value: boolean) => (dirty = value),
            setCanSave: (value: boolean) => (canSave = value),
        };
    }

    it('does not save before the 1.5s debounce elapses', () => {
        const { save, autosave } = makeHarness();

        autosave.notifyChange();
        vi.advanceTimersByTime(1499);

        expect(save).not.toHaveBeenCalled();
    });

    it('saves once the 1.5s debounce elapses with no further changes', async () => {
        const { save, autosave } = makeHarness();

        autosave.notifyChange();
        await vi.advanceTimersByTimeAsync(1500);

        expect(save).toHaveBeenCalledTimes(1);
        expect(save).toHaveBeenCalledWith({ reason: 'debounce', keepalive: false });
    });

    it('resets the debounce on every change, deferring the save', async () => {
        const { save, autosave } = makeHarness();

        autosave.notifyChange();
        vi.advanceTimersByTime(1000);
        autosave.notifyChange(); // resets debounce
        vi.advanceTimersByTime(1000);
        expect(save).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(500);
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('forces a save at the 15s max-wait ceiling even under continuous typing', async () => {
        const { save, autosave } = makeHarness();

        autosave.notifyChange();
        // Keep resetting the debounce every second for 14 seconds — never letting
        // the 1.5s debounce fire on its own.
        for (let elapsed = 0; elapsed < 14000; elapsed += 1000) {
            vi.advanceTimersByTime(1000);
            autosave.notifyChange();
        }
        expect(save).not.toHaveBeenCalled();

        // The max-wait timer was armed at t=0 and fires at t=15000 regardless.
        await vi.advanceTimersByTimeAsync(1000);
        expect(save).toHaveBeenCalledWith({ reason: 'max-wait', keepalive: false });
    });

    it('does not schedule a save when there is nothing dirty', () => {
        const { save, autosave } = makeHarness({ dirty: false });

        autosave.notifyChange();
        vi.advanceTimersByTime(20000);

        expect(save).not.toHaveBeenCalled();
    });

    it('does not schedule a save when canSave() is false (e.g. locked or conflicted)', () => {
        const { save, autosave } = makeHarness({ canSave: false });

        autosave.notifyChange();
        vi.advanceTimersByTime(20000);

        expect(save).not.toHaveBeenCalled();
    });

    it('manual flush saves immediately and clears pending timers', async () => {
        // isDirty becomes false once the save "persists" — matching how the real
        // caller derives dirtiness by comparing content against lastSavedContent.
        const { save, autosave, setDirty } = makeHarness();
        save.mockImplementation(() => {
            setDirty(false);
            return Promise.resolve();
        });

        autosave.notifyChange();
        await autosave.flush('manual');

        expect(save).toHaveBeenCalledWith({ reason: 'manual', keepalive: false });

        // No further save should fire from the timers that were cleared, since
        // nothing is dirty anymore.
        await vi.advanceTimersByTimeAsync(16000);
        expect(save).toHaveBeenCalledTimes(1);
    });

    it('passes keepalive through for teardown-triggered flushes', async () => {
        const { save, autosave } = makeHarness();

        autosave.notifyChange();
        await autosave.flush('pagehide', { keepalive: true });

        expect(save).toHaveBeenCalledWith({ reason: 'pagehide', keepalive: true });
    });

    it('re-arms after a flush if content is still dirty (edit-during-save case)', async () => {
        const { save, autosave, setDirty } = makeHarness();

        // Simulate: dirty at flush time, but becomes dirty again immediately
        // after (as if the user kept typing while the save was in flight).
        let callCount = 0;
        save.mockImplementation(() => {
            callCount += 1;
            if (callCount === 1) {
                setDirty(true);
            }
            return Promise.resolve();
        });

        autosave.notifyChange();
        await autosave.flush('manual');

        // Re-armed: advancing the debounce window should trigger a second save.
        await vi.advanceTimersByTimeAsync(1500);
        expect(save).toHaveBeenCalledTimes(2);
    });
});
