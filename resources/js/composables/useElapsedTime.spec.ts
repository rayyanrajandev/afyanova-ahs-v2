import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { elapsedMinutesSince, useElapsedTime } from './useElapsedTime';

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

describe('useElapsedTime', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns a null/empty result when since is null', async () => {
        const result = await mount(() => useElapsedTime(ref(null)));

        expect(result.value.minutes).toBeNull();
        expect(result.value.label).toBe('');
        expect(result.value.level).toBe('normal');
    });

    it('returns "Just now" for under a minute', async () => {
        const result = await mount(() => useElapsedTime(ref('2026-01-01T11:59:45.000Z')));

        expect(result.value.minutes).toBe(0);
        expect(result.value.label).toBe('Just now');
        expect(result.value.level).toBe('normal');
    });

    it('formats minutes under an hour as "Xm"', async () => {
        const result = await mount(() => useElapsedTime(ref('2026-01-01T11:45:00.000Z')));

        expect(result.value.minutes).toBe(15);
        expect(result.value.label).toBe('15m');
    });

    it('formats an hour or more as "Xh Ym"', async () => {
        const result = await mount(() => useElapsedTime(ref('2026-01-01T10:10:00.000Z')));

        expect(result.value.minutes).toBe(110);
        expect(result.value.label).toBe('1h 50m');
    });

    it('drops the minutes remainder when exactly on the hour', async () => {
        const result = await mount(() => useElapsedTime(ref('2026-01-01T10:00:00.000Z')));

        expect(result.value.label).toBe('2h');
    });

    it('escalates to warning at the warning threshold', async () => {
        const result = await mount(() => useElapsedTime(ref('2026-01-01T11:30:00.000Z'), 30, 60));

        expect(result.value.minutes).toBe(30);
        expect(result.value.level).toBe('warning');
    });

    it('escalates to critical at the critical threshold', async () => {
        const result = await mount(() => useElapsedTime(ref('2026-01-01T11:00:00.000Z'), 30, 60));

        expect(result.value.minutes).toBe(60);
        expect(result.value.level).toBe('critical');
    });

    it('stays normal below the warning threshold', async () => {
        const result = await mount(() => useElapsedTime(ref('2026-01-01T11:45:00.000Z'), 30, 60));

        expect(result.value.level).toBe('normal');
    });

    it('accepts custom thresholds via refs', async () => {
        const warning = ref(5);
        const critical = ref(10);
        const result = await mount(() => useElapsedTime(ref('2026-01-01T11:53:00.000Z'), warning, critical));

        expect(result.value.minutes).toBe(7);
        expect(result.value.level).toBe('warning');
    });

    it('re-evaluates minutes as time passes (ticking, not a one-shot render)', async () => {
        const result = await mount(() => useElapsedTime(ref('2026-01-01T11:45:00.000Z')));

        expect(result.value.minutes).toBe(15);

        vi.setSystemTime(new Date('2026-01-01T12:01:00.000Z'));
        await vi.advanceTimersByTimeAsync(30_000);

        expect(result.value.minutes).toBe(16);
    });

    it('treats an unparseable timestamp the same as null', async () => {
        const result = await mount(() => useElapsedTime(ref('not-a-date')));

        expect(result.value.minutes).toBeNull();
        expect(result.value.label).toBe('');
    });
});

describe('elapsedMinutesSince', () => {
    const now = new Date('2026-01-01T12:00:00.000Z');

    it('returns null for null/undefined/unparseable input', () => {
        expect(elapsedMinutesSince(null, now)).toBeNull();
        expect(elapsedMinutesSince(undefined, now)).toBeNull();
        expect(elapsedMinutesSince('not-a-date', now)).toBeNull();
    });

    it('returns whole minutes elapsed, floored', () => {
        expect(elapsedMinutesSince('2026-01-01T11:45:00.000Z', now)).toBe(15);
        expect(elapsedMinutesSince('2026-01-01T11:45:59.000Z', now)).toBe(14);
    });

    it('never returns a negative number for a future timestamp', () => {
        expect(elapsedMinutesSince('2026-01-01T12:05:00.000Z', now)).toBe(0);
    });
});
