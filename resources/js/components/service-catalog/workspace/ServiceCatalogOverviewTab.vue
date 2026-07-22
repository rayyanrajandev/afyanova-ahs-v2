<script setup lang="ts">
import { computed, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import ServiceCatalogEditIdentitySheet from '@/components/service-catalog/workspace/ServiceCatalogEditIdentitySheet.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { CatalogItem } from '@/lib/billingServiceCatalog';
import { formatEnumLabel } from '@/lib/labels';

const props = defineProps<{
    item: CatalogItem;
    canManage: boolean;
}>();

const emit = defineEmits<{
    updated: [item: CatalogItem];
    openNewVersion: [];
}>();

const identityLocked = computed(() => Boolean(props.item.clinicalCatalogItemId));

const standardsCodes = computed(() => {
    const codes = props.item.codes ?? {};
    return [
        { label: 'Local code', value: codes.LOCAL },
        { label: 'NHIF code', value: codes.NHIF },
        { label: 'MSD code', value: codes.MSD },
        { label: 'LOINC', value: codes.LOINC },
        { label: 'SNOMED CT', value: codes.SNOMED_CT },
        { label: 'CPT', value: codes.CPT },
        { label: 'ICD', value: codes.ICD },
    ].filter((entry) => Boolean(entry.value?.trim()));
});

const editSheetOpen = ref(false);

function onUpdated(item: CatalogItem): void {
    emit('updated', item);
}
</script>

<template>
    <div class="space-y-4">
        <Alert v-if="identityLocked">
            <AlertTitle>Synced from Clinical Catalog</AlertTitle>
            <AlertDescription>Identity fields are managed by the linked clinical definition and cannot be edited here. Update the source in Clinical Catalog instead.</AlertDescription>
        </Alert>

        <Alert v-if="!identityLocked && (item.linkWarning || (item.standardsWarnings?.length ?? 0) > 0)">
            <AlertTitle>Governance review</AlertTitle>
            <AlertDescription class="space-y-1">
                <p v-if="item.linkWarning">{{ item.linkWarning }}</p>
                <p v-for="warning in item.standardsWarnings ?? []" :key="warning">{{ warning }}</p>
            </AlertDescription>
        </Alert>

        <div class="rounded-lg border p-3">
            <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p class="text-sm font-medium">Service identity</p>
                    <p class="text-xs text-muted-foreground">Stable code, name, and classification for downstream billing and clinical mappings.</p>
                </div>
                <Button v-if="canManage && !identityLocked" size="sm" class="gap-1.5" @click="editSheetOpen = true">
                    <AppIcon name="pencil" class="size-3.5" />
                    Edit details
                </Button>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Service code</p>
                    <p class="mt-1 truncate text-sm font-semibold">{{ item.serviceCode || 'Not set' }}</p>
                </div>
                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Service name</p>
                    <p class="mt-1 truncate text-sm font-semibold">{{ item.serviceName || 'Not set' }}</p>
                </div>
                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Service type</p>
                    <p class="mt-1 truncate text-sm font-semibold">{{ item.serviceType ? formatEnumLabel(item.serviceType) : 'Not set' }}</p>
                </div>
                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Department</p>
                    <p class="mt-1 truncate text-sm font-semibold">{{ item.department || 'Not set' }}</p>
                </div>
                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Billing unit</p>
                    <p class="mt-1 truncate text-sm font-semibold">{{ item.unit ? formatEnumLabel(item.unit) : 'Not set' }}</p>
                </div>
                <div class="rounded-lg border bg-muted/10 px-3 py-2.5">
                    <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Minimum facility tier</p>
                    <p class="mt-1 truncate text-sm font-semibold">{{ item.facilityTier ? formatEnumLabel(item.facilityTier) : 'All tiers' }}</p>
                </div>
            </div>

            <div v-if="standardsCodes.length" class="mt-3 rounded-lg border bg-muted/10 p-3">
                <p class="mb-2 text-xs font-medium text-muted-foreground">Billing standards</p>
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div v-for="code in standardsCodes" :key="code.label">
                        <p class="text-[11px] text-muted-foreground">{{ code.label }}</p>
                        <p class="text-sm font-medium">{{ code.value }}</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="flex justify-end">
            <Button size="sm" variant="outline" class="gap-1.5" @click="emit('openNewVersion')">
                <AppIcon name="layers" class="size-3.5" />
                Open new version
            </Button>
        </div>

        <ServiceCatalogEditIdentitySheet v-model:open="editSheetOpen" :item="item" @updated="onUpdated" />
    </div>
</template>
