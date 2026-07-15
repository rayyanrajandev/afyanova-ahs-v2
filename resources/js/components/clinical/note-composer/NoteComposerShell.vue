<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { usePage } from '@inertiajs/vue3';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useMedicalRecordDraft } from '@/composables/clinical/useMedicalRecordDraft';
import { useMedicalRecordHandoff } from '@/composables/clinical/useMedicalRecordHandoff';
import { useMedicalRecordLifecycle } from '@/composables/clinical/useMedicalRecordLifecycle';
import { useNoteAutosave } from '@/composables/clinical/useNoteAutosave';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import {
    DEFAULT_MEDICAL_RECORD_NOTE_TYPE,
    medicalRecordNoteTypeNarrativeHeading,
} from '@/pages/medical-records/noteTypes';
import {
    EMPTY_DRAFT_CONTENT,
    type MedicalRecordDraftContent,
    type MedicalRecordResponse,
    type MedicalRecordVisitContext,
} from '@/types/medicalRecord';
import NoteHandoffSheet from './NoteHandoffSheet.vue';
import NoteLifecycleActions from './NoteLifecycleActions.vue';
import NoteSoapSection from './NoteSoapSection.vue';
import NoteTypeSelector from './NoteTypeSelector.vue';

type NoteComposerEncounterDiagnosis = {
    id: string;
    diagnosisCode: string | null;
    diagnosisDescription: string | null;
    diagnosisType: string;
};

const props = defineProps<{
    patientId: string;
    encounterId?: string | null;
    appointmentId?: string | null;
    admissionId?: string | null;
    encounterAt: string;
    existingRecord?: MedicalRecordResponse | null;
    canFinalize?: boolean;
    canAmend?: boolean;
    canArchive?: boolean;
    /** Encounter-level structured diagnoses (see the Encounter entity's diagnoses list) — optional so the old Workspace.vue, which has no such concept, is unaffected. */
    encounterDiagnoses?: NoteComposerEncounterDiagnosis[];
    canManageEncounterDiagnoses?: boolean;
}>();

const emit = defineEmits<{
    /** Fires after finalize/amend/archive succeeds, since the note's status
     * feeds server-computed state elsewhere (e.g. the workspace bundle's
     * close-readiness) that this component has no way to invalidate itself. */
    'status-changed': [record: MedicalRecordResponse];
    /** Only emitted when the caller opts in via canManageEncounterDiagnoses — opens the encounter's "add diagnosis" dialog from within the note, not just from the workspace header. */
    'open-add-encounter-diagnosis': [];
}>();

const recordType = ref<string>(
    props.existingRecord?.recordType ?? DEFAULT_MEDICAL_RECORD_NOTE_TYPE,
);
const content = reactive<MedicalRecordDraftContent>({ ...EMPTY_DRAFT_CONTENT });

const draft = useMedicalRecordDraft({
    visitContext: (): MedicalRecordVisitContext | null => {
        if (!props.patientId.trim()) return null;
        return {
            patientId: props.patientId,
            encounterId: props.encounterId ?? null,
            appointmentId: props.appointmentId ?? null,
            admissionId: props.admissionId ?? null,
            encounterAt: props.encounterAt,
            recordType: recordType.value,
        };
    },
});

const lifecycle = useMedicalRecordLifecycle();

const currentUser = computed(() => {
    const auth = usePage().props.auth as { user?: { id: number } } | undefined;
    return auth?.user ?? null;
});

const status = computed(() => draft.record.value?.status ?? 'draft');
const isLocked = computed(
    () => draft.record.value !== null && status.value !== 'draft',
);
const heading = computed(() =>
    medicalRecordNoteTypeNarrativeHeading(recordType.value),
);

const handoffOpen = ref(false);
const { respondToHandoff, cancelHandoff } = useMedicalRecordHandoff();

const record = computed(() => draft.record.value);
const handoffStatus = computed(() => record.value?.handoffStatus ?? null);
const isPendingHandoffRecipient = computed(
    () =>
        handoffStatus.value === 'pending' &&
        record.value?.handedOffToUserId === currentUser.value?.id,
);
const isPendingHandoffInitiator = computed(
    () =>
        handoffStatus.value === 'pending' &&
        record.value?.handoffInitiatedByUserId === currentUser.value?.id,
);
const isAcceptedHandoffRecipient = computed(
    () =>
        handoffStatus.value === 'accepted' &&
        record.value?.handedOffToUserId === currentUser.value?.id &&
        record.value?.authorUserId === currentUser.value?.id,
);
const canHandoff = computed(
    () =>
        record.value !== null &&
        status.value === 'draft' &&
        record.value?.authorUserId === currentUser.value?.id &&
        !handoffStatus.value,
);
const isHandedOffLocked = computed(
    () =>
        record.value !== null &&
        handoffStatus.value === 'accepted' &&
        record.value?.authorUserId !== currentUser.value?.id,
);

