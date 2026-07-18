<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { PaginationEllipsis, type PaginationEllipsisProps } from "reka-ui"
import { computed } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<PaginationEllipsisProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = computed(() => {
  const { class: _class, ...delegated } = props
  return delegated
})
</script>

<template>
  <PaginationEllipsis
    data-slot="pagination-ellipsis"
    v-bind="delegatedProps"
    :class="cn('flex size-8 shrink-0 items-center justify-center text-sm text-muted-foreground', props.class)"
  >
    &#8230;
  </PaginationEllipsis>
</template>
