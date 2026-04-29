<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import type { PropType } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';

defineProps({
    links: {
        type: Array as PropType<
            Array<{
                key: string;
                href: string;
                icon: string;
                label: string;
            }>
        >,
        required: true,
    },
});
</script>

<template>
    <div
        v-if="links.length > 0"
        class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-2.5"
    >
        <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <AppIcon name="activity" class="size-3.5" />
            Related workflows
        </span>
        <Button
            v-for="link in links"
            :key="`bil-create-workflow-${link.key}`"
            size="sm"
            variant="outline"
            as-child
            class="gap-1.5"
        >
            <Link :href="link.href">
                <AppIcon :name="link.icon" class="size-3.5" />
                {{ link.label }}
            </Link>
        </Button>
    </div>
</template>
