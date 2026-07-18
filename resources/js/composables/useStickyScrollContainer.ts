import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';

/**
 * The bounded, independently-scrolling container every V2 page uses so a
 * sticky header (title/KPIs/tabs) can stay pinned while only the content
 * below it scrolls. Was duplicated verbatim across 14 pages before this
 * extraction; the template contract is unchanged — pair with
 * `<div ref="scrollContainer" :style="{ height: scrollContainerHeight }">`.
 *
 * The offset is measured as `getBoundingClientRect().top + window.scrollY`
 * (the element's position relative to the *document*, not the viewport) —
 * not plain `getBoundingClientRect().top` — because this recalculates on
 * every mount, not just first load: SidebarProvider's wrapper is
 * `min-h-svh` (no ceiling), and Vite HMR recreates the component — and
 * thus re-triggers `onMounted` — on script/composable edits. If that
 * fires while the page happens to be scrolled, plain `rect.top` comes
 * back smaller (or negative), and `calc(baseHeight - top)` bakes in a
 * height that's short by however much the page had scrolled — which
 * lets the container overflow past the viewport, which makes the outer
 * page scrollable too (SidebarProvider has no maximum height), and any
 * later recalculation while THAT scroll is in effect compounds the
 * error further. `getBoundingClientRect().top` shrinks by exactly
 * however much the page has scrolled; adding `window.scrollY` back
 * cancels that out and recovers the element's true resting offset
 * regardless of scroll position at measurement time — so the formula is
 * correct whether this fires at scroll position 0 or 600. Still clamped
 * to >= 0 as a defensive floor (this offset should never legitimately be
 * negative).
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
        const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY);
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
