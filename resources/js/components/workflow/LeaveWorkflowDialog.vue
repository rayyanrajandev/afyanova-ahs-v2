<script setup lang="ts">
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

withDefaults(
    defineProps<{
        open: boolean;
        title: string;
        description: string;
        stayLabel?: string;
        leaveLabel?: string;
    }>(),
    {
        stayLabel: 'Stay on page',
        leaveLabel: 'Leave page',
    },
);

const emit = defineEmits<{
    (event: 'update:open', value: boolean): void;
    (event: 'confirm'): void;
}>();
</script>

<template>
    <Dialog :open="open" @update:open="(value) => emit('update:open', value)">
        <DialogContent variant="action" size="md">
            <DialogHeader>
                <DialogTitle>{{ title }}</DialogTitle>
                <DialogDescription>{{ description }}</DialogDescription>
            </DialogHeader>
            <DialogFooter class="gap-2">
                <Button variant="outline" @click="emit('update:open', false)">
                    {{ stayLabel }}
                </Button>
                <Button class="gap-1.5" @click="emit('confirm')">
                    {{ leaveLabel }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
