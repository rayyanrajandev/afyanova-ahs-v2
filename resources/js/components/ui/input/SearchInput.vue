<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import AppIcon from '@/components/AppIcon.vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
    modelValue?: string | number
    placeholder?: string
    disabled?: boolean
    id?: string
    class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: string | number): void
}>()
</script>

<template>
    <div :class="cn('relative', props.class)">
        <AppIcon
            name="search"
            class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
            v-bind="$attrs"
            :id="id"
            :model-value="modelValue"
            :placeholder="placeholder"
            :disabled="disabled"
            class="pl-9"
            @update:model-value="emit('update:modelValue', $event)"
        />
    </div>
</template>
