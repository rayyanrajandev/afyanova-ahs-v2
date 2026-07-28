<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
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
    {
        value: 'left_against_medical_advice',
        label: 'Left against medical advice',
    },
    { value: 'other', label: 'Other' },
];

const reasonRef = ref<HTMLTextAreaElement | null>(null);

const blockingItems = computed(() =>
    encounterCloseReadinessBlockingItems(props.readiness),
);
const warningItems = computed(() =>
    encounterCloseReadinessWarningItems(props.readiness),
);
const passedItems = computed(() =>
    (props.readiness?.items ?? []).filter(
        (item) => item.status === 'pass',
    ),
);
const otherBlockingItems = computed(() =>
    blockingItems.value.filter(
        (item) => item.id !== 'disposition_documented',
    ),
);
const requiresAcknowledgement = computed(
    () =>
        otherBlockingItems.value.length === 0 &&
        warningItems.value.length > 0,
);
const MIN_CLOSE_REASON_LENGTH = 10;

const canConfirm = computed(() => {
    if (otherBlockingItems.value.length > 0) return false;
    if (props.disposition.trim() === '') return false;
    if (!requiresAcknowledgement.value) return true;
    return props.reason.trim().length >= MIN_CLOSE_REASON_LENGTH;
});

const totalItems = computed(() => props.readiness?.items.length ?? 0);
const passedCount = computed(
    () =>
        props.readiness?.items.filter((item) => item.status === 'pass')
            .length ?? 0,
);

const passedCollapsed = ref(true);

function closeDialog(): void {
    emit('update:open', false);
}

function onKeydown(e: KeyboardEvent): void {
    if (
        (e.ctrlKey || e.metaKey) &&
        e.key === 'Enter' &&
        canConfirm.value &&
        !props.submitting
    ) {
        e.preventDefault();
        emit('confirm');
    }
}

watch(
    () => warningItems.value.length > 0 && otherBlockingItems.value.length === 0,
    (show) => {
        if (show) {
            nextTick(() => reasonRef.value?.focus());
        }
    },
);
</script>

