<script setup lang="ts">
import { ref } from 'vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import SodWarningBanner from '@/components/inventory/SodWarningBanner.vue';
import TimeoutCountdown from '@/components/inventory/TimeoutCountdown.vue';
import WorkflowProgress from '@/components/inventory/WorkflowProgress.vue';
import { approveRequisition, rejectRequisition, type ApprovalInstance } from '@/lib/approvalApiClient';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';

const props = defineProps<{
    approval: ApprovalInstance | null;
    open: boolean;
}>();

const emit = defineEmits<{
    close: [];
    decisionMade: [];
}>();

const comments = ref('');
const submitting = ref(false);
const action = ref<'approve' | 'reject' | null>(null);

function handleClose(): void {
    comments.value = '';
    action.value = null;
    emit('close');
}

async function handleSubmit(): Promise<void> {
    if (!props.approval) return;

    submitting.value = true;
    action.value = null;

    try {
        if (action.value === 'reject') {
            if (!comments.value.trim()) {
                notifyError('Please provide a reason for rejection.');
                submitting.value = false;
                return;
            }
            await rejectRequisition(props.approval.id, comments.value);
            notifySuccess('Requisition rejected.');
        } else {
            await approveRequisition(props.approval.id, comments.value || undefined);
            notifySuccess('Requisition approved.');
        }
        handleClose();
        emit('decisionMade');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to process decision.'));
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="handleClose">
        <SheetContent side="right" variant="workspace" size="lg">
            <SheetHeader>
                <SheetTitle v-if="approval">
                    {{ approval.requisition_number }}
                </SheetTitle>
                <SheetDescription v-if="approval">
                    {{ approval.requesting_department }}
                </SheetDescription>
            </SheetHeader>

            <ScrollArea class="flex-1 px-6 py-4">
                <template v-if="approval">
                    <SodWarningBanner :violation-reason="null" />

                    <div class="space-y-4">
                        <WorkflowProgress :current-step="approval.current_step" :total-steps="approval.total_steps" :status="approval.workflow_status" />

                        <Separator />

                        <div class="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span class="text-muted-foreground">Requisition</span>
                                <p class="font-medium">{{ approval.requisition_number }}</p>
                            </div>
                            <div>
                                <span class="text-muted-foreground">Department</span>
                                <p class="font-medium">{{ approval.requesting_department }}</p>
                            </div>
                            <div>
                                <span class="text-muted-foreground">Step</span>
                                <p class="font-medium">{{ approval.current_step }} of {{ approval.total_steps }}</p>
                            </div>
                            <div>
                                <span class="text-muted-foreground">Timeout</span>
                                <p class="font-medium">
                                    <TimeoutCountdown :timeout-at="null" />
                                </p>
                            </div>
                        </div>

                        <Separator />

                        <div v-if="approval.workflow_status === 'in_progress'" class="space-y-3">
                            <div class="space-y-1.5">
                                <Label for="decision-comments">Comments (optional)</Label>
                                <Textarea
                                    id="decision-comments"
                                    v-model="comments"
                                    placeholder="Add notes about your decision..."
                                    :disabled="submitting"
                                    rows="3"
                                />
                            </div>

                            <div class="flex gap-2">
                                <Button
                                    variant="default"
                                    class="flex-1 gap-1.5"
                                    :disabled="submitting"
                                    @click="action = 'approve'; handleSubmit()"
                                >
                                    <svg v-if="submitting && action === 'approve'" class="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                    <svg v-else class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                                    Approve
                                </Button>
                                <Button
                                    variant="destructive"
                                    class="flex-1 gap-1.5"
                                    :disabled="submitting || !comments.trim()"
                                    @click="action = 'reject'; handleSubmit()"
                                >
                                    <svg v-if="submitting && action === 'reject'" class="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                    <svg v-else class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    Reject
                                </Button>
                            </div>
                            <p v-if="action === 'reject' && !comments.trim()" class="text-[11px] text-muted-foreground">Please enter a reason before rejecting.</p>
                        </div>

                        <div v-else class="rounded-lg border bg-muted/30 p-3 text-center text-xs text-muted-foreground">
                            This workflow is {{ approval.workflow_status }}. No further action is needed.
                        </div>
                    </div>
                </template>
            </ScrollArea>
        </SheetContent>
    </Sheet>
</template>