async function handleAcceptHandoff(): Promise<void> {
    if (!record.value) return;
    try {
        await respondToHandoff.mutateAsync({
            medicalRecordId: record.value.id,
            action: 'accept',
        });
        draft.record.value = {
            ...record.value,
            handoffStatus: 'accepted',
            authorUserId: currentUser.value?.id ?? record.value.authorUserId,
            handedOffToUserId: currentUser.value?.id ?? null,
        };
        if (draft.lastSavedContent.value) {
            Object.assign(content, draft.lastSavedContent.value);
        }
    } catch {
        // handled in composable
    }
}

async function handleDeclineHandoff(): Promise<void> {
    if (!record.value) return;
    try {
        await respondToHandoff.mutateAsync({
            medicalRecordId: record.value.id,
            action: 'decline',
        });
        draft.record.value = {
            ...record.value,
            handoffStatus: 'declined',
            handedOffToUserId: null,
        };
        // keep editing as original author
    } catch {
        // handled in composable
    }
}

async function handleCancelHandoff(): Promise<void> {
    if (!record.value) return;
    try {
        await cancelHandoff.mutateAsync(record.value.id);
        draft.record.value = {
            ...record.value,
            handoffStatus: null,
            handedOffToUserId: null,
            handoffInitiatedByUserId: null,
            handoffNote: null,
            handedOffAt: null,
        };
    } catch {
        // handled in composable
    }
}

function contentSignature(value: MedicalRecordDraftContent): string {
    return JSON.stringify([
        value.subjective,
        value.objective,
        value.assessment,
        value.plan,
        value.diagnosisCode,
    ]);
}

const isDirty = computed(() => {
    const saved = draft.lastSavedContent.value;
    if (saved === null) {
        return (
            contentSignature(content) !== contentSignature(EMPTY_DRAFT_CONTENT)
        );
    }
    return contentSignature(content) !== contentSignature(saved);
});

function canSave(): boolean {
    return (
        Boolean(props.patientId.trim()) &&
        !isLocked.value &&
        !draft.hasConflict.value
    );
}

const autosave = useNoteAutosave({
    save: ({ keepalive }) => draft.save({ ...content }, { keepalive }),
    isDirty: () => isDirty.value,
    canSave,
});

// Autosave on any content or note-type change.
watch(
    () => [
        content.subjective,
        content.objective,
        content.assessment,
        content.plan,
        content.diagnosisCode,
        recordType.value,
    ],
    () => autosave.notifyChange(),
);

function loadContentFrom(record: MedicalRecordResponse): void {
    content.subjective = record.subjective ?? '';
    content.objective = record.objective ?? '';
    content.assessment = record.assessment ?? '';
    content.plan = record.plan ?? '';
    content.diagnosisCode = record.diagnosisCode ?? '';
    recordType.value = record.recordType;
}

/**
 * True only when an existing draft was found and silently resumed on mount
 * (not when a fresh note is started, and not for props.existingRecord, which
 * is an already-known finalized/amended note being reopened, not a surprise
 * continuation). Exposed so the page can show it explicitly rather than
 * letting a previously-saved draft's content "just appear" with no
 * explanation.
 */
const resumedExistingDraft = ref(false);

onMounted(async () => {
    if (props.existingRecord) {
        draft.hydrateExisting(props.existingRecord);
        loadContentFrom(props.existingRecord);
        return;
    }

    // The workspace bundle's primaryMedicalRecord only resolves finalized/amended
    // notes — a draft note (the common, active-editing case) is invisible there
    // by design. Check explicitly before assuming there's nothing to continue,
    // otherwise a real, previously-saved draft renders as a blank composer.
    if (draft.record.value === null) {
        const existingContent = await draft.findAndHydrateExistingDraft();
        if (existingContent && draft.record.value) {
            loadContentFrom(draft.record.value);
            resumedExistingDraft.value = true;
        }
    }
});

async function saveNow(): Promise<void> {
    const outcome = await autosave.flush('manual');
    if (draft.syncState.value === 'error') {
        notifyError(draft.syncError.value ?? 'Unable to save this note.');
    }
    return outcome;
}

function adoptServer(): void {
    const serverContent = draft.adoptServerVersion();
    if (serverContent) {
        Object.assign(content, serverContent);
        notifySuccess('Loaded the latest saved version of this note.');
    }
}

