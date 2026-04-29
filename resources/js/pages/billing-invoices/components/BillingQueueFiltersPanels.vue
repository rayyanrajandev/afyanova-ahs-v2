<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';

const props = defineProps({
    state: { type: Object, required: true },
    view: { type: Object, required: true },
    actions: { type: Object, required: true },
});

const state = props.state as Record<string, any>;
const view = props.view as Record<string, any>;
const actions = props.actions as Record<string, any>;

const searchForm = state.searchForm;

const canReadBillingInvoices = view.canReadBillingInvoices;
const billingWorkspaceView = view.billingWorkspaceView;
const patientChartQueueFocusLocked = view.patientChartQueueFocusLocked;
const defaultBillingCurrencyCode = view.defaultBillingCurrencyCode;
const billingQueueFilterSummary = view.billingQueueFilterSummary;
const listLoading = view.listLoading;
const hasAdvancedFilters = view.hasAdvancedFilters;

const resetFiltersFromFiltersSheet = actions.resetFiltersFromFiltersSheet;
const submitSearchFromFiltersSheet = actions.submitSearchFromFiltersSheet;
const submitSearchFromMobileDrawer = actions.submitSearchFromMobileDrawer;
const resetFiltersFromMobileDrawer = actions.resetFiltersFromMobileDrawer;
</script>

