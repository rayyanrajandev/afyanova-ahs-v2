<script setup lang="ts">
import type { PaginationRootEmits, PaginationRootProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { PaginationRoot, useForwardPropsEmits } from "reka-ui"
import { computed } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<PaginationRootProps & { class?: HTMLAttributes["class"] }>()
const emits = defineEmits<PaginationRootEmits>()

const delegatedProps = computed(() => {
  const { class: _class, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <PaginationRoot
    data-slot="pagination"
    v-bind="forwarded"
    :class="cn('flex shrink-0 items-center gap-2', props.class)"
  >
    <slot />
  </PaginationRoot>
</template>
