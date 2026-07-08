<script setup lang="ts">
import { computed } from 'vue';
import RichTextEditorField from '@/components/editor/RichTextEditorField.vue';
import {
    type MedicalRecordNarrativeSectionKey,
    medicalRecordNoteTypeSectionLabel,
    medicalRecordNoteTypeSectionUi,
} from '@/pages/medical-records/noteTypes';

/**
 * One SOAP narrative section, reused per section rather than duplicated four
 * times. Label/placeholder/description come from the note-type metadata
 * (noteTypes.ts) so e.g. a procedure_note shows "Indication / Procedure details
 * / Outcome / Recovery plan" instead of the generic S/O/A/P — preserving the
 * behavior documented in reports/clinical-note-audit/06 §6.5.
 *
 * Uses the existing, proven RichTextEditorField (TipTap: bold/italic/bullet/
 * numbered list/undo/redo), the same component the old Workspace.vue used for
 * these exact fields — not rebuilt, just reused. Content is stored as HTML;
 * the backend's subjective/objective/assessment/plan fields already accept
 * any string with no format restriction, so this is a pure frontend change.
 */
const props = defineProps<{
    noteType: string;
    section: MedicalRecordNarrativeSectionKey;
    modelValue: string;
    disabled?: boolean;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const label = computed(() =>
    medicalRecordNoteTypeSectionLabel(props.noteType, props.section),
);
const ui = computed(() =>
    medicalRecordNoteTypeSectionUi(props.noteType, props.section),
);
const fieldId = computed(() => `note-section-${props.section}`);
</script>

<template>
    <div class="space-y-1.5">
        <p v-if="ui.description" class="text-xs text-muted-foreground">
            {{ ui.description }}
        </p>
        <RichTextEditorField
            :input-id="fieldId"
            :model-value="modelValue"
            :label="label"
            :placeholder="ui.placeholder"
            :disabled="disabled"
            min-height-class="min-h-[90px]"
            @update:model-value="
                emit('update:modelValue', String($event ?? ''))
            "
        />
    </div>
</template>