<template>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
        <DialogContent size="3xl" @keydown="onKeydown">
            <DialogHeader>
                <DialogTitle>Encounter close checklist</DialogTitle>
                <DialogDescription>
                    Review documentation, orders, and billing readiness before
                    closing this visit.
                </DialogDescription>
            </DialogHeader>

            <div class="space-y-3">
                <template v-if="readiness">
                    <div
                        class="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"
                    >
                        <span class="text-muted-foreground">Progress:</span>
                        <span class="font-medium">{{ passedCount }}/{{ totalItems }}</span>
                        <div class="ml-1 h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                                class="h-full rounded-full transition-all duration-500"
                                :class="
                                    otherBlockingItems.length > 0
                                        ? 'bg-destructive'
                                        : warningItems.length > 0
                                          ? 'bg-warning'
                                          : 'bg-success'
                                "
                                :style="{
                                    width:
                                        totalItems > 0
                                            ? `${(passedCount / totalItems) * 100}%`
                                            : '0%',
                                }"
                            />
                        </div>
                    </div>

                    <Alert
                        v-if="otherBlockingItems.length > 0"
                        variant="destructive"
                    >
                        <AlertTitle>Close blocked</AlertTitle>
                        <AlertDescription>
                            Resolve the required items below before this
                            encounter can be closed.
                        </AlertDescription>
                    </Alert>

                    <div v-if="otherBlockingItems.length > 0" class="space-y-1.5">
                        <p class="text-xs font-semibold text-destructive">
                            Required
                        </p>
                        <div class="space-y-1.5">
                            <div
                                v-for="item in otherBlockingItems"
                                :key="item.id"
                                class="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                            >
                                <AppIcon
                                    name="circle-x"
                                    class="mt-0.5 size-4 shrink-0 text-destructive"
                                />
                                <div class="min-w-0 space-y-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <p class="text-sm font-medium">
                                            {{ item.label }}
                                        </p>
                                        <Badge variant="destructive" class="text-[11px]">
                                            Required
                                        </Badge>
                                        <Badge
                                            v-if="
                                                item.count !== null &&
                                                item.count > 0
                                            "
                                            variant="outline"
                                            class="text-[11px]"
                                        >
                                            {{ item.count }}
                                        </Badge>
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        {{ item.message }}
                                    </p>
                                    <ul
                                        v-if="
                                            item.details &&
                                            item.details.length > 0
                                        "
                                        class="space-y-0.5 border-l-2 border-destructive/30 pl-2"
                                    >
                                        <li
                                            v-for="detail in item.details"
                                            :key="detail.id"
                                            class="flex items-baseline justify-between gap-2 text-xs text-muted-foreground"
                                        >
                                            <span class="truncate">{{
                                                detail.label
                                            }}</span>
                                            <span
                                                v-if="detail.meta"
                                                class="shrink-0 tabular-nums"
                                                >{{ detail.meta }}</span
                                            >
                                        </li>
                                        <li
                                            v-if="
                                                item.count !== null &&
                                                item.count > item.details.length
                                            "
                                            class="text-xs italic text-muted-foreground"
                                        >
                                            +{{ item.count - item.details.length }}
                                            more
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        v-if="otherBlockingItems.length === 0"
                        class="space-y-2"
                    >
                        <Label for="encounter-close-disposition">
                            Disposition
                            <span class="text-destructive">*</span>
                        </Label>
                        <Select
                            :model-value="disposition"
                            @update:model-value="
                                emit('update:disposition', $event)
                            "
                        >
                            <SelectTrigger
                                id="encounter-close-disposition"
                                class="w-full"
                            >
                                <SelectValue
                                    placeholder="Select how this encounter concluded"
                                />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    v-for="option in dispositionOptions"
                                    :key="option.value"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        <Textarea
                            :model-value="dispositionNotes"
                            rows="2"
                            placeholder="Optional disposition notes"
                            @update:model-value="
                                emit('update:dispositionNotes', String($event ?? ''))
                            "
                        />
                    </div>

                    <div
                        v-if="warningItems.length > 0 && otherBlockingItems.length === 0"
                        class="space-y-1.5"
                    >
                        <p class="text-xs font-semibold text-warning">
                            Acknowledge warnings
                        </p>
                        <div class="space-y-1.5">
                            <div
                                v-for="item in warningItems"
                                :key="item.id"
                                class="flex items-start gap-3 rounded-lg border border-warning/25 bg-warning/5 p-3"
                            >
                                <AppIcon
                                    name="triangle-alert"
                                    class="mt-0.5 size-4 shrink-0 text-warning"
                                />
                                <div class="min-w-0 space-y-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <p class="text-sm font-medium">
                                            {{ item.label }}
                                        </p>
                                        <Badge variant="outline" class="text-[11px] text-warning">
                                            Warning
                                        </Badge>
                                        <Badge
                                            v-if="
                                                item.count !== null &&
                                                item.count > 0
                                            "
                                            variant="outline"
                                            class="text-[11px]"
                                        >
                                            {{ item.count }}
                                        </Badge>
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        {{ item.message }}
                                    </p>
                                    <ul
                                        v-if="
                                            item.details &&
                                            item.details.length > 0
                                        "
                                        class="space-y-0.5 border-l-2 border-warning/25 pl-2"
                                    >
                                        <li
                                            v-for="detail in item.details"
                                            :key="detail.id"
                                            class="flex items-baseline justify-between gap-2 text-xs text-muted-foreground"
                                        >
                                            <span class="truncate">{{
                                                detail.label
                                            }}</span>
                                            <span
                                                v-if="detail.meta"
                                                class="shrink-0 tabular-nums"
                                                >{{ detail.meta }}</span
                                            >
                                        </li>
                                        <li
                                            v-if="
                                                item.count !== null &&
                                                item.count > item.details.length
                                            "
                                            class="text-xs italic text-muted-foreground"
                                        >
                                            +{{ item.count - item.details.length }}
                                            more
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div class="space-y-2 pt-1">
                            <Label for="encounter-close-reason">
                                Close-out reason
                                <span class="text-destructive">*</span>
                            </Label>
                            <Textarea
                                id="encounter-close-reason"
                                ref="reasonRef"
                                :model-value="reason"
                                rows="3"
                                placeholder="Document why you are closing with outstanding warnings."
                                @update:model-value="
                                    emit('update:reason', String($event ?? ''))
                                "
                            />
                            <div class="flex items-center justify-between">
                                <p class="text-xs text-muted-foreground">
                                    Be specific — generic text like "n/a" will
                                    be rejected.
                                </p>
                                <span
                                    class="text-xs tabular-nums"
                                    :class="
                                        reason.trim().length >=
                                        MIN_CLOSE_REASON_LENGTH
                                            ? 'text-success'
                                            : reason.trim().length > 0
                                              ? 'text-warning'
                                              : 'text-muted-foreground'
                                    "
                                >
                                    {{ reason.trim().length }}/{{
                                        MIN_CLOSE_REASON_LENGTH
                                    }}
                                    min
                                </span>
                            </div>
                        </div>
                    </div>

                    <div v-if="passedItems.length > 0" class="space-y-1.5">
                        <button
                            type="button"
                            class="flex w-full items-center gap-2 text-left text-xs font-semibold text-muted-foreground hover:text-foreground"
                            @click="passedCollapsed = !passedCollapsed"
                        >
                            <AppIcon
                                :name="
                                    passedCollapsed
                                        ? 'chevron-right'
                                        : 'chevron-down'
                                "
                                class="size-3"
                            />
                            Ready ({{ passedCount }})
                        </button>
                        <div v-if="!passedCollapsed" class="space-y-1.5">
                            <div
                                v-for="item in passedItems"
                                :key="item.id"
                                class="flex items-start gap-3 rounded-lg border p-3 opacity-70"
                            >
                                <AppIcon
                                    name="circle-check"
                                    class="mt-0.5 size-4 shrink-0 text-success"
                                />
                                <div class="min-w-0 space-y-1">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <p class="text-sm font-medium">
                                            {{ item.label }}
                                        </p>
                                        <Badge
                                            variant="secondary"
                                            class="text-[11px]"
                                        >
                                            Ready
                                        </Badge>
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        {{ item.message }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p
                        v-if="error"
                        class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                    >
                        {{ error }}
                    </p>
                </template>
                <p v-else class="text-sm text-muted-foreground">
                    Loading readiness information...
                </p>
            </div>

            <DialogFooter>
                <Button
                    variant="outline"
                    :disabled="submitting"
                    @click="closeDialog"
                >
                    Cancel
                </Button>
                <Button
                    :disabled="!canConfirm || submitting"
                    @click="emit('confirm')"
                >
                    <Spinner
                        v-if="submitting"
                        class="mr-1.5 size-4"
                    />
                    <template v-if="requiresAcknowledgement">
                        Acknowledge and close
                    </template>
                    <template v-else>Close encounter</template>
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
</template>
