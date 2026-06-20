<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuBadge,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/composables/useCurrentUrl';
import { useSidebarFavorites } from '@/composables/useSidebarFavorites';
import { cn } from '@/lib/utils';
import { type NavItem } from '@/types';

const props = defineProps<{
    items: NavItem[];
    label?: string;
    /** When provided, items not matching the query get low opacity */
    searchQuery?: string;
    /** Show star toggle for favorites */
    showFavorites?: boolean;
    /** Treat as "favorites" section (disable toggle on these items) */
    isFavoritesSection?: boolean;
}>();

const emit = defineEmits<{
    'toggle-favorite': [item: NavItem];
}>();

const { isCurrentUrl } = useCurrentUrl();
const { isFavorite } = useSidebarFavorites();

function itemMatchesSearch(item: NavItem, query: string | undefined): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    const hrefStr = typeof item.href === 'string' ? item.href : '';
    return (
        item.title.toLowerCase().includes(q) ||
        hrefStr.toLowerCase().includes(q)
    );
}
</script>

<template>
    <SidebarGroup class="px-2 py-0">
        <SidebarGroupLabel
            v-if="label && (!searchQuery || items.some((item) => itemMatchesSearch(item, searchQuery)))"
            class="pointer-events-none group-data-[collapsible=icon]:hidden"
        >
            {{ label }}
        </SidebarGroupLabel>
        <SidebarMenu>
            <SidebarMenuItem
                v-for="item in items"
                :key="item.id ?? (typeof item.href === 'string' ? item.href : String(item.href))"
                :class="cn(
                    'relative',
                    searchQuery && !itemMatchesSearch(item, searchQuery) && 'opacity-20 pointer-events-none',
                )"
            >
                <SidebarMenuButton
                    as-child
                    :is-active="isCurrentUrl(item.href)"
                    :tooltip="item.title"
                    class="group/menu-button"
                >
                    <Link :href="item.href">
                        <!-- Active left-border indicator (thin accent bar) -->
                        <span
                            v-if="isCurrentUrl(item.href)"
                            class="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary transition-all duration-200"
                            aria-hidden="true"
                        />
                        <AppIcon
                            v-if="item.iconName || item.icon"
                            :name="item.iconName"
                            :fallback="item.icon"
                            class="size-4 shrink-0"
                        />
                        <span class="truncate">{{ item.title }}</span>
                        <!-- Badge for notification counts -->
                        <SidebarMenuBadge
                            v-if="item.badge"
                            class="ml-auto"
                        >
                            {{ item.badge }}
                        </SidebarMenuBadge>
                    </Link>
                </SidebarMenuButton>
                <!-- Favorite star (always visible in expanded state, hidden when collapsed) -->
                <button
                    v-if="showFavorites && item.id && !isFavoritesSection"
                    class="absolute right-1 top-1/2 -translate-y-1/2 flex size-5 items-center justify-center rounded-sm text-muted-foreground/40 opacity-0 transition-all duration-150 hover:text-amber-500 group-hover/menu-button:opacity-100 group-data-[collapsible=icon]:hidden"
                    :title="isFavorite(item.id) ? 'Remove from favorites' : 'Add to favorites'"
                    @click.prevent.stop="emit('toggle-favorite', item)"
                >
                    <span v-if="isFavorite(item.id)" class="text-amber-500 opacity-100">★</span>
                    <span v-else>☆</span>
                </button>
            </SidebarMenuItem>
        </SidebarMenu>
    </SidebarGroup>
</template>