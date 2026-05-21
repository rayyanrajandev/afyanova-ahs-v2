<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    encounterCloseReadinessBlockingItems,
    encounterCloseReadinessWarningItems,
    type EncounterCloseReadiness,
} from '@/lib/encounterCloseReadiness';

const props = defineProps<{
    open: boolean;
    readiness: EncounterCloseReadiness | null;
    reason: string;
    submitting?: boolean;
    error?: string | null;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    'update:reason': [value: string];
    confirm: [];
}>();

const blockingItems = computed(() =>
    encounterCloseReadinessBlockingItems(props.readiness),
);
const warningItems = computed(() =>
    encounterCloseReadinessWarningItems(props.readiness),
);
const canConfirm = computed(() => {
    if (!props.readiness?.canClose) {
        return false;
    }

    if (!props.readiness.requiresAcknowledgement) {
        return true;
    }

    return props.reason.trim().length >= 3;
});

function closeDialog(): void {
    emit('update:open', false);
}
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent class="max-w-xl">
            <DialogHeader>
                <DialogTitle>Encounter close checklist</DialogTitle>
                <DialogDescription>
                    Review documentation, orders, and billing readiness before closing this visit.
                </DialogDescription>
            </DialogHeader>

            <div class="space-y-4">
                <Alert v-if="blockingItems.length > 0" variant="destructive">
                    <AlertTitle>Close blocked</AlertTitle>
                    <AlertDescription>
                        Resolve the required items below before this encounter can be closed.
                    </AlertDescription>
                </Alert>

                <div class="space-y-2">
                    <div
                        v-for="item in readiness?.items ?? []"
                        :key="item.id"
                        class="flex items-start gap-3 rounded-lg border p-3"
                    >
                        <AppIcon
                            :name="item.status === 'pass' ? 'circle-check' : item.severity === 'block' ? 'circle-x' : 'triangle-alert'"
                            class="mt-0.5 size-4 shrink-0"
                            :class="item.status === 'pass'
                                ? 'text-emerald-600'
                                : item.severity === 'block'
                                    ? 'text-destructive'
                                    : 'text-amber-600'"
                        />
                        <div class="min-w-0 space-y-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <p class="text-sm font-medium">{{ item.label }}</p>
                                <Badge
                                    :variant="item.status === 'pass'
                                        ? 'secondary'
                                        : item.severity === 'block'
                                            ? 'destructive'
                                            : 'outline'"
                                    class="text-[11px]"
                                >
                                    {{ item.status === 'pass' ? 'Ready' : item.severity === 'block' ? 'Required' : 'Warning' }}
                                </Badge>
                                <Badge
                                    v-if="item.count !== null && item.count > 0"
                                    variant="outline"
                                    class="text-[11px]"
                                >
                                    {{ item.count }}
                                </Badge>
                            </div>
                            <p class="text-xs text-muted-foreground">{{ item.message }}</p>
                        </div>
                    </div>
                </div>

                <div
                    v-if="warningItems.length > 0 && readiness?.canClose"
                    class="space-y-2"
                >
                    <Label for="encounter-close-reason">Close-out reason</Label>
                    <Textarea
                        id="encounter-close-reason"
                        :model-value="reason"
                        rows="3"
                        placeholder="Document why you are closing with outstanding warnings."
                        @update:model-value="emit('update:reason', String($event ?? ''))"
                    />
                    <p class="text-xs text-muted-foreground">
                        Required when acknowledging billing, diagnosis, or pending-order warnings.
                    </p>
                </div>

                <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
            </div>

            <DialogFooter>
                <Button variant="outline" :disabled="submitting" @click="closeDialog">
                    Cancel
                </Button>
                <Button
                    :disabled="!canConfirm || submitting"
                    @click="emit('confirm')"
                >
                    {{ readiness?.requiresAcknowledgement ? 'Acknowledge and close' : 'Close encounter' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