async function overwriteServer(): Promise<void> {
    const outcome = await draft.overwriteServerVersion({ ...content });
    if (outcome === 'saved') {
        notifySuccess('Your changes were saved over the server copy.');
    } else if (outcome === 'error') {
        notifyError(draft.syncError.value ?? 'Unable to save this note.');
    }
}

async function runLifecycle(
    action: () => Promise<MedicalRecordResponse>,
    successMessage: string,
): Promise<void> {
    if (draft.record.value === null) return;
    try {
        const updated = await action();
        draft.record.value = updated;
        // An amend reopens the note as a draft — reload editable content from
        // the server's actual returned record (never assume requested==stored).
        loadContentFrom(updated);
        draft.hydrateExisting(updated);
        notifySuccess(successMessage);
        emit('status-changed', updated);
    } catch (error) {
        notifyError(
            messageFromUnknown(error, 'Unable to update the note status.'),
        );
    }
}

function onFinalize(): void {
    if (draft.record.value === null) return;
    void runLifecycle(
        () => lifecycle.finalize(draft.record.value!.id),
        'Note finalized.',
    );
}
function onAmend(reason: string): void {
    if (draft.record.value === null) return;
    void runLifecycle(
        () => lifecycle.amend(draft.record.value!.id, reason),
        'Note reopened for amendment.',
    );
}
function onArchive(reason: string): void {
    if (draft.record.value === null) return;
    void runLifecycle(
        () => lifecycle.archive(draft.record.value!.id, reason),
        'Note archived.',
    );
}

defineExpose({
    activeRecord: computed(() => draft.record.value),
    resumedExistingDraft,
});

const syncLabel = computed(() => {
    switch (draft.syncState.value) {
        case 'saving':
            return 'Saving…';
        case 'saved':
            return isDirty.value ? 'Unsaved changes' : 'All changes saved';
        case 'conflict':
            return 'Conflict — resolve below';
        case 'error':
            return 'Save failed';
        default:
            return isDirty.value ? 'Unsaved changes' : 'No changes yet';
    }
});
</script>

