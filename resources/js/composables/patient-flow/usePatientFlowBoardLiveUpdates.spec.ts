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

import { usePatientFlowBoardLiveUpdates } from './usePatientFlowBoardLiveUpdates';

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

/**
 * usePatientFlowBoardLiveUpdates is now a thin wrapper over the generalized
 * useFacilityLiveUpdates (Phase 3) — the subscribe/debounce/isLive mechanics
 * themselves are exercised in useFacilityLiveUpdates.spec.ts. This spec only
 * confirms the wrapper still targets the board's own query key.
 */
describe('usePatientFlowBoardLiveUpdates', () => {
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

    it('invalidates the patient-flow-board query key on a board.updated event', async () => {
        const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');

        await mount(() => usePatientFlowBoardLiveUpdates());

        echoCallbacks[0]();
        await vi.advanceTimersByTimeAsync(500);

        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['patient-flow-board'] });
    });

    it('reports isLive from the underlying Echo connection status', async () => {
        connectionStatusRef.value = 'disconnected';
        const result = await mount(() => usePatientFlowBoardLiveUpdates());

        expect(result.isLive.value).toBe(false);
    });
});
