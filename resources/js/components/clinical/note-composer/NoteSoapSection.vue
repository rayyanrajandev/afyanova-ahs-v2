<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import RichTextEditorField from '@/components/editor/RichTextEditorField.vue';
import {
    type MedicalRecordNarrativeSectionKey,
    medicalRecordNoteTypeSectionLabel,
    medicalRecordNoteTypeSectionSample,
    medicalRecordNoteTypeSectionUi,
} from '@/pages/medical-records/noteTypes';

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
const sample = computed(() =>
    medicalRecordNoteTypeSectionSample(props.noteType, props.section),
);
const fieldId = computed(() => `note-section-${props.section}`);
</script>

<template>
    <div class="space-y-1.5">
        <div class="flex items-start justify-between gap-2">
            <p v-if="ui.description" class="text-xs text-muted-foreground">
                {{ ui.description }}
            </p>
            <Popover>
                <PopoverTrigger as-child>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        class="shrink-0 size-5"
                        :title="`View sample ${label}`"
                    >
                        <AppIcon name="info" class="size-3" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="end"
                    class="w-80 space-y-1.5 text-xs"
                >
                    <p class="text-sm font-medium">
                        Sample {{ label }}
                    </p>
                    <p class="whitespace-pre-line text-muted-foreground">
                        {{ sample }}
                    </p>
                </PopoverContent>
            </Popover>
        </div>
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
