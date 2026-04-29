<script setup lang="ts">
import { Check, ChevronsUpDown } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import type { SearchableSelectOption } from '@/lib/patientLocations';
import { cn } from '@/lib/utils';

type Props = {
    inputId: string;
    label: string;
    modelValue: string;
    options: SearchableSelectOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    helperText?: string;
    errorMessage?: string | null;
    emptyText?: string;
    disabled?: boolean;
    required?: boolean;
    triggerClass?: string;
    messageClass?: string;
    containerClass?: string;
    labelClass?: string;
    reserveMessageSpace?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
    placeholder: 'Select value',
    searchPlaceholder: 'Search options',
    helperText: '',
    errorMessage: null,
    emptyText: 'No matching option found.',
    disabled: false,
    required: false,
    triggerClass: '',
    messageClass: '',
    containerClass: '',
    labelClass: '',
    reserveMessageSpace: true,
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const open = ref(false);
const commandSearch = ref('');

function normalizeValue(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

const uniqueOptions = computed(() => {
    const seen = new Set<string>();

    return props.options.filter((option) => {
        const value = option.value.trim();
        const key = normalizeValue(value);
        if (!value || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
});

const groupedOptions = computed(() => {
    const groups: Array<{ label: string; options: SearchableSelectOption[] }> = [];
    const map = new Map<string, { label: string; options: SearchableSelectOption[] }>();
    const ungrouped: SearchableSelectOption[] = [];

    uniqueOptions.value.forEach((option) => {
        const label = option.group?.trim() ?? '';
        if (!label) {
            ungrouped.push(option);
            return;
        }

        const key = normalizeValue(label);
        let group = map.get(key);
        if (!group) {
            group = { label, options: [] };
            map.set(key, group);
            groups.push(group);
        }

        group.options.push(option);
    });

    if (groups.length === 0) {
        return [{ label: '', options: uniqueOptions.value }];
    }

    if (ungrouped.length > 0) {
        groups.push({ label: 'Other', options: ungrouped });
    }

    return groups;
});

const selectedOption = computed(() =>
    uniqueOptions.value.find(
        (option) => normalizeValue(option.value) === normalizeValue(props.modelValue),
    ) ?? null,
);

const selectedSummary = computed(() => {
    const direct = props.modelValue.trim();
    if (!direct) return props.placeholder;
    return selectedOption.value?.label ?? direct;
});

const triggerClasses = computed(() =>
    cn(
        'border-input [&_svg:not([class*=\'text-\'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        props.triggerClass,
        { 'border-destructive': Boolean(props.errorMessage) },
    ),
);

function selectValue(value: string) {
    emit('update:modelValue', value.trim());
    open.value = false;
}

watch(
    () => open.value,
    (isOpen) => {
        if (!isOpen) {
            commandSearch.value = '';
        }
    },
);
</script>

<template>
    <FormFieldShell
        :input-id="inputId"
        :label="label"
        :required="required"
        :helper-text="helperText"
        :error-message="errorMessage"
        :container-class="containerClass"
        :label-class="labelClass"
        :message-class="messageClass"
        :reserve-message-space="reserveMessageSpace"
    >
        <Popover v-model:open="open">
            <PopoverTrigger as-child>
                <button
                    :id="inputId"
                    type="button"
                    role="combobox"
                    :aria-expanded="open"
                    :disabled="disabled"
                    :class="triggerClasses"
                >
                    <span
                        class="min-w-0 flex-1 truncate text-left"
                        :class="{ 'text-muted-foreground': !modelValue.trim() }"
                    >
                        {{ selectedSummary }}
                    </span>
                    <ChevronsUpDown class="size-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" class="w-[var(--reka-popover-trigger-width)] p-0">
                <Command v-model="commandSearch">
                    <CommandInput :placeholder="searchPlaceholder" />
                    <CommandList>
                        <CommandEmpty>{{ emptyText }}</CommandEmpty>
                        <template
                            v-for="group in groupedOptions"
                            :key="`${inputId}-${group.label || 'default-group'}`"
                        >
                            <CommandGroup :heading="group.label || undefined">
                                <CommandItem
                                    v-for="option in group.options"
                                    :key="`${inputId}-${option.value}`"
                                    :value="[
                                        option.label,
                                        option.value,
                                        option.description ?? '',
                                        option.group ?? '',
                                        ...(option.keywords ?? []),
                                    ].join(' ')"
                                    @select="selectValue(option.value)"
                                >
                                    <Check
                                        :class="cn(
                                            'size-4',
                                            normalizeValue(option.value) === normalizeValue(modelValue)
                                                ? 'opacity-100'
                                                : 'opacity-0',
                                        )"
                                    />
                                    <div class="flex min-w-0 flex-1 flex-col">
                                        <span class="truncate">{{ option.label }}</span>
                                        <span
                                            v-if="option.description"
                                            class="truncate text-xs text-muted-foreground"
                                        >
                                            {{ option.description }}
                                        </span>
                                    </div>
                                </CommandItem>
                            </CommandGroup>
                        </template>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    </FormFieldShell>
</template>
