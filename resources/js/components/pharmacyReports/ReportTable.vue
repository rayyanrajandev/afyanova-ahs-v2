<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton';

export type ColumnDef<T> = {
    key: string;
    label: string;
    format?: (value: unknown, row: T) => string | number;
    align?: 'left' | 'center' | 'right';
};

defineProps<{
    columns: ColumnDef<unknown>[];
    data: unknown[] | null;
    loading?: boolean;
    emptyMessage?: string;
}>();
</script>

<template>
    <div class="overflow-x-auto rounded-md border">
        <table class="w-full text-sm">
            <thead>
                <tr class="border-b bg-muted/50">
                    <th
                        v-for="col in columns"
                        :key="col.key"
                        class="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                        :class="col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'"
                    >
                        {{ col.label }}
                    </th>
                </tr>
            </thead>
            <tbody>
                <template v-if="loading">
                    <tr v-for="i in 8" :key="i">
                        <td v-for="col in columns" :key="col.key" class="px-4 py-3">
                            <Skeleton class="h-4 w-full" />
                        </td>
                    </tr>
                </template>
                <template v-else-if="data && data.length > 0">
                    <tr v-for="(row, idx) in data" :key="idx" class="border-b last:border-0 hover:bg-muted/30">
                        <td
                            v-for="col in columns"
                            :key="col.key"
                            class="px-4 py-3"
                            :class="col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''"
                        >
                            {{ col.format ? col.format((row as Record<string, unknown>)[col.key], row) : (row as Record<string, unknown>)[col.key] ?? '—' }}
                        </td>
                    </tr>
                </template>
                <tr v-else>
                    <td :colspan="columns.length" class="px-4 py-8 text-center text-muted-foreground">
                        {{ emptyMessage ?? 'No data found for the selected filters.' }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>
