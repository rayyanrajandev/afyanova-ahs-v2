<script setup lang="ts">
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const props = withDefaults(
    defineProps<{
        open: boolean;
        title: string;
        description?: string;
        details?: string[];
        cancelLabel?: string;
        confirmLabel?: string;
        confirmVariant?:
            | 'default'
            | 'destructive'
            | 'outline'
            | 'secondary'
            | 'ghost'
            | 'link';
        contentClass?: string;
    }>(),
    {
        description: '',
        details: () => [],
        cancelLabel: 'Cancel',
        confirmLabel: 'Confirm',
        confirmVariant: 'default',
        contentClass: 'sm:max-w-lg',
    },
);

const emit = defineEmits<{
    (event: 'update:open', value: boolean): void;
    (event: 'confirm'): void;
}>();

function cancelDialog(): void {
    emit('update:open', false);
}

function confirmDialog(): void {
    emit('confirm');
}

function normalizeDialogLine(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

const detailLines = computed(() => {
    const descriptionKey = normalizeDialogLine(props.description);
    const seen = new Set<string>();

    return props.details
        .map((detail) => detail.trim())
        .filter((detail) => detail.length > 0)
        .filter((detail) => {
            const detailKey = normalizeDialogLine(detail);

            if (!detailKey || detailKey === descriptionKey || seen.has(detailKey)) {
                return false;
            }

            seen.add(detailKey);
            return true;
        });
});
</script>

<template>
    <Dialog :open="open" @update:open="(value) => emit('update:open', value)">
        <DialogContent :class="contentClass">
            <DialogHeader>
                <DialogTitle>{{ title }}</DialogTitle>
                <DialogDescription v-if="description">
                    {{ description }}
                </DialogDescription>
            </DialogHeader>

            <div v-if="detailLines.length" class="space-y-2">
                <p
                    v-for="(detail, index) in detailLines"
                    :key="`confirmation-detail-${index}`"
                    class="text-sm leading-6 text-foreground"
                >
                    {{ detail }}
                </p>
            </div>

            <DialogFooter class="gap-2">
                <Button
                    type="button"
                    variant="outline"
                    @click.prevent.stop="cancelDialog"
                >
                    {{ cancelLabel }}
                </Button>
                <Button
                    type="button"
                    :variant="confirmVariant"
                    @click.prevent.stop="confirmDialog"
                >
                    {{ confirmLabel }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
