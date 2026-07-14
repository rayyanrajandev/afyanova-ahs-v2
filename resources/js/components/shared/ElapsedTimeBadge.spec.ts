import { render } from '@testing-library/vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ElapsedTimeBadge from './ElapsedTimeBadge.vue';

describe('ElapsedTimeBadge', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders nothing when since is null', () => {
        const { container } = render(ElapsedTimeBadge, { props: { since: null } });

        expect(container.textContent?.trim()).toBe('');
    });

    it('renders the elapsed label when since is set', () => {
        const { getByText } = render(ElapsedTimeBadge, { props: { since: '2026-01-01T11:45:00.000Z' } });

        expect(getByText('15m')).toBeTruthy();
    });

    it('applies the neutral class below the warning threshold', () => {
        const { getByText } = render(ElapsedTimeBadge, {
            props: { since: '2026-01-01T11:45:00.000Z', warningMinutes: 30, criticalMinutes: 60 },
        });

        expect(getByText('15m').className).toContain('text-muted-foreground');
    });

    it('applies the amber class at the warning threshold', () => {
        const { getByText } = render(ElapsedTimeBadge, {
            props: { since: '2026-01-01T11:30:00.000Z', warningMinutes: 30, criticalMinutes: 60 },
        });

        expect(getByText('30m').className).toContain('text-amber-700');
    });

    it('applies the rose class at the critical threshold', () => {
        const { getByText } = render(ElapsedTimeBadge, {
            props: { since: '2026-01-01T11:00:00.000Z', warningMinutes: 30, criticalMinutes: 60 },
        });

        expect(getByText('1h').className).toContain('text-rose-700');
    });
});
