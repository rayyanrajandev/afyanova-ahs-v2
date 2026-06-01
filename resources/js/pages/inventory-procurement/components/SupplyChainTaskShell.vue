<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { INVENTORY_PROCUREMENT_HOME_PATH, inventoryWorkspaceHref } from '@/lib/inventoryProcurement';
import type { BreadcrumbItem } from '@/types';

const props = defineProps<{
    title: string;
    description: string;
    icon?: 'package' | 'clipboard-list' | 'activity' | 'check-circle';
    breadcrumbs: BreadcrumbItem[];
}>();

defineSlots<{
    actions?: () => unknown;
    default?: () => unknown;
}>();
</script>

<template>
    <section class="rounded-lg border border-border bg-card shadow-sm">
        <div class="flex flex-col gap-4 border-b px-4 py-4 md:flex-row md:items-center md:justify-between">
            <div class="flex min-w-0 items-start gap-3">
                <div
                    class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"
                    aria-hidden="true"
                >
                    <AppIcon :name="props.icon ?? 'package'" class="size-5" />
                </div>
                <div class="min-w-0">
                    <Button variant="ghost" size="sm" class="mb-1 h-7 gap-1 px-1 text-xs text-muted-foreground" as-child>
                        <Link :href="INVENTORY_PROCUREMENT_HOME_PATH">
                            <AppIcon name="chevron-left" class="size-3.5" />
                            Supply chain home
                        </Link>
                    </Button>
                    <h1 class="text-base font-semibold tracking-tight md:text-lg">{{ props.title }}</h1>
                    <p class="mt-0.5 text-xs text-muted-foreground">{{ props.description }}</p>
                </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <slot name="actions" />
                <Button variant="outline" size="sm" class="h-8 gap-1.5" as-child>
                    <Link :href="inventoryWorkspaceHref()">Full workspace</Link>
                </Button>
            </div>
        </div>
        <div class="p-4 md:p-5">
            <slot />
        </div>
    </section>
</template>