<template>
    <Sheet
        v-if="canReadBillingInvoices && billingWorkspaceView === 'queue'"
        :open="state.advancedFiltersSheetOpen"
        @update:open="state.advancedFiltersSheetOpen = $event"
    >
        <SheetContent side="right" variant="action" size="lg">
            <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon
                        name="sliders-horizontal"
                        class="size-4 text-muted-foreground"
                    />
                    Work filters
                </SheetTitle>
                <SheetDescription>
                    Narrow the billing board by patient, currency, and date
                    controls without losing the current workboard state.
                </SheetDescription>
            </SheetHeader>
            <div class="grid gap-3 px-6 py-4">
                <div class="rounded-lg border p-3">
                    <div class="mb-3">
                        <p class="text-sm font-medium">Scope</p>
                        <p class="text-xs text-muted-foreground">
                            Use these when the queue should stay inside one patient or
                            one billing currency.
                        </p>
                    </div>
                    <div class="grid gap-3">
                        <PatientLookupField
                            input-id="bil-filter-patient-id-sheet"
                            v-model="searchForm.patientId"
                            label="Patient filter"
                            mode="filter"
                            placeholder="Patient name or number"
                            :helper-text="
                                patientChartQueueFocusLocked
                                    ? 'Patient scope is locked from the patient chart. Use Open Full Queue to review other patients.'
                                    : 'Optional exact patient filter.'
                            "
                            :disabled="patientChartQueueFocusLocked"
                        />
                        <div class="grid gap-2">
                            <Label for="bil-currency-code-sheet">Currency Code</Label>
                            <Input
                                id="bil-currency-code-sheet"
                                v-model="searchForm.currencyCode"
                                maxlength="3"
                                :placeholder="defaultBillingCurrencyCode"
                            />
                        </div>
                    </div>
                </div>
                <div class="rounded-lg border p-3">
                    <div class="mb-3">
                        <p class="text-sm font-medium">Invoice date window</p>
                        <p class="text-xs text-muted-foreground">
                            Review invoices by posted billing date when checking queue
                            age or billing period.
                        </p>
                    </div>
                    <DateRangeFilterPopover
                        input-base-id="bil-invoice-date-range-sheet"
                        title="Invoice date range"
                        helper-text="From / to for invoice queue review."
                        from-label="From"
                        to-label="To"
                        inline
                        :number-of-months="1"
                        v-model:from="searchForm.from"
                        v-model:to="searchForm.to"
                    />
                </div>
                <div class="rounded-lg border p-3">
                    <div class="mb-3">
                        <p class="text-sm font-medium">
                            Cashier and settlement activity
                        </p>
                        <p class="text-xs text-muted-foreground">
                            Use this when reviewing collections, remittance posting,
                            or payment-ledger follow-up.
                        </p>
                    </div>
                    <DateRangeFilterPopover
                        input-base-id="bil-payment-activity-date-range-sheet"
                        title="Payment activity date"
                        helper-text="Use payment activity when reviewing collections and cashier follow-up."
                        from-label="Paid From"
                        to-label="Paid To"
                        inline
                        :number-of-months="1"
                        v-model:from="searchForm.paymentActivityFrom"
                        v-model:to="searchForm.paymentActivityTo"
                    />
                </div>
                <div
                    class="rounded-lg border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground"
                >
                    Current filter scope: {{ billingQueueFilterSummary }}
                </div>
            </div>
            <SheetFooter class="gap-2 px-6 pb-6">
                <Button variant="outline" @click="resetFiltersFromFiltersSheet">
                    Reset
                </Button>
                <Button
                    :disabled="listLoading"
                    @click="submitSearchFromFiltersSheet"
                >
                    Refresh queue
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <Drawer
        v-if="canReadBillingInvoices"
        :open="state.mobileFiltersDrawerOpen"
        @update:open="state.mobileFiltersDrawerOpen = $event"
    >
        <DrawerContent class="max-h-[90vh]">
            <DrawerHeader>
                <DrawerTitle class="flex items-center gap-2">
                    <AppIcon
                        name="sliders-horizontal"
                        class="size-4 text-muted-foreground"
                    />
                    Work filters
                </DrawerTitle>
                <DrawerDescription>
                    Narrow the billing board by patient, currency, and billing
                    date controls.
                </DrawerDescription>
            </DrawerHeader>

            <div class="space-y-4 overflow-y-auto px-4 pb-2">
                <div class="rounded-lg border p-3">
                    <div class="mb-3">
                        <p class="text-sm font-medium">Scope</p>
                        <p class="text-xs text-muted-foreground">
                            Use these when the queue should stay inside one patient or
                            one billing currency.
                        </p>
                    </div>
                    <div class="grid gap-3">
                        <PatientLookupField
                            input-id="bil-filter-patient-id-mobile"
                            v-model="searchForm.patientId"
                            label="Patient filter"
                            placeholder="Search patient by name or patient number"
                            mode="filter"
                            :helper-text="
                                patientChartQueueFocusLocked
                                    ? 'Patient scope is locked from the patient chart. Use Open Full Queue to review other patients.'
                                    : 'Optional exact patient filter.'
                            "
                            :disabled="patientChartQueueFocusLocked"
                        />
                        <div class="grid gap-2">
                            <Label for="bil-currency-code-mobile">
                                Currency Code
                            </Label>
                            <Input
                                id="bil-currency-code-mobile"
                                v-model="searchForm.currencyCode"
                                maxlength="3"
                                :placeholder="defaultBillingCurrencyCode"
                            />
                        </div>
                    </div>
                </div>

                <div class="rounded-lg border p-3">
                    <div class="mb-3">
                        <p class="text-sm font-medium">Invoice date window</p>
                        <p class="text-xs text-muted-foreground">
                            Review invoices by posted billing date when checking queue
                            age or billing period.
                        </p>
                    </div>
                    <DateRangeFilterPopover
                        input-base-id="bil-invoice-date-range-mobile"
                        title="Invoice date range"
                        helper-text="From / to for invoice queue review."
                        from-label="From"
                        to-label="To"
                        inline
                        :number-of-months="1"
                        v-model:from="searchForm.from"
                        v-model:to="searchForm.to"
                    />
                </div>

                <div class="rounded-lg border p-3">
                    <div class="mb-3">
                        <p class="text-sm font-medium">
                            Cashier and settlement activity
                        </p>
                        <p class="text-xs text-muted-foreground">
                            Use this when reviewing collections, remittance posting,
                            or payment-ledger follow-up.
                        </p>
                    </div>
                    <DateRangeFilterPopover
                        input-base-id="bil-payment-activity-date-range-mobile"
                        title="Payment activity date"
                        helper-text="Use payment activity when reviewing collections and cashier follow-up."
                        from-label="Paid From"
                        to-label="Paid To"
                        inline
                        :number-of-months="1"
                        v-model:from="searchForm.paymentActivityFrom"
                        v-model:to="searchForm.paymentActivityTo"
                    />
                </div>
                <div
                    class="rounded-lg border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground"
                >
                    Current filter scope: {{ billingQueueFilterSummary }}
                </div>
            </div>

            <DrawerFooter class="gap-2">
                <Button
                    :disabled="listLoading"
                    @click="submitSearchFromMobileDrawer"
                >
                    Refresh queue
                </Button>
                <Button
                    variant="outline"
                    :disabled="listLoading && !hasAdvancedFilters"
                    @click="resetFiltersFromMobileDrawer"
                >
                    Reset
                </Button>
            </DrawerFooter>
        </DrawerContent>
    </Drawer>
</template>
