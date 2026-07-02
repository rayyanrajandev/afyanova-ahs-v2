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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type BillingPatientFocus = {
    label: string;
    number: string;
};

const props = defineProps<{
    queueScopeSummary: string;
    visibleCount: number;
    currentPage: number;
    lastPage: number;
    patientFiltered: boolean;
    activePatientFocus: BillingPatientFocus | null;
    queueStateLabel: string;
    filterBadgeCount: number;
    patientChartQueueReturnHref: string | null;
    isPatientChartQueueFocusApplied: boolean;
    openedFromPatientChart: boolean;
    patientChartQueueRoutePatientAvailable: boolean;
    searchQuery: string;
    statusValue: string;
    listLoading: boolean;
    activeAdvancedFilterCount: number;
    hasVisibleScopeBadges: boolean;
    queueLaneFilterLabel: string | null;
    queueThirdPartyPhaseFilterLabel: string | null;
    currencyCode: string;
    invoiceDateFilterActive: boolean;
    paymentActivityFilterActive: boolean;
    registerSearchInput?: (value: unknown) => void;
}>();

const emit = defineEmits<{
    (e: 'update:searchQuery', value: string): void;
    (e: 'update:statusValue', value: string): void;
    (e: 'submit-search'): void;
    (e: 'open-advanced-filters'): void;
    (e: 'set-results-per-page', value: number): void;
    (e: 'set-compact-rows', value: boolean): void;
    (e: 'reset-filters'): void;
    (e: 'open-full-queue'): void;
    (e: 'refocus-patient'): void;
}>();

function bindSearchInputRef(value: unknown) {
    props.registerSearchInput?.(value);
}
</script>

<template>
    <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <p class="text-[11px] text-muted-foreground">
                    {{ visibleCount }} on this page · Page {{ currentPage }} of {{ lastPage }}
                    <span v-if="patientFiltered"> · Patient filtered</span>
                </p>
                <div
                    v-if="activePatientFocus"
                    class="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs"
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
            </div>
            <Badge variant="secondary" class="w-fit shrink-0 font-normal">
                {{ queueStateLabel }}
            </Badge>
        </div>

        <div class="flex w-full flex-col gap-2">
            <div class="flex w-full flex-col gap-2 lg:flex-row lg:items-center">
                <SearchInput
                    :ref="bindSearchInputRef"
                    id="bil-q"
                    :model-value="searchQuery"
                    placeholder="Invoice #, patient, payer reference, notes"
                    class="min-w-0 flex-1"
                    @update:model-value="emit('update:searchQuery', String($event ?? ''))"
                    @keyup.enter="emit('submit-search')"
                />
                <div class="flex flex-wrap items-center gap-2">
                    <Select
                        :model-value="statusValue"
                        @update:model-value="emit('update:statusValue', String($event ?? 'all'))"
                    >
                        <SelectTrigger class="h-9 w-full bg-background sm:w-[11rem]" size="sm">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="issued">Issued</SelectItem>
                            <SelectItem value="partially_paid">Partially paid</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="voided">Voided</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="sm"
                        class="h-9 gap-1.5"
                        @click="emit('open-advanced-filters')"
                    >
                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                        Filters
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
                            <Button variant="outline" size="sm" class="h-9 gap-1.5">
                                <AppIcon name="eye" class="size-3.5" />
                                View
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="w-48">
                            <DropdownMenuItem @click="emit('set-results-per-page', 10)">10 per page</DropdownMenuItem>
                            <DropdownMenuItem @click="emit('set-results-per-page', 25)">25 per page</DropdownMenuItem>
                            <DropdownMenuItem @click="emit('set-results-per-page', 50)">50 per page</DropdownMenuItem>
                            <DropdownMenuItem @click="emit('set-compact-rows', true)">Compact rows</DropdownMenuItem>
                            <DropdownMenuItem @click="emit('set-compact-rows', false)">Comfortable rows</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div
                v-if="hasVisibleScopeBadges || filterBadgeCount > 0"
                class="flex flex-wrap items-center gap-1.5"
            >
                <span class="text-[11px] text-muted-foreground">Active:</span>
                <Badge
                    v-if="queueLaneFilterLabel"
                    variant="outline"
                    class="text-[11px] font-normal"
                >
                    Lane: {{ queueLaneFilterLabel }}
                </Badge>
                <Badge
                    v-if="queueThirdPartyPhaseFilterLabel"
                    variant="outline"
                    class="text-[11px] font-normal"
                >
                    {{ queueThirdPartyPhaseFilterLabel }}
                </Badge>
                <Badge
                    v-if="patientFiltered"
                    variant="outline"
                    class="text-[11px] font-normal"
                >
                    Patient
                </Badge>
                <Badge
                    v-if="currencyCode.trim()"
                    variant="outline"
                    class="text-[11px] font-normal"
                >
                    {{ currencyCode.trim().toUpperCase() }}
                </Badge>
                <Badge
                    v-if="invoiceDateFilterActive"
                    variant="outline"
                    class="text-[11px] font-normal"
                >
                    Invoice dates
                </Badge>
                <Badge
                    v-if="paymentActivityFilterActive"
                    variant="outline"
                    class="text-[11px] font-normal"
                >
                    Payment activity
                </Badge>
                <button
                    type="button"
                    class="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                    :disabled="listLoading"
                    @click="emit('reset-filters')"
                >
                    Clear all
                </button>
            </div>
        </div>
    </div>
</template>
