<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export type KpiCard = {
    label: string;
    value: number | string | null;
    variant?: 'default' | 'warning' | 'danger' | 'success';
    icon?: string;
};

defineProps<{
    cards: KpiCard[];
    loading?: boolean;
}>();
</script>

<template>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Card v-for="card in cards" :key="card.label">
            <CardHeader class="pb-2">
                <CardTitle class="text-sm font-medium text-muted-foreground">
                    {{ card.label }}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Skeleton v-if="loading" class="h-8 w-20" />
                <div v-else class="flex items-center gap-2">
                    <span
                        class="text-2xl font-bold"
                        :class="{
                            'text-destructive': card.variant === 'danger',
                            'text-warning': card.variant === 'warning',
                            'text-green-600': card.variant === 'success',
                        }"
                    >
                        {{ card.value ?? '—' }}
                    </span>
                </div>
            </CardContent>
        </Card>
    </div>
</template>
