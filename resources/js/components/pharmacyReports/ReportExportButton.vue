<script setup lang="ts">
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

defineProps<{
    loading?: boolean;
}>();

const emit = defineEmits<{
    exportCsv: [];
    exportPdf: [];
}>();
</script>

<template>
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" :disabled="loading">
                Export
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuItem @click="emit('exportCsv')">
                Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem @click="emit('exportPdf')">
                Export as PDF
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
</template>
