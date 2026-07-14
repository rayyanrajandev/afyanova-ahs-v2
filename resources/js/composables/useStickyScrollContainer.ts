import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';

/**
 * The bounded, independently-scrolling container every V2 page uses so a
 * sticky header (title/KPIs/tabs) can stay pinned while only the content
 * below it scrolls. Was duplicated verbatim across 14 pages before this
 * extraction; the template contract is unchanged — pair with
 * `<div ref="scrollContainer" :style="{ height: scrollContainerHeight }">`.
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
        scrollContainerHeight.value = `calc(${baseHeight} - ${el.getBoundingClientRect().top}px)`;
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
