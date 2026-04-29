<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const props = withDefaults(
    defineProps<{
        inputId: string;
        label: string;
        placeholder?: string;
        helperText?: string;
        errorMessage?: string | null;
        disabled?: boolean;
        open: boolean;
        query: string;
        displayValue?: string;
        showClear?: boolean;
        openOnFocus?: boolean;
        accessDenied?: boolean;
        accessDeniedMessage?: string | null;
        contentClass?: string;
        resultsClass?: string;
    }>(),
    {
        placeholder: 'Search',
        helperText: '',
        errorMessage: null,
        disabled: false,
        displayValue: '',
        showClear: false,
        openOnFocus: true,
        accessDenied: false,
        accessDeniedMessage: null,
        contentClass: 'w-full rounded-lg p-0',
        resultsClass: 'max-h-80 overflow-y-auto p-1.5',
    },
);

const emit = defineEmits<{
    'update:open': [value: boolean];
    'update:query': [value: string];
    clear: [];
    focus: [];
}>();

const lookupRoot = ref<HTMLElement | null>(null);

const openProxy = computed({
    get: () => props.open,
    set: (value: boolean) => emit('update:open', value),
});

const queryProxy = computed({
    get: () => props.query,
    set: (value: string) => emit('update:query', value),
});

function handleInputFocus() {
    if (props.disabled) return;

    emit('focus');
    if (props.openOnFocus) {
        emit('update:open', true);
    }
}

function handleRootFocusOut() {
    if (typeof window === 'undefined') return;

    window.requestAnimationFrame(() => {
        const root = lookupRoot.value;
        if (!root) return;
        if (root.contains(document.activeElement)) return;
        emit('update:open', false);
    });
}

function handleEscape() {
    emit('update:open', false);
}
</script>

<template>
    <FormFieldShell
        :input-id="inputId"
        :label="label"
        :helper-text="helperText"
        :error-message="errorMessage"
    >
        <template v-if="accessDenied">
            <slot name="access-denied">
                <div class="flex flex-nowrap items-stretch overflow-hidden rounded-lg border border-input bg-transparent shadow-xs">
                    <span class="flex h-8 shrink-0 items-center border-0 border-r border-input bg-muted/30 pl-3 pr-2 text-muted-foreground">
                        <AppIcon name="search" class="size-4" aria-hidden />
                    </span>
                    <Input
                        :id="inputId"
                        :value="query"
                        :placeholder="placeholder"
                        class="h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent py-1.5 pl-2 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        disabled
                    />
                </div>

                <Alert v-if="accessDeniedMessage" variant="destructive">
                    <AlertDescription class="text-xs">
                        {{ accessDeniedMessage }}
                    </AlertDescription>
                </Alert>
            </slot>
        </template>

        <template v-else>
            <div ref="lookupRoot" class="relative" @focusout="handleRootFocusOut">
                <div class="flex flex-nowrap items-stretch overflow-hidden rounded-lg border border-input bg-transparent shadow-xs focus-within:ring-2 focus-within:ring-ring/50 focus-within:ring-offset-0">
                    <span class="flex h-8 shrink-0 items-center border-0 border-r border-input bg-muted/30 pl-3 pr-2 text-muted-foreground">
                        <AppIcon name="search" class="size-4" aria-hidden />
                    </span>
                    <div class="relative min-w-0 flex-1">
                        <Input
                            :id="inputId"
                            v-model="queryProxy"
                            :placeholder="displayValue ? '' : placeholder"
                            :disabled="disabled"
                            class="h-8 w-full min-w-0 rounded-none border-0 bg-transparent py-1.5 pl-2 pr-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            autocomplete="off"
                            @focus="handleInputFocus"
                            @keydown.esc="handleEscape"
                        />
                        <span
                            v-if="displayValue && !queryProxy.trim()"
                            class="pointer-events-none absolute inset-y-0 left-2 right-2 flex items-center truncate text-sm text-foreground"
                        >
                            {{ displayValue }}
                        </span>
                    </div>
                    <Button
                        v-if="showClear"
                        type="button"
                        variant="outline"
                        size="sm"
                        class="h-8 shrink-0 rounded-none border-0 border-l border-input bg-muted/50 px-3 hover:bg-muted"
                        :disabled="disabled"
                        @click="emit('clear')"
                    >
                        Clear
                    </Button>
                </div>

                <div
                    v-if="openProxy"
                    :class="['absolute left-0 top-full z-50 mt-1 overflow-hidden border bg-popover text-popover-foreground shadow-md', contentClass]"
                >
                    <div :class="resultsClass">
                        <slot name="results" />
                    </div>

                    <div v-if="$slots.footer" class="border-t bg-muted/20 px-3 py-2">
                        <slot name="footer" />
                    </div>
                </div>
            </div>
        </template>
    </FormFieldShell>
</template>



