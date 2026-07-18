<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { PaginationListItem, type PaginationListItemProps } from "reka-ui"
import { computed } from "vue"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const props = defineProps<PaginationListItemProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = computed(() => {
  const { class: _class, ...delegated } = props
  return delegated
})
</script>

<template>
  <PaginationListItem
    data-slot="pagination-item"
    v-bind="delegatedProps"
    :class="cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'shrink-0 data-[selected=true]:border data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground', props.class)"
  >
    <slot>{{ value }}</slot>
  </PaginationListItem>
</template>
