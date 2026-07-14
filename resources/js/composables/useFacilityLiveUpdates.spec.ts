import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h, ref, type Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EchoCallback = () => void;

const echoCallbacks: EchoCallback[] = [];
const connectionStatusRef: Ref<'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'failed'> = ref('connected');

vi.mock('@laravel/echo-vue', () => ({
    useEcho: (_channelName: string, _event: string, callback: EchoCallback) => {
        echoCallbacks.push(callback);
        return {
            leaveChannel: vi.fn(),
            leave: vi.fn(),
            stopListening: vi.fn(),
            listen: vi.fn(),
            channel: vi.fn(),
        };
    },
    useConnectionStatus: () => connectionStatusRef,
}));

const scopeRef = ref<{ facility?: { id?: string | null } | null } | null>({ facility: { id: 'facility-1' } });

vi.mock('@/composables/usePlatformAccess', () => ({
    usePlatformAccess: () => ({ scope: scopeRef }),
}));

import { useFacilityLiveUpdates } from './useFacilityLiveUpdates';

async function mount<T>(build: () => T): Promise<T> {
    let composable!: T;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const TestComponent = defineComponent({
        setup() {
            composable = build();
            return () => h('div');
        },
    });

    render(TestComponent, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
    await flushPromises();

    return composable;
}

describe('useFacilityLiveUpdates', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        echoCallbacks.length = 0;
        connectionStatusRef.value = 'connected';
        scopeRef.value = { facility: { id: 'facility-1' } };
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('reports isLive true when the Echo connection status is connected', async () => {
        const result = await mount(() => useFacilityLiveUpdates([['some-query']]));

        expect(result.isLive.value).toBe(true);
    });

    it('reports isLive false when the Echo connection status is not connected', async () => {
        connectionStatusRef.value = 'disconnected';
        const result = await mount(() => useFacilityLiveUpdates([['some-query']]));

        expect(result.isLive.value).toBe(false);
    });

    it('invalidates the given query cache (debounced) when a board.updated event arrives', async () => {
        const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');

        await mount(() => useFacilityLiveUpdates([['some-query']]));

        expect(echoCallbacks).toHaveLength(1);
        echoCallbacks[0]();

        expect(invalidateSpy).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(500);

        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['some-query'] });
    });

    it('invalidates every query key passed in, not just the first', async () => {
        const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');

        await mount(() => useFacilityLiveUpdates([['reception-queue'], ['reception-queue-status-counts']]));

        echoCallbacks[0]();
        await vi.advanceTimersByTimeAsync(500);

        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['reception-queue'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['reception-queue-status-counts'] });
        expect(invalidateSpy).toHaveBeenCalledTimes(2);
    });

    it('debounces a burst of events into a single invalidation pass', async () => {
        const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');

        await mount(() => useFacilityLiveUpdates([['some-query']]));

        echoCallbacks[0]();
        echoCallbacks[0]();
        echoCallbacks[0]();
        await vi.advanceTimersByTimeAsync(500);

        expect(invalidateSpy).toHaveBeenCalledTimes(1);
    });
});
