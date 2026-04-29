<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { X } from "lucide-vue-next"
import { computed } from "vue"
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from "@/lib/utils"

defineOptions({
  inheritAttrs: false,
})

interface AppDialogScrollContentProps extends DialogContentProps {
  class?: HTMLAttributes["class"]
  showCloseButton?: boolean
  variant?: "default" | "action" | "form" | "workspace"
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | null
}

const props = withDefaults(defineProps<AppDialogScrollContentProps>(), {
  showCloseButton: false,
  variant: "default",
  size: null,
})
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, "class", "showCloseButton", "variant", "size")

const forwarded = useForwardPropsEmits(delegatedProps, emits)

const sizeClass = computed(() => {
  const requestedSize = props.size
    ?? (props.variant === "workspace"
      ? "5xl"
      : props.variant === "form"
        ? "3xl"
        : "lg")

  return {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
    "3xl": "sm:max-w-3xl",
    "4xl": "sm:max-w-4xl",
    "5xl": "sm:max-w-5xl",
    "6xl": "sm:max-w-6xl",
  }[requestedSize]
})

const variantClass = computed(() => {
  if (props.variant === "workspace" || props.variant === "form") {
    return cn("flex max-h-[90vh] flex-col overflow-hidden p-0", sizeClass.value)
  }

  if (props.variant === "action") {
    return cn("gap-4", sizeClass.value)
  }

  return cn("gap-4", sizeClass.value)
})
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    >
      <DialogContent
        :data-dialog-variant="props.variant"
        :class="
          cn(
            'relative z-[70] my-8 grid w-full border border-border bg-background p-6 shadow-lg duration-200 sm:rounded-lg md:w-full',
            variantClass,
            props.class,
          )
        "
        v-bind="{ ...$attrs, ...forwarded }"
        @pointer-down-outside="(event) => {
          const originalEvent = event.detail.originalEvent;
          const target = originalEvent.target as HTMLElement;
          if (originalEvent.offsetX > target.clientWidth || originalEvent.offsetY > target.clientHeight) {
            event.preventDefault();
          }
        }"
      >
        <slot />

        <DialogClose
          v-if="showCloseButton"
          class="absolute top-4 right-4 p-0.5 transition-colors rounded-md hover:bg-secondary"
        >
          <X class="w-4 h-4" />
          <span class="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </DialogOverlay>
  </DialogPortal>
</template>
