<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import { encounterReturnLabel } from '@/lib/encounterWorkspace';

defineProps<{
    returnTo: string;
}>();
</script>

<template>
    <div
        class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2"
    >
        <div class="flex min-w-0 items-center gap-2 text-sm text-foreground">
            <AppIcon name="stethoscope" class="size-4 shrink-0 text-primary" />
            <span>
                You opened this workflow from an active encounter. Finish the order, then return to continue charting.
            </span>
        </div>
        <Button variant="outline" size="sm" class="h-8 shrink-0 gap-1.5" as-child>
            <Link :href="returnTo">
                <AppIcon name="arrow-left" class="size-3.5" />
                {{ encounterReturnLabel(returnTo) }}
            </Link>
        </Button>
    </div>
</template>
