<script setup lang="ts">
import { Link } from '@inertiajs/vue3';

import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SearchInput } from '@/components/ui/input';

type BillingPatientFocus = {
    label: string;
    number: string;
};

const props = defineProps<{
    visibleCount: number;
    currentPage: number;
    lastPage: number;
    patientFiltered: boolean;
    activePatientFocus: BillingPatientFocus | null;
    queueStateLabel: string;
    patientChartQueueReturnHref: string | null;
    isPatientChartQueueFocusApplied: boolean;
    openedFromPatientChart: boolean;
    patientChartQueueRoutePatientAvailable: boolean;
    searchQuery: string;
    listLoading: boolean;
    activeAdvancedFilterCount: number;
    registerSearchInput?: (value: unknown) => void;
}>();

const emit = defineEmits<{
    (e: 'update:searchQuery', value: string): void;
    (e: 'submit-search'): void;
    (e: 'open-advanced-filters'): void;
    (e: 'set-results-per-page', value: number): void;
    (e: 'set-compact-rows', value: boolean): void;
    (e: 'open-full-queue'): void;
    (e: 'refocus-patient'): void;
}>();

function bindSearchInputRef(value: unknown) {
    props.registerSearchInput?.(value);
}
</script>

<template>
    <div class="flex flex-col gap-3 border-b px-4 py-3">
        <div
            v-if="activePatientFocus"
            class="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs"
        >
            <div>
                <p class="font-medium text-foreground">{{ activePatientFocus.label }}</p>
                <p class="text-muted-foreground">MRN {{ activePatientFocus.number }}</p>
            </div>
            <div class="flex flex-wrap gap-1.5">
                <Button
                    v-if="patientChartQueueReturnHref"
                    variant="outline"
                    size="sm"
                    class="h-7 text-xs"
                    as-child
                >
                    <Link :href="patientChartQueueReturnHref">Patient chart</Link>
                </Button>
                <Button
                    v-if="isPatientChartQueueFocusApplied"
                    variant="ghost"
                    size="sm"
                    class="h-7 text-xs"
                    @click="emit('open-full-queue')"
                >
                    Full queue
                </Button>
                <Button
                    v-else-if="openedFromPatientChart && patientChartQueueRoutePatientAvailable"
                    variant="ghost"
                    size="sm"
                    class="h-7 text-xs"
                    @click="emit('refocus-patient')"
                >
                    Refocus patient
                </Button>
            </div>
        </div>

        <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <div class="relative min-w-0 flex-1">
                <SearchInput
                    :ref="bindSearchInputRef"
                    id="bil-q"
                    :model-value="searchQuery"
                    placeholder="Search invoices, patients, payer references, notes"
                    class="min-w-0 flex-1"
                    aria-label="Search billing invoices"
                    @update:model-value="emit('update:searchQuery', String($event ?? ''))"
                    @keyup.enter="emit('submit-search')"
                />
            </div>
            <div class="flex shrink-0 items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    class="h-9 gap-1.5"
                    :aria-label="activeAdvancedFilterCount > 0 ? `Open filters, ${activeAdvancedFilterCount} active` : 'Open filters'"
                    @click="emit('open-advanced-filters')"
                >
                    <AppIcon name="sliders-horizontal" class="size-3.5" />
                    <span class="hidden sm:inline">Filters</span>
                    <Badge
                        v-if="activeAdvancedFilterCount"
                        variant="secondary"
                        class="ml-0.5 text-[10px]"
                    >
                        {{ activeAdvancedFilterCount }}
                    </Badge>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                        <Button variant="outline" size="sm" class="h-9 gap-1.5" aria-label="View options">
                            <AppIcon name="eye" class="size-3.5" />
                            <span class="hidden sm:inline">View</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-48">
                        <DropdownMenuItem @click="emit('set-results-per-page', 10)">10 per page</DropdownMenuItem>
                        <DropdownMenuItem @click="emit('set-results-per-page', 25)">25 per page</DropdownMenuItem>
                        <DropdownMenuItem @click="emit('set-results-per-page', 50)">50 per page</DropdownMenuItem>
                        <div role="separator" class="my-1 h-px bg-border" />
                        <DropdownMenuItem @click="emit('set-compact-rows', true)">Compact rows</DropdownMenuItem>
                        <DropdownMenuItem @click="emit('set-compact-rows', false)">Comfortable rows</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    </div>
</template>