<template>
    <section class="space-y-4">
        <header class="space-y-1">
            <div class="flex items-center justify-between gap-2">
                <h2 class="text-lg font-semibold">{{ heading.title }}</h2>
                <Button
                    v-if="canHandoff"
                    variant="ghost"
                    size="sm"
                    class="gap-1.5 text-muted-foreground"
                    @click="handoffOpen = true"
                >
                    <AppIcon name="user-plus" class="size-3.5" />
                    Hand off
                </Button>
            </div>
            <p class="text-sm text-muted-foreground">{{ heading.subtitle }}</p>
        </header>

        <NoteTypeSelector
            v-model="recordType"
            :disabled="draft.record.value !== null"
        />

        <Alert v-if="draft.hasConflict.value" variant="destructive">
            <AlertTitle>This note changed elsewhere</AlertTitle>
            <AlertDescription class="space-y-2">
                <p>
                    Someone else saved this note while you were editing. Choose
                    which version to keep.
                </p>
                <div class="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" @click="adoptServer">
                        Use the latest saved version
                    </Button>
                    <Button size="sm" @click="overwriteServer">
                        Keep my changes
                    </Button>
                </div>
            </AlertDescription>
        </Alert>

        <Alert
            v-if="isLocked && !isHandedOffLocked"
            class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
        >
            <AlertTitle>This note is {{ status }}</AlertTitle>
            <AlertDescription>
                Finalized notes are read-only. Use Amend to reopen it for
                editing.
            </AlertDescription>
        </Alert>

        <Alert
            v-if="isHandedOffLocked"
            class="border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100"
        >
            <AlertTitle class="flex items-center gap-1.5">
                <AppIcon name="lock" class="size-3.5" />
                Transferred to {{ record?.handedOffToUserName ?? 'another clinician' }}
            </AlertTitle>
            <AlertDescription>
                This note was handed off and is now locked to the accepting
                clinician.
            </AlertDescription>
        </Alert>

        <Alert
            v-if="isPendingHandoffRecipient"
            class="border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100"
        >
            <AlertTitle class="flex items-center gap-1.5">
                <AppIcon name="user-plus" class="size-3.5" />
                Note handed off to you
            </AlertTitle>
            <AlertDescription class="space-y-2">
                <p>
                    {{ record?.handoffInitiatedByUserName ?? 'A clinician' }}
                    has handed this note to you.
                    <span v-if="record?.handoffNote" class="italic">
                        &ldquo;{{ record.handoffNote }}&rdquo;
                    </span>
                </p>
                <div class="flex gap-2">
                    <Button
                        size="sm"
                        @click="handleAcceptHandoff"
                        :disabled="respondToHandoff.isPending.value"
                    >
                        <AppIcon
                            v-if="respondToHandoff.isPending.value"
                            name="loader"
                            class="size-3.5 animate-spin"
                        />
                        <template v-else>Accept</template>
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        @click="handleDeclineHandoff"
                        :disabled="respondToHandoff.isPending.value"
                    >
                        Decline
                    </Button>
                </div>
            </AlertDescription>
        </Alert>

        <Alert
            v-if="isPendingHandoffInitiator"
            class="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
        >
            <AlertTitle class="flex items-center gap-1.5">
                <AppIcon name="clock" class="size-3.5" />
                Handoff pending
            </AlertTitle>
            <AlertDescription class="space-y-2">
                <p>
                    Waiting for
                    {{ record?.handedOffToUserName ?? 'the recipient' }} to
                    accept the handoff. You can still edit the note in the
                    meantime.
                </p>
                <Button
                    size="sm"
                    variant="outline"
                    @click="handleCancelHandoff"
                    :disabled="cancelHandoff.isPending.value"
                >
                    Cancel handoff
                </Button>
            </AlertDescription>
        </Alert>

        <div class="space-y-4">
            <NoteSoapSection
                :note-type="recordType"
                section="subjective"
                :model-value="content.subjective"
                :disabled="isLocked"
                @update:model-value="content.subjective = $event"
            />
            <NoteSoapSection
                :note-type="recordType"
                section="objective"
                :model-value="content.objective"
                :disabled="isLocked"
                @update:model-value="content.objective = $event"
            />
            <NoteSoapSection
                :note-type="recordType"
                section="assessment"
                :model-value="content.assessment"
                :disabled="isLocked"
                @update:model-value="content.assessment = $event"
            />
            <NoteSoapSection
                :note-type="recordType"
                section="plan"
                :model-value="content.plan"
                :disabled="isLocked"
                @update:model-value="content.plan = $event"
            />

            <div class="space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                    <Label for="note-diagnosis" class="text-sm font-medium">
                        Diagnosis code (ICD-10)
                    </Label>
                    <Button
                        v-if="canManageEncounterDiagnoses"
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-6 gap-1 px-1.5 text-xs"
                        @click="emit('open-add-encounter-diagnosis')"
                    >
                        + Add to encounter
                    </Button>
                </div>
                <input
                    id="note-diagnosis"
                    :value="content.diagnosisCode"
                    :disabled="isLocked"
                    placeholder="e.g. R52 or J11.1"
                    class="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60"
                    @input="
                        content.diagnosisCode = (
                            $event.target as HTMLInputElement
                        ).value
                    "
                />
                <p class="text-xs text-muted-foreground">
                    Saved here on finalize; also becomes the encounter's primary diagnosis automatically at that point.
                </p>
                <div
                    v-if="(encounterDiagnoses ?? []).length > 0"
                    class="flex flex-wrap gap-1.5 pt-1"
                >
                    <span
                        v-for="diagnosis in encounterDiagnoses"
                        :key="diagnosis.id"
                        class="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground"
                    >
                        <span
                            class="rounded-sm px-1 text-[10px] font-medium uppercase"
                            :class="diagnosis.diagnosisType === 'primary' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'"
                        >
                            {{ diagnosis.diagnosisType === 'primary' ? 'Primary' : 'Secondary' }}
                        </span>
                        {{ diagnosis.diagnosisCode }}
                    </span>
                </div>
            </div>
        </div>

        <footer
            class="flex flex-wrap items-center justify-between gap-3 border-t pt-3"
        >
            <div class="flex items-center gap-2">
                <Button
                    v-if="canHandoff"
                    variant="ghost"
                    size="sm"
                    class="gap-1.5 text-muted-foreground"
                    @click="handoffOpen = true"
                >
                    <AppIcon name="user-plus" class="size-3.5" />
                    Hand off
                </Button>
                <p class="text-xs text-muted-foreground" role="status">
                    {{ syncLabel }}
                </p>
            </div>
            <div class="flex items-center gap-2">
                <Button
                    v-if="!isLocked"
                    variant="outline"
                    size="sm"
                    :disabled="draft.isSaving.value || !isDirty"
                    @click="saveNow"
                >
                    Save now
                </Button>
                <NoteLifecycleActions
                    :status="status"
                    :can-finalize="canFinalize ?? false"
                    :can-amend="canAmend ?? false"
                    :can-archive="canArchive ?? false"
                    :is-pending="lifecycle.isPending.value"
                    @finalize="onFinalize"
                    @amend="onAmend"
                    @archive="onArchive"
                />
            </div>
        </footer>
    </section>

    <NoteHandoffSheet
        v-if="record?.id"
        v-model:open="handoffOpen"
        :medical-record-id="record.id"
        @handed-off="loadContentFrom(record)"
    />
</template>
