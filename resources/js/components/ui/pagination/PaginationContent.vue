<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { PaginationList, type PaginationListProps } from "reka-ui"
import { computed } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<PaginationListProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = computed(() => {
  const { class: _class, ...delegated } = props
  return delegated
})
</script>

<template>
  <PaginationList
    v-slot="{ items }"
    data-slot="pagination-content"
    v-bind="delegatedProps"
    :class="cn('flex flex-row flex-nowrap items-center gap-1', props.class)"
  >
    <slot :items="items" />
  </PaginationList>
</template>
