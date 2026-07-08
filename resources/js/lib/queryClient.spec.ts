import { describe, expect, it } from 'vitest';
import { createAppQueryClient } from './queryClient';

describe('createAppQueryClient', () => {
    it('returns a fresh QueryClient instance on every call (required for SSR isolation)', () => {
        const first = createAppQueryClient();
        const second = createAppQueryClient();

        expect(first).not.toBe(second);
    });

    it('disables refetch-on-window-focus by default', () => {
        const client = createAppQueryClient();

        expect(client.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
    });
});
