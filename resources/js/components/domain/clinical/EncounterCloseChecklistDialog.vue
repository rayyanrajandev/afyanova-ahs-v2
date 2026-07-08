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
    disposition: string;
    dispositionNotes: string;
    submitting?: boolean;
    error?: string | null;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    'update:reason': [value: string];
    'update:disposition': [value: string];
    'update:dispositionNotes': [value: string];
    confirm: [];
}>();

const dispositionOptions = [
    { value: 'discharged', label: 'Discharged' },
    { value: 'admitted', label: 'Admitted' },
    { value: 'transferred', label: 'Transferred' },
    { value: 'referred', label: 'Referred' },
    { value: 'deceased', label: 'Deceased' },
    { value: 'left_against_medical_advice', label: 'Left against medical advice' },
    { value: 'other', label: 'Other' },
];

const blockingItems = computed(() =>
    encounterCloseReadinessBlockingItems(props.readiness),
);
const warningItems = computed(() =>
    encounterCloseReadinessWarningItems(props.readiness),
);
/**
 * disposition_documented is a required-block item, but it can only ever be
 * satisfied by what the user is about to submit in this same dialog — so it's
 * excluded from the "still blocked" checks below and handled by its own
 * dedicated field instead.
 */
const otherBlockingItems = computed(() =>
    blockingItems.value.filter((item) => item.id !== 'disposition_documented'),
);
const requiresAcknowledgement = computed(
    () => otherBlockingItems.value.length === 0 && warningItems.value.length > 0,
);
// C-5 acknowledgement-quality fix (reports/clinical-note-audit/15-critical-system-integrity-review.md):
// mirrors EncounterLifecycleService::MIN_CLOSE_REASON_LENGTH. This is a
// client-side UX floor only — the backend is the authoritative check and
// also rejects a short list of placeholder phrases this dialog doesn't
// attempt to replicate.
const MIN_CLOSE_REASON_LENGTH = 10;

const canConfirm = computed(() => {
    if (otherBlockingItems.value.length > 0) {
        return false;
    }

    if (props.disposition.trim() === '') {
        return false;
    }

    if (!requiresAcknowledgement.value) {
        return true;
    }

    return props.reason.trim().length >= MIN_CLOSE_REASON_LENGTH;
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
                <Alert v-if="otherBlockingItems.length > 0" variant="destructive">
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
                            <ul
                                v-if="item.details && item.details.length > 0"
                                class="space-y-0.5 border-l-2 border-muted pl-2"
                            >
                                <li
                                    v-for="detail in item.details"
                                    :key="detail.id"
                                    class="flex items-baseline justify-between gap-2 text-xs text-muted-foreground"
                                >
                                    <span class="truncate">{{ detail.label }}</span>
                                    <span v-if="detail.meta" class="shrink-0 tabular-nums">{{ detail.meta }}</span>
                                </li>
                                <li
                                    v-if="item.count !== null && item.count > item.details.length"
                                    class="text-xs text-muted-foreground italic"
                                >
                                    +{{ item.count - item.details.length }} more
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div v-if="otherBlockingItems.length === 0" class="space-y-2">
                    <Label for="encounter-close-disposition">Disposition</Label>
                    <select
                        id="encounter-close-disposition"
                        :value="disposition"
                        class="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        @change="emit('update:disposition', ($event.target as HTMLSelectElement).value)"
                    >
                        <option value="" disabled>Select how this encounter concluded</option>
                        <option v-for="option in dispositionOptions" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </option>
                    </select>
                    <Textarea
                        :model-value="dispositionNotes"
                        rows="2"
                        placeholder="Optional disposition notes"
                        @update:model-value="emit('update:dispositionNotes', String($event ?? ''))"
                    />
                </div>

                <div
                    v-if="warningItems.length > 0 && otherBlockingItems.length === 0"
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
                        Be specific — generic text like "n/a" will be rejected.
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
                    {{ requiresAcknowledgement ? 'Acknowledge and close' : 'Close encounter' }}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
