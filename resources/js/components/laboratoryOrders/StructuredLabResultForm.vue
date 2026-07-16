<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { type ResultTemplate, type ResultTemplateSection } from '@/lib/resultTemplate';

const props = defineProps<{
    template: ResultTemplate;
    initialValues?: Record<string, string | string[]> | null;
}>();

const emit = defineEmits<{
    'update:values': [values: Record<string, string | string[]>];
}>();

function buildInitial(sections: ResultTemplateSection[]): Record<string, string | string[]> {
    const initial: Record<string, string | string[]> = {};
    for (const section of sections) {
        for (const field of section.fields) {
            if (field.type === 'multiselect') {
                initial[field.code] = [];
            } else if (field.type === 'select') {
                initial[field.code] = undefined as unknown as string;
            } else {
                initial[field.code] = '';
            }
        }
    }
    return initial;
}

const values = reactive<Record<string, string | string[]>>(
    props.initialValues && Object.keys(props.initialValues).length > 0
        ? { ...buildInitial(props.template.sections), ...props.initialValues }
        : buildInitial(props.template.sections),
);

watch(
    values,
    () => emit('update:values', { ...values }),
    { deep: true },
);

function toggleMultiSelect(code: string, option: string): void {
    const current = values[code] as string[];
    const idx = current.indexOf(option);
    if (idx === -1) {
        current.push(option);
    } else {
        current.splice(idx, 1);
    }
}

function isMultiSelected(code: string, option: string): boolean {
    return (values[code] as string[]).includes(option);
}

const hasAnyValue = computed(() =>
    Object.values(values).some((v) => {
        if (Array.isArray(v)) return v.length > 0;
        return String(v).trim() !== '';
    }),
);
</script>

<template>
    <div class="space-y-6">
        <div
            v-for="(section, sectionIdx) in template.sections"
            :key="sectionIdx"
            class="rounded-lg border p-4"
        >
            <div class="mb-3 space-y-0.5">
                <h4 class="text-sm font-semibold text-foreground">{{ section.label }}</h4>
                <p v-if="section.description" class="text-xs text-muted-foreground">
                    {{ section.description }}
                </p>
            </div>

            <div class="space-y-3">
                <template v-for="field in section.fields" :key="field.code">
                    <!-- Select dropdown -->
                    <div v-if="field.type === 'select'" class="grid gap-1.5">
                        <Label :for="`result-field-${field.code}`">{{ field.label }}</Label>
                        <Select v-model="(values[field.code] as string)">
                            <SelectTrigger :id="`result-field-${field.code}`" class="w-full">
                                <SelectValue :placeholder="`Select ${field.label.toLowerCase()}…`" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem
                                    v-for="option in field.options ?? []"
                                    :key="option"
                                    :value="option"
                                >
                                    {{ option }}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <!-- Positive/Negative/Not Done toggle -->
                    <div v-else-if="field.type === 'positive-negative'" class="grid gap-1.5">
                        <Label>{{ field.label }}</Label>
                        <div class="flex gap-2">
                            <button
                                type="button"
                                class="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                                :class="values[field.code] === 'Positive'
                                    ? 'border-destructive bg-destructive/10 text-destructive'
                                    : 'border-input hover:bg-muted'"
                                @click="(values[field.code] as string) = 'Positive'"
                            >
                                Positive
                            </button>
                            <button
                                type="button"
                                class="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                                :class="values[field.code] === 'Negative'
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                                    : 'border-input hover:bg-muted'"
                                @click="(values[field.code] as string) = 'Negative'"
                            >
                                Negative
                            </button>
                            <button
                                type="button"
                                class="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                                :class="values[field.code] === 'Not Done'
                                    ? 'border-amber-600 bg-amber-50 text-amber-700'
                                    : 'border-input hover:bg-muted'"
                                @click="(values[field.code] as string) = 'Not Done'"
                            >
                                Not Done
                            </button>
                        </div>
                    </div>

                    <!-- Absent/Present toggle -->
                    <div v-else-if="field.type === 'not-done'" class="grid gap-1.5">
                        <Label>{{ field.label }}</Label>
                        <div class="flex gap-2">
                            <button
                                type="button"
                                class="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                                :class="values[field.code] === 'Absent'
                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                                    : 'border-input hover:bg-muted'"
                                @click="(values[field.code] as string) = 'Absent'"
                            >
                                Absent
                            </button>
                            <button
                                type="button"
                                class="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                                :class="values[field.code] === 'Present'
                                    ? 'border-destructive bg-destructive/10 text-destructive'
                                    : 'border-input hover:bg-muted'"
                                @click="(values[field.code] as string) = 'Present'"
                            >
                                Present
                            </button>
                            <button
                                type="button"
                                class="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                                :class="values[field.code] === 'Not Done'
                                    ? 'border-amber-600 bg-amber-50 text-amber-700'
                                    : 'border-input hover:bg-muted'"
                                @click="(values[field.code] as string) = 'Not Done'"
                            >
                                Not Done
                            </button>
                        </div>
                    </div>

                    <!-- Text input -->
                    <div v-else-if="field.type === 'text'" class="grid gap-1.5">
                        <Label :for="`result-field-${field.code}`">{{ field.label }}</Label>
                        <Input
                            :id="`result-field-${field.code}`"
                            v-model="(values[field.code] as string)"
                            :placeholder="field.placeholder ?? ''"
                        />
                    </div>

                    <!-- Number input -->
                    <div v-else-if="field.type === 'number'" class="grid gap-1.5">
                        <Label :for="`result-field-${field.code}`">{{ field.label }}</Label>
                        <Input
                            :id="`result-field-${field.code}`"
                            v-model="(values[field.code] as string)"
                            type="number"
                            :placeholder="field.placeholder ?? ''"
                        />
                    </div>

                    <!-- Multi-select tags -->
                    <div v-else-if="field.type === 'multiselect'" class="grid gap-1.5">
                        <Label>{{ field.label }}</Label>
                        <div class="flex flex-wrap gap-1.5">
                            <Badge
                                v-for="option in field.options ?? []"
                                :key="`${field.code}-${option}`"
                                role="button"
                                tabindex="0"
                                variant="secondary"
                                :class="[
                                    'cursor-pointer text-[11px]',
                                    isMultiSelected(field.code, option)
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : '',
                                ]"
                                @click="toggleMultiSelect(field.code, option)"
                                @keydown.enter="toggleMultiSelect(field.code, option)"
                                @keydown.space.prevent="toggleMultiSelect(field.code, option)"
                            >
                                {{ option }}
                            </Badge>
                        </div>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>
