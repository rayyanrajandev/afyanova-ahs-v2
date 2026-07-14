<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuBadge,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
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
    'item-select': [item: NavItem];
}>();

const { isCurrentUrl } = useCurrentUrl();
const { isFavorite } = useSidebarFavorites();

type NavBlock =
    | {
          type: 'item';
          key: string;
          item: NavItem;
      }
    | {
          type: 'group';
          key: string;
          label: string;
          items: NavItem[];
          isActive: boolean;
      };

function itemKey(item: NavItem): string {
    return (
        item.id ??
        (typeof item.href === 'string' ? item.href : String(item.href))
    );
}

function itemMatchesSearch(item: NavItem, query: string | undefined): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    const hrefStr = typeof item.href === 'string' ? item.href : '';
    return (
        item.title.toLowerCase().includes(q) ||
        hrefStr.toLowerCase().includes(q)
    );
}

const navBlocks = computed<NavBlock[]>(() => {
    const blocks: NavBlock[] = [];
    const groups = new Map<string, Extract<NavBlock, { type: 'group' }>>();

    for (const item of props.items) {
        if (!item.subGroup) {
            blocks.push({
                type: 'item',
                key: itemKey(item),
                item,
            });
            continue;
        }

        const groupKey = `${item.section ?? 'section'}:${item.subGroup}`;
        let group = groups.get(groupKey);

        if (!group) {
            group = {
                type: 'group',
                key: groupKey,
                label: item.subGroupLabel ?? item.subGroup,
                items: [],
                isActive: false,
            };
            groups.set(groupKey, group);
            blocks.push(group);
        }

        group.items.push(item);
        group.isActive = group.isActive || isCurrentUrl(item.href);
    }

    return blocks;
});
</script>

<template>
    <SidebarGroup class="px-2 py-0">
        <SidebarGroupLabel
            v-if="
                label &&
                (!searchQuery ||
                    items.some((item) => itemMatchesSearch(item, searchQuery)))
            "
            class="pointer-events-none group-data-[collapsible=icon]:hidden"
        >
            {{ label }}
        </SidebarGroupLabel>
        <SidebarMenu>
            <template v-for="block in navBlocks" :key="block.key">
                <SidebarMenuItem
                    v-if="block.type === 'item'"
                    :class="
                        cn(
                            'relative',
                            searchQuery &&
                                !itemMatchesSearch(block.item, searchQuery) &&
                                'pointer-events-none opacity-20',
                        )
                    "
                >
                    <SidebarMenuButton
                        as-child
                        :is-active="isCurrentUrl(block.item.href)"
                        :tooltip="block.item.title"
                        class="group/menu-button"
                    >
                        <Link
                            :href="block.item.href"
                            @click="emit('item-select', block.item)"
                        >
                            <span
                                v-if="isCurrentUrl(block.item.href)"
                                class="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary transition-all duration-200"
                                aria-hidden="true"
                            />
                            <AppIcon
                                v-if="block.item.iconName || block.item.icon"
                                :name="block.item.iconName"
                                :fallback="block.item.icon"
                                class="size-4 shrink-0"
                            />
                            <span class="truncate">{{ block.item.title }}</span>
                            <SidebarMenuBadge
                                v-if="block.item.badge"
                                class="ml-auto"
                            >
                                {{ block.item.badge }}
                            </SidebarMenuBadge>
                        </Link>
                    </SidebarMenuButton>
                    <button
                        v-if="
                            showFavorites &&
                            block.item.id &&
                            !isFavoritesSection
                        "
                        class="absolute top-1/2 right-1 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground/40 opacity-0 transition-all duration-150 group-hover/menu-button:opacity-100 group-data-[collapsible=icon]:hidden hover:text-amber-500"
                        :title="
                            isFavorite(block.item.id)
                                ? 'Remove from favorites'
                                : 'Add to favorites'
                        "
                        @click.prevent.stop="
                            emit('toggle-favorite', block.item)
                        "
                    >
                        <AppIcon
                            v-if="isFavorite(block.item.id)"
                            name="star"
                            class="size-3.5 fill-amber-500 text-amber-500 opacity-100"
                        />
                        <AppIcon
                            v-else
                            name="star"
                            class="size-3.5 text-muted-foreground/50"
                        />
                    </button>
                </SidebarMenuItem>

                <Collapsible
                    v-else
                    as-child
                    class="group/collapsible"
                    :default-open="block.isActive || Boolean(searchQuery)"
                >
                    <SidebarMenuItem>
                            <CollapsibleTrigger as-child>
                                <SidebarMenuButton :is-active="block.isActive">
                                    <AppIcon
                                        :name="block.items[0]?.subGroupIcon ?? 'folder'"
                                        class="size-4 shrink-0"
                                    />
                                <span class="truncate">{{ block.label }}</span>
                                <AppIcon
                                    name="chevron-right"
                                    class="ml-auto size-3.5 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90"
                                />
                            </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <SidebarMenuSub>
                                <SidebarMenuSubItem
                                    v-for="item in block.items"
                                    :key="itemKey(item)"
                                    :class="
                                        cn(
                                            'relative',
                                            searchQuery &&
                                                !itemMatchesSearch(
                                                    item,
                                                    searchQuery,
                                                ) &&
                                                'pointer-events-none opacity-20',
                                        )
                                    "
                                >
                                    <SidebarMenuSubButton
                                        as-child
                                        :is-active="isCurrentUrl(item.href)"
                                    >
                                        <Link
                                            :href="item.href"
                                            @click="emit('item-select', item)"
                                        >
                                            <AppIcon
                                                v-if="
                                                    item.iconName || item.icon
                                                "
                                                :name="item.iconName"
                                                :fallback="item.icon"
                                                class="size-3.5 shrink-0"
                                            />
                                            <span class="truncate">{{
                                                item.title
                                            }}</span>
                                            <SidebarMenuBadge
                                                v-if="item.badge"
                                                class="ml-auto"
                                            >
                                                {{ item.badge }}
                                            </SidebarMenuBadge>
                                        </Link>
                                    </SidebarMenuSubButton>
                                    <button
                                        v-if="
                                            showFavorites &&
                                            item.id &&
                                            !isFavoritesSection
                                        "
                                        class="absolute top-1/2 right-1 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground/40 opacity-0 transition-all duration-150 group-hover/menu-sub-item:opacity-100 hover:text-amber-500"
                                        :title="
                                            isFavorite(item.id)
                                                ? 'Remove from favorites'
                                                : 'Add to favorites'
                                        "
                                        @click.prevent.stop="
                                            emit('toggle-favorite', item)
                                        "
                                    >
                                        <AppIcon
                                            v-if="isFavorite(item.id)"
                                            name="star"
                                            class="size-3.5 fill-amber-500 text-amber-500 opacity-100"
                                        />
                                        <AppIcon
                                            v-else
                                            name="star"
                                            class="size-3.5 text-muted-foreground/50"
                                        />
                                    </button>
                                </SidebarMenuSubItem>
                            </SidebarMenuSub>
                        </CollapsibleContent>
                    </SidebarMenuItem>
                </Collapsible>
            </template>
        </SidebarMenu>
    </SidebarGroup>
</template>
