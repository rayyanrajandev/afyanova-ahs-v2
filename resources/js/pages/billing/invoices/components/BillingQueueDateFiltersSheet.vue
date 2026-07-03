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

defineProps<{
    open: boolean;
    isMobile: boolean;
    patientId: string;
    currencyCode: string;
    defaultCurrencyCode: string;
    invoiceDateFrom: string;
    invoiceDateTo: string;
    paymentActivityFrom: string;
    paymentActivityTo: string;
    patientChartQueueFocusLocked: boolean;
}>();

defineEmits<{
    'update:open': [value: boolean];
    'update:patientId': [value: string];
    'update:currencyCode': [value: string];
    'update:invoiceDateFrom': [value: string];
    'update:invoiceDateTo': [value: string];
    'update:paymentActivityFrom': [value: string];
    'update:paymentActivityTo': [value: string];
    apply: [];
    reset: [];
}>();
</script>

<template>
    <Sheet v-if="!isMobile" :open="open" @update:open="$emit('update:open', $event)">
        <SheetContent side="right" size="sm">
            <SheetHeader>
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="calendar" class="size-4 text-muted-foreground" />
                    Date &amp; scope filters
                </SheetTitle>
                <SheetDescription>
                    Narrow results by patient, currency, and date ranges.
                </SheetDescription>
            </SheetHeader>
            <div class="space-y-5 py-4">
                <div class="space-y-3">
                    <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Scope</p>
                    <div class="space-y-2">
                        <Label class="text-xs">Patient</Label>
                        <PatientLookupField
                            input-id="bil-filter-patient-sheet"
                            :model-value="patientId"
                            label=""
                            mode="filter"
                            placeholder="Patient name or number"
                            :helper-text="patientChartQueueFocusLocked ? 'Locked from patient chart' : 'Optional exact patient filter'"
                            :disabled="patientChartQueueFocusLocked"
                            @update:model-value="$emit('update:patientId', $event)"
                        />
                    </div>
                    <div class="space-y-2">
                        <Label class="text-xs">Currency</Label>
                        <Input
                            id="bil-currency-sheet"
                            :model-value="currencyCode"
                            maxlength="3"
                            class="h-8 text-xs"
                            :placeholder="defaultCurrencyCode"
                            @update:model-value="$emit('update:currencyCode', String($event ?? ''))"
                        />
                    </div>
                </div>

                <div class="space-y-3">
                    <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoice date</p>
                    <DateRangeFilterPopover
                        input-base-id="bil-invoice-date-sheet"
                        title=""
                        from-label="From"
                        to-label="To"
                        inline
                        :number-of-months="1"
                        :from="invoiceDateFrom"
                        :to="invoiceDateTo"
                        @update:from="$emit('update:invoiceDateFrom', $event)"
                        @update:to="$emit('update:invoiceDateTo', $event)"
                    />
                </div>

                <div class="space-y-3">
                    <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment activity</p>
                    <DateRangeFilterPopover
                        input-base-id="bil-payment-activity-sheet"
                        title=""
                        from-label="Paid From"
                        to-label="Paid To"
                        inline
                        :number-of-months="1"
                        :from="paymentActivityFrom"
                        :to="paymentActivityTo"
                        @update:from="$emit('update:paymentActivityFrom', $event)"
                        @update:to="$emit('update:paymentActivityTo', $event)"
                    />
                </div>
            </div>
            <SheetFooter class="gap-2">
                <Button variant="outline" size="sm" @click="$emit('reset')">Reset</Button>
                <Button size="sm" @click="$emit('apply'); $emit('update:open', false)">Apply filters</Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>

    <Drawer v-else :open="open" @update:open="$emit('update:open', $event)">
        <DrawerContent class="max-h-[90vh]">
            <DrawerHeader>
                <DrawerTitle class="flex items-center gap-2">
                    <AppIcon name="calendar" class="size-4 text-muted-foreground" />
                    Date &amp; scope filters
                </DrawerTitle>
                <DrawerDescription>
                    Narrow results by patient, currency, and date ranges.
                </DrawerDescription>
            </DrawerHeader>
            <div class="space-y-5 overflow-y-auto px-4 pb-2">
                <div class="space-y-3">
                    <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Scope</p>
                    <div class="space-y-2">
                        <Label class="text-xs">Patient</Label>
                        <PatientLookupField
                            input-id="bil-filter-patient-drawer"
                            :model-value="patientId"
                            label=""
                            mode="filter"
                            placeholder="Patient name or number"
                            :helper-text="patientChartQueueFocusLocked ? 'Locked from patient chart' : 'Optional exact patient filter'"
                            :disabled="patientChartQueueFocusLocked"
                            @update:model-value="$emit('update:patientId', $event)"
                        />
                    </div>
                    <div class="space-y-2">
                        <Label class="text-xs">Currency</Label>
                        <Input
                            id="bil-currency-drawer"
                            :model-value="currencyCode"
                            maxlength="3"
                            class="h-8 text-xs"
                            :placeholder="defaultCurrencyCode"
                            @update:model-value="$emit('update:currencyCode', String($event ?? ''))"
                        />
                    </div>
                </div>

                <div class="space-y-3">
                    <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Invoice date</p>
                    <DateRangeFilterPopover
                        input-base-id="bil-invoice-date-drawer"
                        title=""
                        from-label="From"
                        to-label="To"
                        inline
                        :number-of-months="1"
                        :from="invoiceDateFrom"
                        :to="invoiceDateTo"
                        @update:from="$emit('update:invoiceDateFrom', $event)"
                        @update:to="$emit('update:invoiceDateTo', $event)"
                    />
                </div>

                <div class="space-y-3">
                    <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment activity</p>
                    <DateRangeFilterPopover
                        input-base-id="bil-payment-activity-drawer"
                        title=""
                        from-label="Paid From"
                        to-label="Paid To"
                        inline
                        :number-of-months="1"
                        :from="paymentActivityFrom"
                        :to="paymentActivityTo"
                        @update:from="$emit('update:paymentActivityFrom', $event)"
                        @update:to="$emit('update:paymentActivityTo', $event)"
                    />
                </div>
            </div>
            <DrawerFooter class="gap-2">
                <Button @click="$emit('apply'); $emit('update:open', false)">Apply filters</Button>
                <Button variant="outline" @click="$emit('reset')">Reset</Button>
            </DrawerFooter>
        </DrawerContent>
    </Drawer>
</template>
