import { render, waitFor } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStickyScrollContainer } from './useStickyScrollContainer';

describe('useStickyScrollContainer', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function mount(baseHeight?: string) {
        const TestComponent = defineComponent({
            setup() {
                const { scrollContainerHeight } = useStickyScrollContainer(baseHeight);
                return () =>
                    h(
                        'div',
                        { ref: 'scrollContainer', 'data-testid': 'height' },
                        scrollContainerHeight.value,
                    );
            },
        });
        return render(TestComponent);
    }

    it('sets scrollContainerHeight from the ref element\'s distance from the top of the viewport', async () => {
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            top: 120,
        } as DOMRect);

        const screen = mount();

        await waitFor(() => {
            expect(screen.getByTestId('height').textContent).toBe('calc(98dvh - 120px)');
        });
    });

    it('recomputes on window resize', async () => {
        const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            top: 80,
        } as DOMRect);

        const screen = mount();
        await waitFor(() => {
            expect(screen.getByTestId('height').textContent).toBe('calc(98dvh - 80px)');
        });

        rect.mockReturnValue({ top: 40 } as DOMRect);
        window.dispatchEvent(new Event('resize'));

        await waitFor(() => {
            expect(screen.getByTestId('height').textContent).toBe('calc(98dvh - 40px)');
        });
    });

    it('uses a custom base height when given one (e.g. WorkspaceV2.vue\'s 100dvh)', async () => {
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            top: 64,
        } as DOMRect);

        const screen = mount('100dvh');

        await waitFor(() => {
            expect(screen.getByTestId('height').textContent).toBe('calc(100dvh - 64px)');
        });
    });
});
