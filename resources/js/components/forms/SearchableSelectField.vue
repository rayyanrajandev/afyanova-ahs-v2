<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import type { SearchableSelectOption } from '@/lib/patientLocations';

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
    allowCustomValue?: boolean;
    triggerClass?: string;
    searchInputClass?: string;
    messageClass?: string;
};

const props = withDefaults(defineProps<Props>(), {
    placeholder: 'Select value',
    searchPlaceholder: 'Search options',
    helperText: '',
    errorMessage: null,
    emptyText: 'No matching option found.',
    disabled: false,
    required: false,
    allowCustomValue: false,
    triggerClass: '',
    searchInputClass: '',
    messageClass: '',
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const open = ref(false);
const searchQuery = ref('');

function normalizeValue(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function normalizeSearchText(value: string | null | undefined): string {
    return (value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenizeSearchQuery(value: string | null | undefined): string[] {
    const normalized = normalizeSearchText(value);
    return normalized ? normalized.split(' ') : [];
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

const selectedOption = computed(() =>
    uniqueOptions.value.find(
        (option) =>
            normalizeValue(option.value) === normalizeValue(props.modelValue),
    ),
);

function optionMatchScore(option: SearchableSelectOption, query: string): number {
    const normalizedQuery = normalizeSearchText(query);
    const queryTokens = tokenizeSearchQuery(query);
    if (!normalizedQuery || queryTokens.length === 0) return 0;

    const normalizedLabel = normalizeSearchText(option.label);
    const normalizedValue = normalizeSearchText(option.value);
    const normalizedDescription = normalizeSearchText(option.description ?? '');
    const normalizedGroup = normalizeSearchText(option.group ?? '');
    const keywords = (option.keywords ?? []).map((keyword) =>
        normalizeSearchText(keyword),
    );
    const searchableFields = [
        normalizedLabel,
        normalizedValue,
        normalizedDescription,
        normalizedGroup,
        ...keywords,
    ].filter((field) => field.length > 0);

    const directFieldMatch = searchableFields.some((field) => field === normalizedQuery);
    if (directFieldMatch) {
        return 500;
    }

    const directPrefixMatch = searchableFields.some((field) =>
        field.startsWith(normalizedQuery),
    );
    if (directPrefixMatch) {
        return 420;
    }

    const directContainsMatch = searchableFields.some((field) =>
        field.includes(normalizedQuery),
    );
    if (directContainsMatch) {
        return 340;
    }

    let score = 0;

    for (const token of queryTokens) {
        let bestTokenScore = 0;

        searchableFields.forEach((field) => {
            if (field === token) {
                bestTokenScore = Math.max(bestTokenScore, 120);
                return;
            }

            if (field.startsWith(token)) {
                bestTokenScore = Math.max(bestTokenScore, 90);
                return;
            }

            if (field.includes(token)) {
                bestTokenScore = Math.max(bestTokenScore, 60);
            }
        });

        if (bestTokenScore === 0) {
            return 0;
        }

        score += bestTokenScore;
    }

    if (normalizedLabel.includes(queryTokens[0] ?? '')) {
        score += 20;
    }

    return score;
}

const filteredOptions = computed(() => {
    const query = normalizeSearchText(searchQuery.value);
    if (!query) return uniqueOptions.value;

    return uniqueOptions.value
        .map((option, index) => ({
            option,
            index,
            score: optionMatchScore(option, query),
        }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            const groupCompare = (left.option.group ?? '').localeCompare(
                right.option.group ?? '',
            );
            if (groupCompare !== 0) return groupCompare;

            const labelCompare = left.option.label.localeCompare(right.option.label);
            if (labelCompare !== 0) return labelCompare;

            return left.index - right.index;
        })
        .map((entry) => entry.option);
});

const selectedSummary = computed(() => {
    const direct = props.modelValue.trim();
    if (!direct) return props.placeholder;
    return selectedOption.value?.label ?? direct;
});

const groupedFilteredOptions = computed(() => {
    const groups: Array<{ label: string; options: SearchableSelectOption[] }> = [];
    const grouped = new Map<string, { label: string; options: SearchableSelectOption[] }>();
    const ungrouped: SearchableSelectOption[] = [];

    filteredOptions.value.forEach((option) => {
        const groupLabel = option.group?.trim() ?? '';
        if (!groupLabel) {
            ungrouped.push(option);
            return;
        }

        const key = normalizeValue(groupLabel);
        let group = grouped.get(key);
        if (!group) {
            group = { label: groupLabel, options: [] };
            grouped.set(key, group);
            groups.push(group);
        }

        group.options.push(option);
    });

    if (groups.length === 0) {
        return [{ label: '', options: filteredOptions.value }];
    }

    if (ungrouped.length > 0) {
        groups.push({ label: 'Other', options: ungrouped });
    }

    return groups;
});

const showGroupHeaders = computed(() =>
    groupedFilteredOptions.value.some((group) => group.label.trim() !== ''),
);

const customCandidate = computed(() => {
    const candidate = searchQuery.value.trim();
    if (!props.allowCustomValue || !candidate) return '';

    const candidateKey = normalizeValue(candidate);
    const exists = uniqueOptions.value.some(
        (option) =>
            normalizeValue(option.value) === candidateKey ||
            normalizeValue(option.label) === candidateKey,
    );

    return exists ? '' : candidate;
});

function selectValue(value: string) {
    emit('update:modelValue', value.trim());
    open.value = false;
}

function clearValue() {
    emit('update:modelValue', '');
    open.value = false;
}

watch(
    () => open.value,
    (isOpen) => {
        if (!isOpen) {
            searchQuery.value = '';
            return;
        }

        void nextTick(() => {
            const searchInput = document.getElementById(
                `${props.inputId}-search`,
            ) as HTMLInputElement | null;
            searchInput?.focus();
            searchInput?.select();
        });
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
        :message-class="messageClass"
        label-class="text-xs"
    >
        <Popover v-model:open="open">
            <PopoverTrigger as-child>
                <Button
                    :id="inputId"
                    type="button"
                    variant="outline"
                    :class="[
                        'h-9 w-full justify-between px-3 font-normal',
                        triggerClass,
                        {
                            'border-destructive': Boolean(errorMessage),
                        },
                    ]"
                    :disabled="disabled"
                >
                    <span
                        class="truncate text-left"
                        :class="{ 'text-muted-foreground': !modelValue.trim() }"
                    >
                        {{ selectedSummary }}
                    </span>
                    <AppIcon name="search" class="size-4 shrink-0 text-muted-foreground" />
                </Button>
            </PopoverTrigger>

            <PopoverContent align="start" class="w-[var(--reka-popover-trigger-width)] p-0">
                <div class="border-b p-2">
                    <Input
                        :id="`${inputId}-search`"
                        v-model="searchQuery"
                        :placeholder="searchPlaceholder"
                        :class="['h-9', searchInputClass]"
                        autocomplete="off"
                    />
                </div>

                <div class="max-h-72 space-y-1 overflow-y-auto p-1.5">
                    <button
                        v-if="customCandidate"
                        type="button"
                        class="flex w-full flex-col items-start rounded-md border border-dashed px-3 py-2 text-left text-sm hover:bg-muted/50"
                        @click="selectValue(customCandidate)"
                    >
                        <span class="font-medium">Use "{{ customCandidate }}"</span>
                        <span class="text-xs text-muted-foreground">
                            Save a custom value for this patient
                        </span>
                    </button>

                    <template
                        v-for="group in groupedFilteredOptions"
                        :key="`${inputId}-${group.label || 'default-group'}`"
                    >
                        <div
                            v-if="showGroupHeaders && group.label"
                            class="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                            {{ group.label }}
                        </div>

                        <button
                            v-for="option in group.options"
                            :key="`${inputId}-${option.value}`"
                            type="button"
                            class="flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm hover:bg-muted/50"
                            :class="{
                                'bg-muted/60':
                                    normalizeValue(option.value) ===
                                    normalizeValue(modelValue),
                            }"
                            @click="selectValue(option.value)"
                        >
                            <div class="flex w-full items-start justify-between gap-3">
                                <span class="font-medium">{{ option.label }}</span>
                                <span
                                    v-if="!showGroupHeaders && option.group"
                                    class="shrink-0 text-[11px] text-muted-foreground"
                                >
                                    {{ option.group }}
                                </span>
                            </div>
                            <span
                                v-if="option.description"
                                class="text-xs text-muted-foreground"
                            >
                                {{ option.description }}
                            </span>
                        </button>
                    </template>

                    <p
                        v-if="filteredOptions.length === 0 && !customCandidate"
                        class="px-3 py-2 text-xs text-muted-foreground"
                    >
                        {{ emptyText }}
                    </p>
                </div>

                <div
                    v-if="modelValue.trim()"
                    class="flex justify-end border-t bg-muted/20 p-2"
                >
                    <Button type="button" size="sm" variant="ghost" @click="clearValue">
                        Clear
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    </FormFieldShell>
</template>
