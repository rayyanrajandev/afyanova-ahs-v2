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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    encounterLifecycleActionLabel,
    type EncounterLifecycleAction,
} from '@/lib/encounterWorkspaceLifecycle';

const open = defineModel<boolean>('open', { required: true });
const reason = defineModel<string>('reason', { required: true });

defineProps<{
    action: EncounterLifecycleAction | null;
    targetName: string;
    error: string | null;
    submitting: boolean;
}>();

const emit = defineEmits<{
    submit: [];
    close: [];
}>();

function handleOpenChange(nextOpen: boolean): void {
    if (nextOpen) {
        open.value = true;
        return;
    }

    emit('close');
}
</script>

<template>
    <Dialog :open="open" @update:open="handleOpenChange">
        <DialogContent variant="action">
            <DialogHeader>
                <DialogTitle>{{ encounterLifecycleActionLabel(action) }}</DialogTitle>
                <DialogDescription>
                    Apply this lifecycle action to
                    <span class="font-medium text-foreground">{{ targetName }}</span>.
                </DialogDescription>
            </DialogHeader>
            <div class="grid gap-2">
                <Label for="encounter-lifecycle-reason">
                    Clinical reason
                </Label>
                <Input
                    id="encounter-lifecycle-reason"
                    v-model="reason"
                    placeholder="Document the clinical reason for this lifecycle action."
                />
                <p v-if="error" class="text-sm text-destructive">
                    {{ error }}
                </p>
            </div>
            <DialogFooter class="gap-2">
                <Button variant="outline" @click="emit('close')">
                    Keep current order
                </Button>
                <Button :disabled="submitting" @click="emit('submit')">
                    {{
                        submitting
                            ? 'Applying...'
                            : encounterLifecycleActionLabel(action)
                    }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
