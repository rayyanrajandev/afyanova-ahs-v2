<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { ChargeableItem } from '@/composables/chargeableItems/useChargeableItems';
import { useUpdateChargeableItem } from '@/composables/chargeableItems/useUpdateChargeableItem';
import { messageFromUnknown } from '@/lib/notify';

/**
 * Edits a chargeable item's identity fields (name, category, default unit)
 * via ChargeableItemController::update(). Status is changed via the row's
 * Activate/Deactivate button instead, not duplicated here.
 *
 * Catalog-linked items (lab/radiology/theatre/procedure/pharmacy) read
 * their name live from the linked clinical catalog item at display time
 * (ChargeableItemController::transform() -- $hasCatalogLink ? $catalog->name
 * : $item->name, no fallback for name specifically), so editing name here
 * would silently have no visible effect for those. Name is disabled for
 * linked items; category/unit stay editable since the transform only
 * prefers the catalog's value when the catalog itself has one set.
 */
const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
    item: ChargeableItem | null;
}>();

const emit = defineEmits<{
    updated: [item: ChargeableItem];
}>();

const update = useUpdateChargeableItem();
const submitError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});
const isCatalogLinked = computed(() => Boolean(props.item?.clinicalCatalogItemId));

const form = reactive({
    name: '',
    category: '',
    defaultUnit: '',
});

watch(open, (isOpen) => {
    if (!isOpen || !props.item) return;
    form.name = props.item.name;
    form.category = props.item.category ?? '';
    form.defaultUnit = props.item.defaultUnit ?? '';
    submitError.value = null;
    fieldErrors.value = {};
});

function fieldError(field: string): string | null {
    return fieldErrors.value[field]?.[0] ?? null;
}

const canSubmit = computed(() => Boolean(props.item) && form.name.trim() !== '' && !update.isPending.value);

async function submit(): Promise<void> {
    if (!props.item) return;

    submitError.value = null;
    fieldErrors.value = {};

    try {
        const updated = await update.mutateAsync({
            chargeableItemId: props.item.id,
            ...(isCatalogLinked.value ? {} : { name: form.name.trim() }),
            category: form.category.trim() || null,
            defaultUnit: form.defaultUnit.trim() || null,
        });
        emit('updated', updated);
        open.value = false;
    } catch (error) {
        const apiError = error as { payload?: { errors?: Record<string, string[]>; message?: string } };
        fieldErrors.value = apiError.payload?.errors ?? {};
        submitError.value = apiError.payload?.message ?? messageFromUnknown(error, 'Unable to update this chargeable item.');
    }
}
</script>

<template>
    <Sheet :open="open" @update:open="(value) => (open = value)">
        <SheetContent side="right" variant="form" size="2xl">
            <SheetHeader class="shrink-0 border-b bg-background/95 px-6 py-4 text-left backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <SheetTitle class="flex items-center gap-2">
                    <AppIcon name="pencil" class="size-5 text-muted-foreground" />
                    Edit chargeable item
                </SheetTitle>
                <SheetDescription>
                    <span v-if="item">{{ item.code }}</span>
                </SheetDescription>
            </SheetHeader>

            <ScrollArea class="min-h-0 flex-1">
                <div class="grid gap-4 px-6 py-4">
                    <Alert v-if="submitError" variant="destructive">
                        <AlertTitle>Unable to update this item</AlertTitle>
                        <AlertDescription>{{ submitError }}</AlertDescription>
                    </Alert>

                    <Alert v-if="isCatalogLinked">
                        <AlertTitle>Name comes from the clinical catalog</AlertTitle>
                        <AlertDescription>
                            This item is linked to a clinical catalog entry, so its name is always shown from there. Edit it on the Clinical Catalogs page instead.
                        </AlertDescription>
                    </Alert>

                    <fieldset class="grid gap-3 rounded-lg border p-3">
                        <legend class="px-2 text-sm font-medium text-muted-foreground">Item details</legend>
                        <div class="grid gap-1.5">
                            <Label for="chargeable-item-edit-name">Name</Label>
                            <Input id="chargeable-item-edit-name" v-model="form.name" :disabled="isCatalogLinked" />
                            <p v-if="fieldError('name')" class="text-xs text-destructive">{{ fieldError('name') }}</p>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div class="grid gap-1.5">
                                <Label for="chargeable-item-edit-category">Category <span class="text-muted-foreground">(optional)</span></Label>
                                <Input id="chargeable-item-edit-category" v-model="form.category" placeholder="e.g. General, Specialist" />
                                <p v-if="fieldError('category')" class="text-xs text-destructive">{{ fieldError('category') }}</p>
                            </div>
                            <div class="grid gap-1.5">
                                <Label for="chargeable-item-edit-unit">Default unit <span class="text-muted-foreground">(optional)</span></Label>
                                <Input id="chargeable-item-edit-unit" v-model="form.defaultUnit" placeholder="e.g. visit, day, test" />
                                <p v-if="fieldError('defaultUnit')" class="text-xs text-destructive">{{ fieldError('defaultUnit') }}</p>
                            </div>
                        </div>
                    </fieldset>
                </div>
            </ScrollArea>

            <SheetFooter class="shrink-0 border-t bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Button variant="outline" @click="open = false">Cancel</Button>
                <Button :disabled="!canSubmit" @click="submit">
                    {{ update.isPending.value ? 'Saving…' : 'Save changes' }}
                </Button>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
