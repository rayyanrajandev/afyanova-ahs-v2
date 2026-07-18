<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { PaginationNext, type PaginationNextProps } from "reka-ui"
import { computed } from "vue"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import AppIcon from "@/components/AppIcon.vue"

// See the matching comment in PaginationPrevious.vue — `relative` here
// keeps the sr-only span's containing block local to this button instead
// of resolving up to <main data-slot="sidebar-inset">'s unclipped
// coordinate space and inflating its scrollHeight.

const props = defineProps<PaginationNextProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = computed(() => {
  const { class: _class, ...delegated } = props
  return delegated
})
</script>

<template>
  <PaginationNext
    data-slot="pagination-next"
    v-bind="delegatedProps"
    :class="cn(buttonVariants({ variant: 'outline', size: 'icon-sm' }), 'relative shrink-0', props.class)"
  >
    <span class="sr-only">Next page</span>
    <AppIcon name="chevron-right" class="size-4" />
  </PaginationNext>
</template>
