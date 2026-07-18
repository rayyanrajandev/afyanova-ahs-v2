<script setup lang="ts">
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

/**
 * Shared numbered-pagination footer for V2 list pages (Patients, Facility
 * Users, …) — one component so every list gets the same shadcn-vue/reka-ui
 * Pagination UI instead of each page hand-rolling its own Previous/Next
 * buttons.
 *
 * Deliberately `flex-nowrap` end to end (container, PaginationContent,
 * every item) so this never wraps to a second line, and `overflow-x-auto`
 * is the pressure-release valve for extreme page counts instead of
 * wrapping. Meant to be rendered as a bottom section *inside* the same
 * bordered card as the table it paginates (border-t px-3 py-3), not as a
 * separate floating element below it.
 */
const props = defineProps<{
    currentPage: number;
    lastPage: number;
    total: number;
    itemLabel?: string;
}>();

const emit = defineEmits<{
    'update:page': [page: number];
}>();
</script>

<template>
    <div class="flex flex-nowrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p class="shrink-0 truncate">Page {{ currentPage }} of {{ lastPage }} ({{ total }} {{ itemLabel ?? 'total' }})</p>
        <div class="overflow-x-auto">
            <Pagination :page="currentPage" :items-per-page="1" :total="lastPage" :sibling-count="1" show-edges @update:page="(page) => emit('update:page', page)">
                <PaginationContent v-slot="{ items }">
                    <PaginationPrevious />
                    <template v-for="(item, index) in items" :key="index">
                        <PaginationItem v-if="item.type === 'page'" :value="item.value">{{ item.value }}</PaginationItem>
                        <PaginationEllipsis v-else />
                    </template>
                    <PaginationNext />
                </PaginationContent>
            </Pagination>
        </div>
    </div>
</template>
