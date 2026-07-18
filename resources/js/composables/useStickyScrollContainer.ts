import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';

/**
 * The bounded, independently-scrolling container every V2 page uses so a
 * sticky header (title/KPIs/tabs) can stay pinned while only the content
 * below it scrolls. Was duplicated verbatim across 14 pages before this
 * extraction; the template contract is unchanged — pair with
 * `<div ref="scrollContainer" :style="{ height: scrollContainerHeight }">`.
 *
 * `top` is clamped to >= 0 before subtracting: this recalculates on every
 * mount (not just first load — SidebarProvider's wrapper is `min-h-svh`,
 * so it has no ceiling, and Vite HMR recreates the component — and thus
 * re-triggers `onMounted` — on script/composable edits). If that happens
 * while the page is scrolled, `getBoundingClientRect().top` comes back
 * negative, and an unclamped `calc(baseHeight - top)` flips into
 * `calc(baseHeight + |top|)`, permanently inflating the container past the
 * viewport — which makes the page even more scrollable, compounding on the
 * next recalculation. Clamping keeps the formula meaningful even when this
 * fires mid-scroll.
 *
 * @param baseHeight Defaults to '98dvh' (leaves a small margin below the
 *   fold, the convention every page but one uses). encounters/WorkspaceV2.vue
 *   passes '100dvh' instead — it has no sidebar-layout ancestor bounding its
 *   content area, so it needs the full viewport rather than 98% of it.
 */
export function useStickyScrollContainer(baseHeight = '98dvh') {
    const scrollContainerRef = useTemplateRef<HTMLDivElement>('scrollContainer');
    const scrollContainerHeight = ref(baseHeight);

    function updateScrollContainerHeight(): void {
        const el = scrollContainerRef.value;
        if (!el) return;
        const top = Math.max(0, el.getBoundingClientRect().top);
        scrollContainerHeight.value = `calc(${baseHeight} - ${top}px)`;
    }

    onMounted(() => {
        updateScrollContainerHeight();
        window.addEventListener('resize', updateScrollContainerHeight);
    });
    onBeforeUnmount(() => {
        window.removeEventListener('resize', updateScrollContainerHeight);
    });

    return { scrollContainerHeight };
}
