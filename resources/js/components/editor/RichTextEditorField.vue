<script setup lang="ts">
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Redo2,
    Undo2,
} from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const props = withDefaults(
    defineProps<{
        modelValue: string;
        inputId: string;
        label: string;
        helperText?: string;
        errorMessage?: string | null;
        disabled?: boolean;
        minHeightClass?: string;
        placeholder?: string;
    }>(),
    {
        helperText: '',
        errorMessage: null,
        disabled: false,
        minHeightClass: 'min-h-[140px]',
        placeholder: 'Enter note…',
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const editorInitError = ref<string | null>(null);
const fallbackValue = computed({
    get: () => props.modelValue ?? '',
    set: (value: string) => emit('update:modelValue', value),
});

function normalizeHtml(value: string | null | undefined): string {
    if (!value) return '';

    const trimmed = value.trim();
    if (trimmed === '<p></p>') return '';

    return trimmed;
}

const editor = (() => {
    try {
        const instance = useEditor({
            extensions: [
                StarterKit,
                Placeholder.configure({
                    placeholder: props.placeholder,
                    emptyEditorClass: 'is-editor-empty',
                    emptyNodeClass: 'is-empty',
                }),
            ],
            editable: !props.disabled,
            content: normalizeHtml(props.modelValue),
            editorProps: {
                attributes: {
                    class: 'tiptap-editor-content',
                    'data-placeholder': props.placeholder,
                },
            },
            onUpdate: ({ editor: tiptapEditor }) => {
                emit(
                    'update:modelValue',
                    normalizeHtml(tiptapEditor.getHTML()),
                );
            },
        });

        editorInitError.value = null;
        return instance;
    } catch (error) {
        editorInitError.value =
            error instanceof Error
                ? error.message
                : 'Rich text editor failed to initialize.';
        return ref(null);
    }
})();

function setMark(command: 'bold' | 'italic') {
    if (!editor.value || props.disabled) return;

    const chain = editor.value.chain().focus();
    if (command === 'bold') {
        chain.toggleBold().run();
        return;
    }

    chain.toggleItalic().run();
}

function setNode(command: 'bulletList' | 'orderedList') {
    if (!editor.value || props.disabled) return;

    const chain = editor.value.chain().focus();
    if (command === 'bulletList') {
        chain.toggleBulletList().run();
        return;
    }

    chain.toggleOrderedList().run();
}

function editorAction(command: 'undo' | 'redo') {
    if (!editor.value || props.disabled) return;

    const chain = editor.value.chain().focus();
    if (command === 'undo') {
        chain.undo().run();
        return;
    }

    chain.redo().run();
}

function toolbarPressed(
    check: (editorInstance: NonNullable<typeof editor.value>) => boolean,
): boolean {
    return editor.value ? check(editor.value) : false;
}

watch(
    () => props.modelValue,
    (value) => {
        if (!editor.value) return;

        const next = normalizeHtml(value);
        const current = normalizeHtml(editor.value.getHTML());

        if (next === current) return;

        editor.value.commands.setContent(next || '', false);
    },
);

watch(
    () => props.disabled,
    (disabled) => {
        editor.value?.setEditable(!disabled);
    },
);
</script>

<template>
    <FormFieldShell
        :input-id="inputId"
        :label="label"
        :helper-text="helperText"
        :error-message="errorMessage"
    >
        <div
            class="rich-text-editor-wrap rounded-lg border border-input bg-background shadow-sm transition-[box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20"
        >
            <div
                v-if="editor"
                class="flex flex-wrap items-center gap-1 border-b border-border/60 bg-muted/30 px-2 py-1.5"
            >
                <div class="flex items-center gap-0.5">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8 rounded-md"
                        :disabled="disabled || !editor"
                        :aria-pressed="
                            toolbarPressed(
                                () => editor?.isActive('bold') ?? false,
                            )
                        "
                        @click="setMark('bold')"
                    >
                        <Bold class="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8 rounded-md"
                        :disabled="disabled || !editor"
                        :aria-pressed="
                            toolbarPressed((editorInstance) =>
                                editorInstance.isActive('italic'),
                            )
                        "
                        @click="setMark('italic')"
                    >
                        <Italic class="h-4 w-4" aria-hidden />
                    </Button>
                </div>
                <div
                    class="mx-1 h-5 w-px shrink-0 bg-border"
                    aria-hidden
                />
                <div class="flex items-center gap-0.5">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8 rounded-md"
                        :disabled="disabled || !editor"
                        :aria-pressed="
                            toolbarPressed((editorInstance) =>
                                editorInstance.isActive('bulletList'),
                            )
                        "
                        @click="setNode('bulletList')"
                    >
                        <List class="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8 rounded-md"
                        :disabled="disabled || !editor"
                        :aria-pressed="
                            toolbarPressed((editorInstance) =>
                                editorInstance.isActive('orderedList'),
                            )
                        "
                        @click="setNode('orderedList')"
                    >
                        <ListOrdered class="h-4 w-4" aria-hidden />
                    </Button>
                </div>
                <div
                    class="mx-1 h-5 w-px shrink-0 bg-border"
                    aria-hidden
                />
                <div class="flex items-center gap-0.5">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8 rounded-md"
                        :disabled="disabled || !editor"
                        title="Undo"
                        @click="editorAction('undo')"
                    >
                        <Undo2 class="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        class="h-8 w-8 rounded-md"
                        :disabled="disabled || !editor"
                        title="Redo"
                        @click="editorAction('redo')"
                    >
                        <Redo2 class="h-4 w-4" aria-hidden />
                    </Button>
                </div>
            </div>

            <EditorContent
                v-if="editor"
                :id="inputId"
                :editor="editor"
                :class="[
                    'rich-text-editor',
                    minHeightClass,
                    { 'opacity-70': disabled },
                ]"
            />

            <Textarea
                v-else-if="editorInitError"
                :id="inputId"
                v-model="fallbackValue"
                :disabled="disabled"
                :class="[minHeightClass, 'resize-y border-0 shadow-none']"
                placeholder="Enter clinical note..."
            />

            <div
                v-else
                :class="[
                    'flex items-center px-3 py-2 text-sm text-muted-foreground',
                    minHeightClass,
                ]"
            >
                Loading editor...
            </div>
        </div>

        <Alert v-if="editorInitError" variant="destructive">
            <AlertDescription class="text-xs">
                Rich text editor unavailable. Using plain text fallback.
            </AlertDescription>
        </Alert>
    </FormFieldShell>
</template>

<style scoped>
.rich-text-editor-wrap :deep([aria-pressed='true']) {
    background-color: hsl(var(--muted));
    color: hsl(var(--foreground));
}

.rich-text-editor :deep(.ProseMirror) {
    min-height: inherit;
    outline: none;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    line-height: 1.6;
}

/* Placeholder when editor is empty (single empty paragraph) */
.rich-text-editor :deep(.ProseMirror p.is-empty:first-child:last-child::before) {
    content: attr(data-placeholder);
    color: hsl(var(--muted-foreground));
    float: left;
    height: 0;
    pointer-events: none;
}

.rich-text-editor :deep(.ProseMirror p) {
    margin: 0.25rem 0;
}

.rich-text-editor :deep(.ProseMirror ul) {
    list-style-type: disc;
    margin: 0.5rem 0;
    padding-left: 1.5rem;
}

.rich-text-editor :deep(.ProseMirror ol) {
    list-style-type: decimal;
    margin: 0.5rem 0;
    padding-left: 1.5rem;
}

.rich-text-editor :deep(.ProseMirror li) {
    margin: 0.125rem 0;
    display: list-item;
}
</style>
