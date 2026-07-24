<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSidebarFavorites } from '@/composables/useSidebarFavorites';
import { useSidebarHistory } from '@/composables/useSidebarHistory';

const { recentItems, removeFromHistory } = useSidebarHistory();
const { isFavorite } = useSidebarFavorites();
</script>

<template>
    <div
        v-if="recentItems.length > 0"
        class="mx-4 mt-3 flex items-center gap-2 lg:mx-6"
    >
        <div class="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            <span class="shrink-0 text-xs font-medium text-muted-foreground/60">
                Open Views
            </span>
            <div class="flex items-center gap-1.5">
                <div
                    v-for="item in recentItems"
                    :key="item.id"
                    class="group inline-flex h-7 shrink-0 items-center gap-0 rounded-lg border bg-background text-xs font-normal text-foreground shadow-xs"
                >
                    <Link
                        :href="item.href"
                        class="flex h-full items-center gap-1.5 rounded-l-lg px-2.5 hover:bg-accent/50"
                    >
                        <AppIcon
                            v-if="item.iconName"
                            :name="item.iconName"
                            class="size-3 shrink-0"
                        />
                        <span class="truncate max-w-[120px]">{{ item.title }}</span>
                        <AppIcon
                            v-if="isFavorite(item.id)"
                            name="star"
                            class="size-2.5 shrink-0 fill-amber-500 text-amber-500"
                        />
                    </Link>
                    <TooltipProvider :delay-duration="300">
                        <Tooltip>
                            <TooltipTrigger as-child>
                                <button
                                    class="flex size-7 shrink-0 items-center justify-center rounded-r-lg text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
                                    @click.prevent="removeFromHistory(item.id)"
                                >
                                    <AppIcon name="x" class="size-3" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center">
                                Remove from recent
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </div>
    </div>
</template>
