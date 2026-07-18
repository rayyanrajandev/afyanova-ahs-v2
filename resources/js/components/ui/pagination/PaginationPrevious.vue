<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { PaginationPrev, type PaginationPrevProps } from "reka-ui"
import { computed } from "vue"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import AppIcon from "@/components/AppIcon.vue"

// `relative` is required, not cosmetic: the sr-only span below is
// `position: absolute` with no top/left, so its containing block is
// whichever ancestor is nearest with a non-static position. Without
// `relative` here, that resolves all the way up to <main data-slot=
// "sidebar-inset"> (which has `position: relative` in SidebarInset.vue),
// and the span's "static position" gets computed against <main>'s
// coordinate space at this row's *unclipped* flow position — deep inside
// a long scrollable list — which forces <main>'s own scrollHeight to
// stretch to contain it, producing a second, spurious outer scrollbar.
// `relative` here makes this button the containing block instead, so the
// span resolves locally and never leaks upward. (PaginationItem has no
// such span and was never affected.)

const props = defineProps<PaginationPrevProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = computed(() => {
  const { class: _class, ...delegated } = props
  return delegated
})
</script>

<template>
  <PaginationPrev
    data-slot="pagination-previous"
    v-bind="delegatedProps"
    :class="cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }), 'relative shrink-0', props.class)"
  >
    <AppIcon name="chevron-left" class="size-4" />
    <span class="sr-only">Previous page</span>
  </PaginationPrev>
</template>
