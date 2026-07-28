<script setup lang="ts">
import { Badge } from '@/components/ui/badge';
import type { ServiceRequestItem, ServiceRequestItemStatus } from '@/types/serviceRequestItem';

defineProps<{
    items: ServiceRequestItem[];
}>();

function itemStatusVariant(status: ServiceRequestItemStatus): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'pending':
            return 'outline';
        case 'processing':
            return 'default';
        case 'ordered':
            return 'secondary';
        case 'completed':
            return 'secondary';
        case 'failed':
            return 'destructive';
        case 'cancelled':
            return 'outline';
        default:
            return 'outline';
    }
}

function itemStatusIcon(status: ServiceRequestItemStatus): string {
    switch (status) {
        case 'completed':
            return '\u2713';
        case 'failed':
            return '\u2717';
        case 'processing':
            return '\u25CB';
        default:
            return '\u2501';
    }
}
</script>

<template>
    <ul v-if="items.length > 0" class="space-y-0.5">
        <li v-for="item in items" :key="item.id" class="flex items-center gap-1.5 text-xs">
            <span class="w-3 text-center text-muted-foreground">{{ itemStatusIcon(item.status) }}</span>
            <span class="truncate">{{ item.itemName }}</span>
            <span v-if="item.itemCode" class="font-mono text-[10px] text-muted-foreground">({{ item.itemCode }})</span>
            <Badge
                :variant="itemStatusVariant(item.status)"
                class="h-4 px-1 text-[9px]"
                :title="item.status === 'failed' && item.failureReason ? item.failureReason : undefined"
            >
                {{ item.status }}
            </Badge>
            <span v-if="item.quantity > 1" class="text-[10px] text-muted-foreground">x{{ item.quantity }}</span>
        </li>
    </ul>
</template>
