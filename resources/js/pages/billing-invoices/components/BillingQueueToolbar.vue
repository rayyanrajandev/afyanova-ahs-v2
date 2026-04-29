<script setup lang="ts">
import { Link } from '@inertiajs/vue3';

import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input, SearchInput } from '@/components/ui/input';
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
    queueToolbarSummary: string;
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
    (e: 'open-mobile-filters'): void;
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
    <CardHeader class="shrink-0 gap-3 pb-3">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div class="min-w-0">
                <CardTitle class="flex items-center gap-2">
                    <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                    Billing Invoices
                </CardTitle>
                <CardDescription>
                    {{ queueScopeSummary }}
                    <span class="ml-1">
                        Showing {{ visibleCount }} on this page &middot; Page {{ currentPage }} of {{ lastPage }}
                    </span>
                    <span v-if="patientFiltered">&middot; Patient filtered</span>
                </CardDescription>
                <div
                    v-if="activePatientFocus"
                    class="mt-1 rounded-md border bg-muted/40 p-2 text-xs"
                >
                    <p class="font-medium">
                        Patient in focus:
                        {{ activePatientFocus.label }}
                    </p>
                    <p class="text-muted-foreground">
                        Patient number:
                        {{ activePatientFocus.number }}
                    </p>
                </div>
            </div>
            <div class="flex shrink-0 flex-col gap-2 lg:items-end">
                <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Badge variant="secondary">
                        {{ queueStateLabel }}
                    </Badge>
                    <Badge v-if="filterBadgeCount > 0" variant="outline">
                        {{ filterBadgeCount }} filters
                    </Badge>
                </div>
                <div
                    v-if="patientChartQueueReturnHref || patientChartQueueRoutePatientAvailable"
                    class="flex flex-wrap items-center gap-2 lg:justify-end"
                >
                    <Button
                        v-if="patientChartQueueReturnHref"
                        variant="outline"
                        size="sm"
                        as-child
                    >
                        <Link :href="patientChartQueueReturnHref">
                            Back to Patient Chart
                        </Link>
                    </Button>
                    <Button
                        v-if="isPatientChartQueueFocusApplied"
                        variant="outline"
                        size="sm"
                        @click="emit('open-full-queue')"
                    >
                        Open Full Queue
                    </Button>
                    <Button
                        v-else-if="openedFromPatientChart && patientChartQueueRoutePatientAvailable"
                        variant="outline"
                        size="sm"
                        @click="emit('refocus-patient')"
                    >
                        Refocus This Patient
                    </Button>
                </div>
            </div>
        </div>
        <div class="flex w-full flex-col gap-2">
            <div class="flex w-full flex-col gap-2 xl:flex-row xl:items-center">
                <SearchInput
                    :ref="bindSearchInputRef"
                    id="bil-q"
                    :model-value="searchQuery"
                    placeholder="Search invoice number, patient, notes, or payer reference"
                    class="min-w-0 flex-1"
                    @update:model-value="emit('update:searchQuery', String($event ?? ''))"
                    @keyup.enter="emit('submit-search')"
                />
                <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap">
                    <Select
                        :model-value="statusValue"
                        @update:model-value="emit('update:statusValue', String($event ?? 'all'))"
                    >
                        <SelectTrigger class="h-9 w-full bg-background sm:w-[11rem]" size="sm">
                            <SelectValue placeholder="Queue status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="issued">Issued</SelectItem>
                            <SelectItem value="partially_paid">Partially Paid</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="voided">Voided</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        size="sm"
                        class="hidden h-9 gap-1.5 md:inline-flex"
                        @click="emit('open-advanced-filters')"
                    >
                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                        Work filters
                        <Badge
                            v-if="activeAdvancedFilterCount"
                            variant="secondary"
                            class="ml-1 text-[10px]"
                        >
                            {{ activeAdvancedFilterCount }}
                        </Badge>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        class="h-9 gap-1.5 md:hidden"
                        @click="emit('open-mobile-filters')"
                    >
                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                        Work filters
                        <Badge
                            v-if="activeAdvancedFilterCount"
                            variant="secondary"
                            class="ml-1 text-[10px]"
                        >
                            {{ activeAdvancedFilterCount }}
                        </Badge>
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                            <Button variant="outline" size="sm" class="h-9 gap-1.5">
                                <AppIcon name="eye" class="size-3.5" />
                                Queue setup
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" class="w-48">
                            <DropdownMenuItem @click="emit('set-results-per-page', 10)">
                                10 rows per page
                            </DropdownMenuItem>
                            <DropdownMenuItem @click="emit('set-results-per-page', 25)">
                                25 rows per page
                            </DropdownMenuItem>
                            <DropdownMenuItem @click="emit('set-results-per-page', 50)">
                                50 rows per page
                            </DropdownMenuItem>
                            <DropdownMenuItem @click="emit('set-compact-rows', false)">
                                Comfortable layout
                            </DropdownMenuItem>
                            <DropdownMenuItem @click="emit('set-compact-rows', true)">
                                Compact layout
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div class="rounded-md border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                Current queue setup: {{ queueToolbarSummary }}
            </div>
            <div v-if="hasVisibleScopeBadges" class="flex flex-wrap items-center gap-1.5 pt-1">
                <Badge
                    v-if="queueLaneFilterLabel"
                    variant="outline"
                    class="h-6 rounded-full px-2.5 text-[10px] font-medium"
                >
                    Lane: {{ queueLaneFilterLabel }}
                </Badge>
                <Badge
                    v-if="queueThirdPartyPhaseFilterLabel"
                    variant="outline"
                    class="h-6 rounded-full px-2.5 text-[10px] font-medium"
                >
                    Workstream: {{ queueThirdPartyPhaseFilterLabel }}
                </Badge>
                <Badge
                    v-if="patientFiltered"
                    variant="outline"
                    class="h-6 rounded-full px-2.5 text-[10px] font-medium"
                >
                    Patient filtered
                </Badge>
                <Badge
                    v-if="currencyCode.trim()"
                    variant="outline"
                    class="h-6 rounded-full px-2.5 text-[10px] font-medium"
                >
                    Currency: {{ currencyCode.trim().toUpperCase() }}
                </Badge>
                <Badge
                    v-if="invoiceDateFilterActive"
                    variant="outline"
                    class="h-6 rounded-full px-2.5 text-[10px] font-medium"
                >
                    Invoice date active
                </Badge>
                <Badge
                    v-if="paymentActivityFilterActive"
                    variant="outline"
                    class="h-6 rounded-full px-2.5 text-[10px] font-medium"
                >
                    Payment activity active
                </Badge>
                <Button
                    variant="ghost"
                    size="sm"
                    class="h-6 px-2 text-[11px]"
                    :disabled="listLoading"
                    @click="emit('reset-filters')"
                >
                    Reset
                </Button>
            </div>
        </div>
    </CardHeader>
</template>
