<script setup lang="ts">
import { ref } from 'vue';
import { Input } from '@/components/ui/input';
import { usePatientQuickSearch, type PatientQuickSearchResult } from '@/composables/patients/usePatientQuickSearch';

/**
 * A lean, single-row patient search — NOT a replacement for
 * PatientLookupField.vue (recent patients, advanced search dialog,
 * access-denied handling, full selected-patient summary card), which
 * stays the right choice for a dedicated form field across the 24+ pages
 * that already use it. This is for compact, dense-row UIs like
 * reception/Queue.vue's "Start a visit" row, and any future page that
 * needs the same small footprint. Built on usePatientQuickSearch.ts so the
 * fetch/debounce logic isn't duplicated a third time.
 *
 * `query` is a v-model so a parent can clear/seed it externally (e.g.
 * resetting the row after a successful check-in). The "no match" slot lets
 * each consumer plug in its own registration CTA (permission-gated,
 * sheet-or-navigate) without this component needing to know about it.
 *
 * Search is triggered from the native `input` DOM event, not a
 * `watch(query, ...)` on the v-model ref — a watcher fires for ANY change
 * to `query`, including the one `select()` itself makes when it writes the
 * chosen patient's name into the field, so it can't tell "the user typed
 * something new" apart from "a selection just set this." An earlier
 * version used a watcher and had exactly that bug: selecting a result set
 * `hasSelection = true` then immediately wrote to `query`, which the
 * watcher saw as a query change and reset `hasSelection` back to `false`
 * (re-emitting `selected: null`) — the selection only visibly "stuck" on a
 * second click, because that second write left `query` unchanged, so the
 * watcher's `value === previousValue` guard skipped it. The native `input`
 * event only fires on genuine user keystrokes/paste, never on a
 * programmatic `.value =` assignment, so it doesn't have this problem.
 */
const props = withDefaults(
    defineProps<{
        inputId: string;
        placeholder?: string;
        perPage?: number;
        inputClass?: string;
    }>(),
    {
        placeholder: 'Search patient by name, MRN, or phone…',
        perPage: 5,
        inputClass: '',
    },
);

const emit = defineEmits<{
    selected: [patient: PatientQuickSearchResult | null];
}>();

const query = defineModel<string>('query', { default: '' });

const { results, isPending, search, clear, displayName } = usePatientQuickSearch({ perPage: props.perPage });
const hasSelection = ref(false);

function onUserInput(): void {
    if (hasSelection.value) {
        hasSelection.value = false;
        emit('selected', null);
    }
    void search(query.value);
}

function select(patient: PatientQuickSearchResult): void {
    hasSelection.value = true;
    query.value = displayName(patient);
    clear();
    emit('selected', patient);
}

function reset(): void {
    query.value = '';
    hasSelection.value = false;
    clear();
}

/**
 * For callers that resolve a patient outside this component's own search
 * results (e.g. reception/Queue.vue's "register a new patient" sheet) —
 * sets the display text and selected state without emitting `selected`
 * (the caller already knows the patient; that would be a redundant echo).
 */
function selectExternally(patient: PatientQuickSearchResult): void {
    hasSelection.value = true;
    query.value = displayName(patient);
    clear();
}

defineExpose({ reset, selectExternally });
</script>

<template>
    <div class="relative">
        <Input :id="inputId" v-model="query" :placeholder="placeholder" :class="['h-9', inputClass]" @input="onUserInput" />

        <ul v-if="results.length > 0" class="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
            <li
                v-for="patient in results"
                :key="patient.id"
                class="cursor-pointer px-3 py-2 text-sm hover:bg-muted"
                @click="select(patient)"
            >
                {{ displayName(patient) }}
                <span v-if="patient.patientNumber" class="text-xs text-muted-foreground">
                    · {{ patient.patientNumber }}
                </span>
            </li>
        </ul>

        <p
            v-else-if="!isPending && query.trim().length >= 2 && !hasSelection"
            class="absolute z-10 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md"
        >
            No matching patient.
            <slot name="no-match-action" />
        </p>
    </div>
</template>
