<script lang="ts" setup>
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{ class?: HTMLAttributes["class"] }>()
</script>

<template>
  <div
    data-slot="calendar-header"
    :class="cn('relative flex w-full items-center justify-between pt-1', props.class)"
  >
    <slot />
  </div>
</template>
