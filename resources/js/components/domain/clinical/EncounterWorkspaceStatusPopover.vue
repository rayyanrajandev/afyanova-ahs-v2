<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import type { EncounterWorkspaceStatusItem } from '@/types/encounterWorkspace';

defineProps<{
    primaryLabel: string;
    primaryVariant: 'default' | 'secondary' | 'outline' | 'destructive';
    items: EncounterWorkspaceStatusItem[];
}>();
</script>

<template>
    <Popover>
        <PopoverTrigger as-child>
            <Button
                variant="outline"
                size="sm"
                class="h-7 max-w-[14rem] gap-1.5 px-2.5 text-xs"
                data-test="encounter-workspace-status-trigger"
                :aria-label="`Encounter status: ${primaryLabel}. Open for details.`"
            >
                <span class="truncate">{{ primaryLabel }}</span>
                <AppIcon
                    name="chevron-down"
                    class="size-3 shrink-0 opacity-70"
                    aria-hidden="true"
                />
            </Button>
        </PopoverTrigger>
        <PopoverContent
            class="w-72 p-0"
            align="start"
            data-test="encounter-workspace-status-popover"
        >
            <ul
                class="divide-y"
                role="list"
                aria-label="Encounter status details"
            >
                <li
                    v-for="item in items"
                    :key="item.id"
                    class="px-3 py-2.5"
                >
                    <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0 space-y-0.5">
                            <p class="text-xs font-medium text-muted-foreground">
                                {{ item.label }}
                            </p>
                            <p class="text-sm font-medium text-foreground">
                                {{ item.value }}
                            </p>
                            <p
                                v-if="item.detail && item.variant === 'destructive'"
                                class="text-xs leading-5 text-muted-foreground"
                            >
                                {{ item.detail }}
                            </p>
                        </div>
                    </div>
                </li>
            </ul>
        </PopoverContent>
    </Popover>
</template>
