<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSidebarBadges } from '@/composables/useSidebarBadges';
import { useSidebarFavorites } from '@/composables/useSidebarFavorites';
import { useSidebarHistory } from '@/composables/useSidebarHistory';

const { badges } = useSidebarBadges();
const { recentItems, removeFromHistory, clearHistory } = useSidebarHistory();
const { isFavorite } = useSidebarFavorites();

const BADGE_HREF_MAP: Record<string, string> = {
    '/reception/queue': 'reception-queue',
    '/triage/queue': 'triage-queue',
    '/clinician/queue': 'clinician-queue',
    '/emergency/queue': 'emergency-queue',
    '/clinical-procedure-orders': 'clinical-procedure',
    '/laboratory-orders': 'laboratory',
    '/radiology-orders': 'radiology',
    '/pharmacy-orders': 'pharmacy',
    '/billing': 'billing',
};

const BADGE_CLASS_MAP: Record<string, string> = {
    'reception-queue': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    'triage-queue': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    'clinician-queue': 'bg-red-500/10 text-red-600 dark:text-red-400',
    'emergency-queue': 'bg-red-500/10 text-red-600 dark:text-red-400',
    laboratory: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    radiology: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    pharmacy: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    billing: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

function badgeCount(href: string): number | undefined {
    const key = BADGE_HREF_MAP[href];
    if (!key) return undefined;
    const count = badges.value[key];
    return count && count > 0 ? count : undefined;
}

function badgeClass(href: string): string | undefined {
    const key = BADGE_HREF_MAP[href];
    if (!key) return undefined;
    const count = badges.value[key];
    if (!count || count <= 0) return undefined;
    return BADGE_CLASS_MAP[key];
}
</script>

<template>
    <div
        v-if="recentItems.length > 0"
        class="fixed bottom-6 left-1/2 z-40 -translate-x-1/2"
    >
        <div class="flex items-center gap-2">
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
                        <Badge
                            v-if="badgeCount(item.href)"
                            :class="['h-4 min-w-4 px-1 text-[10px] font-normal', badgeClass(item.href)]"
                        >
                            {{ badgeCount(item.href) }}
                        </Badge>
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
            <TooltipProvider :delay-duration="300">
                <Tooltip>
                    <TooltipTrigger as-child>
                        <button
                            class="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
                            @click="clearHistory"
                        >
                            <AppIcon name="x" class="size-3" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center">
                        Clear all open views
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    </div>
</template>
