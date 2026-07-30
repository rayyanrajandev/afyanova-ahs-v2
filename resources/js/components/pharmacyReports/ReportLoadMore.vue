<script setup lang="ts">
defineProps<{
    loaded: number;
    total: number;
    loading: boolean;
    hasMore: boolean;
}>();

const emit = defineEmits<{
    loadMore: [];
}>();
</script>

<template>
    <div class="flex items-center justify-between pt-4">
        <p class="text-sm text-muted-foreground">
            Showing {{ loaded }} of {{ total }} result{{ total === 1 ? '' : 's' }}
        </p>
        <div v-if="hasMore" class="flex items-center gap-2">
            <span v-if="loading" class="text-sm text-muted-foreground">Loading...</span>
            <button
                class="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                :disabled="loading"
                @click="emit('loadMore')"
            >
                {{ loading ? 'Loading...' : 'Load More' }}
            </button>
        </div>
    </div>
</template>
