<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { ref } from "vue"
import { useEventListener } from "@vueuse/core"
import { cn } from "@/lib/utils"
import { useSidebar } from "./utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()

const { sidebarWidth, setSidebarWidth, toggleSidebar } = useSidebar()
const dragStart = ref<{ x: number; width: number } | null>(null)
const wasDragged = ref(false)

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return

  dragStart.value = {
    x: event.clientX,
    width: sidebarWidth.value,
  }
  wasDragged.value = false
}

function onClick() {
  if (wasDragged.value) {
    wasDragged.value = false
    return
  }

  toggleSidebar()
}

useEventListener("pointermove", (event: PointerEvent) => {
  if (!dragStart.value) return

  const delta = event.clientX - dragStart.value.x
  if (Math.abs(delta) > 4) {
    wasDragged.value = true
  }

  if (wasDragged.value) {
    event.preventDefault()
    setSidebarWidth(dragStart.value.width + delta)
  }
})

useEventListener("pointerup", () => {
  dragStart.value = null
})
</script>

<template>
  <button
    data-sidebar="rail"
    data-slot="sidebar-rail"
    aria-label="Toggle Sidebar"
    :tabindex="-1"
    title="Toggle Sidebar"
    :class="cn(
      'hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex',
      'in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize',
      '[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize',
      'hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full',
      '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
      '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
      props.class,
    )"
    @pointerdown="onPointerDown"
    @click="onClick"
  >
    <slot />
  </button>
</template>
