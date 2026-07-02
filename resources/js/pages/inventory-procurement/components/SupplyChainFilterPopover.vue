<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const props = defineProps<{
  filterCount?: number;
  label?: string;
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
}>();

const open = ref(false);

function close() {
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="outline" size="sm" class="h-8 gap-1.5 rounded-lg text-xs shrink-0">
        <AppIcon name="sliders-horizontal" class="size-3.5" />
        {{ label ?? 'Filters' }}
        <Badge v-if="(filterCount ?? 0) > 0" variant="secondary" class="ml-1 h-5 px-1.5 text-[10px]">{{ filterCount }}</Badge>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      class="z-50 w-80 p-0"
      :close-on-interact-outside="false"
    >
      <div class="space-y-3 p-4">
        <slot />
      </div>
      <div class="flex items-center gap-2 border-t bg-muted/30 px-4 py-3">
        <slot name="footer">
          <Button size="sm" variant="outline" class="flex-1 gap-1.5" @click="emit('reset')">
            Reset
          </Button>
          <Button size="sm" class="flex-1 gap-1.5" @click="emit('apply'); close()">
            Apply filters
          </Button>
        </slot>
        <Button size="sm" variant="ghost" class="size-7 p-0 text-muted-foreground hover:text-foreground shrink-0" @click="close">
          <AppIcon name="x" class="size-3.5" />
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
