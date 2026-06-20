<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { ref } from 'vue';
import { ChevronRight } from 'lucide-vue-next';
import AppIcon from '@/components/AppIcon.vue';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/composables/useCurrentUrl';
import { type NavItem } from '@/types';

const props = defineProps<{
    /** The parent nav item that acts as the sub-group trigger */
    parent: NavItem;
    /** Child items in the sub-group */
    children: NavItem[];
}>();

const { isCurrentUrl } = useCurrentUrl();
const isOpen = ref(props.children.some((child) => isCurrentUrl(child.href)));
</script>

<template>
    <Collapsible v-model:open="isOpen" as-child>
        <SidebarMenuItem>
            <CollapsibleTrigger as-child>
                <SidebarMenuButton
                    :tooltip="parent.title"
                    class="group/collapsible"
                >
                    <AppIcon
                        v-if="parent.iconName || parent.icon"
                        :name="parent.iconName"
                        :fallback="parent.icon"
                        class="size-4 shrink-0"
                    />
                    <span class="truncate">{{ parent.title }}</span>
                    <ChevronRight
                        class="ml-auto size-3 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                    />
                </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <SidebarMenuSub>
                    <SidebarMenuSubItem
                        v-for="child in children"
                        :key="child.id ?? (typeof child.href === 'string' ? child.href : String(child.href))"
                    >
                        <SidebarMenuSubButton
                            as-child
                            :is-active="isCurrentUrl(child.href)"
                        >
                            <Link :href="child.href">
                                <AppIcon
                                    v-if="child.iconName || child.icon"
                                    :name="child.iconName"
                                    :fallback="child.icon"
                                    class="size-3.5 shrink-0"
                                />
                                <span>{{ child.title }}</span>
                            </Link>
                        </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                </SidebarMenuSub>
            </CollapsibleContent>
        </SidebarMenuItem>
    </Collapsible>
</template>