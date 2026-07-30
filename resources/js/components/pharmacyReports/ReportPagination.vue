<script setup lang="ts">
import { Button } from '@/components/ui/button';

defineProps<{
    currentPage: number;
    lastPage: number;
    total: number;
    loading?: boolean;
}>();

const emit = defineEmits<{
    changePage: [page: number];
}>();
</script>

<template>
    <div class="flex items-center justify-between pt-4">
        <p class="text-sm text-muted-foreground">
            {{ total }} result{{ total === 1 ? '' : 's' }}
            <span v-if="lastPage > 1"> · Page {{ currentPage }} of {{ lastPage }}</span>
        </p>
        <div v-if="lastPage > 1" class="flex items-center gap-1">
            <Button
                variant="outline"
                size="sm"
                :disabled="currentPage <= 1 || loading"
                @click="emit('changePage', currentPage - 1)"
            >
                Previous
            </Button>
            <Button
                variant="outline"
                size="sm"
                :disabled="currentPage >= lastPage || loading"
                @click="emit('changePage', currentPage + 1)"
            >
                Next
            </Button>
        </div>
    </div>
</template>
