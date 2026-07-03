<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

defineProps<{
    filterCount?: number;
    statusValue: string;
    sortBy: string;
    sortDir: string;
    perPage: number;
    compactRows: boolean;
}>();

const emit = defineEmits<{
    'update:statusValue': [value: string];
    'update:sortBy': [value: string];
    'update:sortDir': [value: string];
    'update:perPage': [value: number];
    'update:compactRows': [value: boolean];
    apply: [];
    reset: [];
    'open-date-filters': [];
}>();

const open = ref(false);
</script>

<template>
    <Popover v-model:open="open">
        <PopoverTrigger as-child>
            <Button
                variant="outline"
                size="sm"
                class="h-8 gap-1.5 rounded-lg text-xs shrink-0"
                :aria-label="filterCount && filterCount > 0 ? `Filters, ${filterCount} active` : 'Filters'"
            >
                <AppIcon name="sliders-horizontal" class="size-3.5" />
                Filters
                <Badge
                    v-if="(filterCount ?? 0) > 0"
                    variant="secondary"
                    class="ml-1 h-5 px-1.5 text-[10px]"
                >
                    {{ filterCount }}
                </Badge>
            </Button>
        </PopoverTrigger>
        <PopoverContent align="end" class="z-50 w-72 p-3">
            <div class="space-y-3">
                <div class="space-y-1">
                    <Label class="text-xs">Status</Label>
                    <Select :model-value="statusValue" @update:model-value="emit('update:statusValue', String($event ?? 'all'))">
                        <SelectTrigger class="h-8 w-full text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
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
                </div>

                <div class="space-y-1">
                    <Label class="text-xs">Sort by</Label>
                    <div class="flex gap-1.5">
                        <Select :model-value="sortBy" @update:model-value="emit('update:sortBy', String($event ?? 'invoiceDate'))">
                            <SelectTrigger class="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="invoiceDate">Invoice date</SelectItem>
                                <SelectItem value="createdAt">Created</SelectItem>
                                <SelectItem value="updatedAt">Updated</SelectItem>
                                <SelectItem value="totalAmount">Amount</SelectItem>
                                <SelectItem value="status">Status</SelectItem>
                                <SelectItem value="invoiceNumber">Invoice #</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select :model-value="sortDir" @update:model-value="emit('update:sortDir', String($event ?? 'desc'))">
                            <SelectTrigger class="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="desc">Desc</SelectItem>
                                <SelectItem value="asc">Asc</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <div class="space-y-1">
                        <Label class="text-xs">Per page</Label>
                        <Select :model-value="String(perPage)" @update:model-value="emit('update:perPage', Number($event))">
                            <SelectTrigger class="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div class="space-y-1">
                        <Label class="text-xs">Density</Label>
                        <Select :model-value="compactRows ? 'compact' : 'comfortable'" @update:model-value="emit('update:compactRows', $event === 'compact')">
                            <SelectTrigger class="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="compact">Compact</SelectItem>
                                <SelectItem value="comfortable">Comfortable</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="w-full justify-start gap-1.5 text-xs text-muted-foreground"
                    @click="emit('open-date-filters')"
                >
                    <AppIcon name="calendar" class="size-3.5" />
                    Date &amp; scope filters
                </Button>

                <div class="flex items-center gap-2 pt-1">
                    <Button size="sm" variant="ghost" class="flex-1 gap-1.5 text-xs" @click="emit('reset')">Reset</Button>
                    <Button size="sm" class="flex-1 gap-1.5 text-xs" @click="emit('apply'); open = false">
                        Apply
                    </Button>
                </div>
            </div>
        </PopoverContent>
    </Popover>
</template>
