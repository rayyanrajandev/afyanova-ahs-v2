<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

type Props = {
    title: string;
    description: string;
    scopeLabel?: string;
    refreshing?: boolean;
    refreshDisabled?: boolean;
    showRefresh?: boolean;
    contentClass?: string;
};

withDefaults(defineProps<Props>(), {
    scopeLabel: '',
    refreshing: false,
    refreshDisabled: false,
    showRefresh: true,
    contentClass: 'grid gap-3 md:grid-cols-3',
});

const emit = defineEmits<{
    (event: 'refresh'): void;
}>();
</script>

<template>
    <Card class="border-sidebar-border/70">
        <CardHeader class="gap-3 md:flex-row md:items-start md:justify-between">
            <div>
                <CardTitle class="text-xl">{{ title }}</CardTitle>
                <CardDescription>{{ description }}</CardDescription>

                <div v-if="$slots.meta" class="mt-2">
                    <slot name="meta" />
                </div>
                <div v-if="$slots.presets" class="mt-3 flex flex-wrap items-center gap-2">
                    <slot name="presets" />
                </div>
                <div v-if="$slots.workflow" class="mt-2 flex flex-wrap items-center gap-2">
                    <slot name="workflow" />
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <slot name="actions" />

                <Badge v-if="scopeLabel" variant="outline">
                    {{ scopeLabel }}
                </Badge>

                <Button
                    v-if="showRefresh"
                    variant="outline"
                    size="sm"
                    :disabled="refreshDisabled"
                    @click="emit('refresh')"
                >
                    {{ refreshing ? 'Refreshing...' : 'Refresh' }}
                </Button>
            </div>
        </CardHeader>

        <CardContent v-if="$slots.default" :class="contentClass">
            <slot />
        </CardContent>
    </Card>
</template>
