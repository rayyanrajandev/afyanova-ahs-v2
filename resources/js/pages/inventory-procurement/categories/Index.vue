<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, onMounted, reactive, ref } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import { apiRequestJson } from '@/lib/apiClient';
import { INVENTORY_PROCUREMENT_HOME_PATH } from '@/lib/inventoryProcurement';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type Subcategory = {
    id: string;
    categoryId: string;
    code: string;
    label: string;
    isActive: boolean;
    sortOrder: number;
};

type Category = {
    id: string;
    code: string;
    label: string;
    description: string | null;
    formTemplate: string | null;
    requiresExpiryTracking: boolean;
    requiresColdChain: boolean;
    controlledSubstanceEligible: boolean;
    supportsMedicineDetails: boolean;
    supportsStorageFields: boolean;
    supportsClinicalClassification: boolean;
    isActive: boolean;
    sortOrder: number;
    subcategories: Subcategory[];
};

type ListResponse<T> = { data: T[] };
type ItemResponse<T> = { data: T };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Supply chain', href: '/inventory-procurement' },
    { title: 'Categories', href: '/inventory-procurement/categories' },
];

const { permissionNames: sharedPermissionNames, permissionState } = usePlatformAccess();
const permissionsResolved = computed(() => sharedPermissionNames.value !== null);
const canRead = computed(() => permissionState('inventory.procurement.read') === 'allowed');
const canManage = computed(() => permissionState('inventory.procurement.manage-items') === 'allowed');

const loading = ref(true);
const listLoading = ref(false);
const errors = ref<string[]>([]);
const categories = ref<Category[]>([]);

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: { body?: Record<string, unknown> },
): Promise<T> {
    return apiRequestJson<T>(method, path, options);
}

async function loadCategories() {
    if (!canRead.value) {
        categories.value = [];
        loading.value = false;
        listLoading.value = false;
        return;
    }
    listLoading.value = true;
    errors.value = [];
    try {
        const response = await apiRequest<ListResponse<Category>>('GET', '/inventory-procurement/categories');
        categories.value = response.data ?? [];
    } catch (error) {
        categories.value = [];
        errors.value.push(messageFromUnknown(error, 'Unable to load categories.'));
    } finally {
        loading.value = false;
        listLoading.value = false;
    }
}

const behaviorFlags = (category: Category): { label: string; on: boolean }[] => [
    { label: 'Expiry tracking', on: category.requiresExpiryTracking },
    { label: 'Cold chain', on: category.requiresColdChain },
    { label: 'Controlled substance', on: category.controlledSubstanceEligible },
    { label: 'Medicine details', on: category.supportsMedicineDetails },
    { label: 'Storage fields', on: category.supportsStorageFields },
    { label: 'Clinical classification', on: category.supportsClinicalClassification },
];

// ─── Category edit ───────────────────────────────────────
const editCategoryOpen = ref(false);
const editCategoryLoading = ref(false);
const editCategoryTarget = ref<Category | null>(null);
const editCategoryForm = reactive({ label: '', description: '', isActive: true, sortOrder: 0 });

function openEditCategory(category: Category) {
    editCategoryTarget.value = category;
    Object.assign(editCategoryForm, {
        label: category.label,
        description: category.description ?? '',
        isActive: category.isActive,
        sortOrder: category.sortOrder,
    });
    editCategoryOpen.value = true;
}

async function saveEditCategory() {
    const id = editCategoryTarget.value?.id;
    if (!id || !canManage.value || editCategoryLoading.value) return;
    editCategoryLoading.value = true;
    try {
        await apiRequest<ItemResponse<Category>>('PATCH', `/inventory-procurement/categories/${id}`, {
            body: {
                label: editCategoryForm.label.trim(),
                description: editCategoryForm.description.trim() || null,
                isActive: editCategoryForm.isActive,
                sortOrder: editCategoryForm.sortOrder,
            },
        });
        notifySuccess('Category updated.');
        editCategoryOpen.value = false;
        await loadCategories();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to update category.'));
    } finally {
        editCategoryLoading.value = false;
    }
}

// ─── Subcategory create ───────────────────────────────────────
const createSubOpen = ref(false);
const createSubLoading = ref(false);
const createSubTarget = ref<Category | null>(null);
const createSubForm = reactive({ code: '', label: '' });

function openCreateSubcategory(category: Category) {
    createSubTarget.value = category;
    Object.assign(createSubForm, { code: '', label: '' });
    createSubOpen.value = true;
}

async function saveCreateSubcategory() {
    const categoryId = createSubTarget.value?.id;
    if (!categoryId || !canManage.value || createSubLoading.value) return;
    if (!createSubForm.code.trim() || !createSubForm.label.trim()) return;
    createSubLoading.value = true;
    try {
        await apiRequest<ItemResponse<Subcategory>>('POST', `/inventory-procurement/categories/${categoryId}/subcategories`, {
            body: { code: createSubForm.code.trim(), label: createSubForm.label.trim() },
        });
        notifySuccess('Subcategory created.');
        createSubOpen.value = false;
        await loadCategories();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to create subcategory.'));
    } finally {
        createSubLoading.value = false;
    }
}

// ─── Subcategory edit ───────────────────────────────────────
const editSubOpen = ref(false);
const editSubLoading = ref(false);
const editSubTarget = ref<Subcategory | null>(null);
const editSubForm = reactive({ label: '', isActive: true, sortOrder: 0 });

function openEditSubcategory(subcategory: Subcategory) {
    editSubTarget.value = subcategory;
    Object.assign(editSubForm, { label: subcategory.label, isActive: subcategory.isActive, sortOrder: subcategory.sortOrder });
    editSubOpen.value = true;
}

async function saveEditSubcategory() {
    const subcategory = editSubTarget.value;
    if (!subcategory || !canManage.value || editSubLoading.value) return;
    editSubLoading.value = true;
    try {
        await apiRequest<ItemResponse<Subcategory>>('PATCH', `/inventory-procurement/categories/${subcategory.categoryId}/subcategories/${subcategory.id}`, {
            body: { label: editSubForm.label.trim(), isActive: editSubForm.isActive, sortOrder: editSubForm.sortOrder },
        });
        notifySuccess('Subcategory updated.');
        editSubOpen.value = false;
        await loadCategories();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to update subcategory.'));
    } finally {
        editSubLoading.value = false;
    }
}

async function toggleSubcategoryActive(subcategory: Subcategory) {
    if (!canManage.value) return;
    try {
        await apiRequest<ItemResponse<Subcategory>>('PATCH', `/inventory-procurement/categories/${subcategory.categoryId}/subcategories/${subcategory.id}`, {
            body: { isActive: !subcategory.isActive },
        });
        notifySuccess(subcategory.isActive ? 'Subcategory deactivated.' : 'Subcategory activated.');
        await loadCategories();
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to update subcategory.'));
    }
}

onMounted(() => {
    void loadCategories();
});

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Categories" />
    <AppLayout :breadcrumbs="breadcrumbs">
        <div
            ref="scrollContainer"
            class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg"
            :style="{ height: scrollContainerHeight }"
        >
            <div class="sticky top-0 z-10 bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0 space-y-0.5">
                        <div class="flex flex-wrap items-center gap-2">
                            <h1 class="text-lg font-bold tracking-tight md:text-xl">Categories</h1>
                            <Badge v-if="permissionsResolved && !canManage" variant="outline" class="h-5 px-1.5 text-[10px] font-medium">
                                View only
                            </Badge>
                        </div>
                        <p class="text-xs text-muted-foreground">Inventory category presentation and subcategory reference data</p>
                    </div>
                    <div class="flex shrink-0 flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" class="h-8 w-8 p-0" :disabled="listLoading" title="Refresh" @click="loadCategories">
                            <AppIcon :name="listLoading ? 'loader-circle' : 'refresh-cw'" class="size-3.5" :class="listLoading ? 'animate-spin' : ''" />
                        </Button>
                        <Link :href="INVENTORY_PROCUREMENT_HOME_PATH">
                            <Button variant="ghost" size="sm" class="h-8 gap-1.5">
                                <AppIcon name="layout-grid" class="size-3.5" /> Supply chain home
                            </Button>
                        </Link>
                    </div>
                </div>
                <Alert v-if="!canManage && permissionsResolved" variant="default" class="mt-3 py-2">
                    <AppIcon name="info" class="size-3.5" />
                    <AlertDescription class="text-xs">
                        Category and subcategory labels can only be changed by users with the "manage inventory items" permission.
                    </AlertDescription>
                </Alert>
                <Alert v-if="canManage" variant="default" class="mt-3 border-amber-300 bg-amber-50 py-2 dark:border-amber-900 dark:bg-amber-950/40">
                    <AppIcon name="alert-triangle" class="size-3.5" />
                    <AlertTitle class="text-xs font-semibold">Categories are fixed by the application</AlertTitle>
                    <AlertDescription class="text-xs">
                        New top-level categories cannot be created here -- each category's behavior (form fields, cold-chain rules, controlled-substance
                        eligibility) is wired into the application code. Only the label, description, active flag, and sort order are editable.
                        Subcategories, however, are free-form reference data and can be added or renamed freely.
                    </AlertDescription>
                </Alert>
            </div>

            <div class="px-6 pb-6">
                <div v-if="errors.length" class="mb-4 space-y-2">
                    <Alert v-for="(message, index) in errors" :key="index" variant="destructive">
                        <AlertDescription>{{ message }}</AlertDescription>
                    </Alert>
                </div>

                <div v-if="loading" class="space-y-2">
                    <Skeleton class="h-14 w-full" />
                    <Skeleton class="h-14 w-full" />
                    <Skeleton class="h-14 w-full" />
                </div>

                <p v-else-if="!canRead" class="text-sm text-muted-foreground">You do not have permission to view inventory categories.</p>

                <p v-else-if="!categories.length" class="text-sm text-muted-foreground">No categories found.</p>

                <Accordion v-else type="multiple" class="space-y-2">
                    <AccordionItem
                        v-for="category in categories"
                        :key="category.id"
                        :value="category.id"
                        class="overflow-hidden rounded-lg border bg-card"
                    >
                        <AccordionTrigger class="px-4 py-3 hover:no-underline">
                            <div class="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
                                <div class="min-w-0 text-left">
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="text-sm font-semibold">{{ category.label }}</span>
                                        <Badge variant="outline" class="h-5 px-1.5 text-[10px] font-mono">{{ category.code }}</Badge>
                                        <Badge v-if="!category.isActive" variant="destructive" class="h-5 px-1.5 text-[10px]">Inactive</Badge>
                                    </div>
                                    <p v-if="category.description" class="mt-0.5 truncate text-xs text-muted-foreground">{{ category.description }}</p>
                                </div>
                                <Badge variant="secondary" class="h-5 shrink-0 px-1.5 text-[10px] tabular-nums">
                                    {{ category.subcategories.length }} subcategor{{ category.subcategories.length === 1 ? 'y' : 'ies' }}
                                </Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent class="px-4 pb-4">
                            <div class="flex flex-wrap gap-1.5 border-b pb-3">
                                <Badge
                                    v-for="flag in behaviorFlags(category)"
                                    :key="flag.label"
                                    :variant="flag.on ? 'secondary' : 'outline'"
                                    class="h-5 px-1.5 text-[10px]"
                                    :class="!flag.on && 'text-muted-foreground opacity-60'"
                                >
                                    {{ flag.label }}
                                </Badge>
                            </div>

                            <div class="flex items-center justify-between pt-3 pb-2">
                                <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subcategories</p>
                                <div class="flex gap-1.5">
                                    <Button v-if="canManage" variant="outline" size="sm" class="h-7 gap-1 text-xs" @click="openCreateSubcategory(category)">
                                        <AppIcon name="plus" class="size-3" /> Add subcategory
                                    </Button>
                                    <Button v-if="canManage" variant="outline" size="sm" class="h-7 gap-1 text-xs" @click="openEditCategory(category)">
                                        <AppIcon name="pencil" class="size-3" /> Edit category
                                    </Button>
                                </div>
                            </div>

                            <p v-if="!category.subcategories.length" class="text-xs text-muted-foreground">No subcategories yet.</p>
                            <div v-else class="divide-y rounded-md border">
                                <div
                                    v-for="subcategory in category.subcategories"
                                    :key="subcategory.id"
                                    class="flex items-center justify-between gap-2 px-3 py-2"
                                >
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-2">
                                            <span class="text-xs font-medium" :class="!subcategory.isActive && 'text-muted-foreground line-through'">
                                                {{ subcategory.label }}
                                            </span>
                                            <span class="font-mono text-[10px] text-muted-foreground">{{ subcategory.code }}</span>
                                        </div>
                                    </div>
                                    <div v-if="canManage" class="flex shrink-0 items-center gap-2">
                                        <Switch :model-value="subcategory.isActive" @update:model-value="toggleSubcategoryActive(subcategory)" />
                                        <Button variant="ghost" size="sm" class="h-7 w-7 p-0" @click="openEditSubcategory(subcategory)">
                                            <AppIcon name="pencil" class="size-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>

        <!-- Edit category -->
        <Dialog v-model:open="editCategoryOpen">
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit category</DialogTitle>
                    <DialogDescription>Behavior (which fields render, cold-chain/controlled-substance eligibility) is fixed by the application and cannot be changed here.</DialogDescription>
                </DialogHeader>
                <div class="space-y-3">
                    <div class="space-y-1.5">
                        <Label>Label</Label>
                        <Input v-model="editCategoryForm.label" placeholder="Display label" />
                    </div>
                    <div class="space-y-1.5">
                        <Label>Description</Label>
                        <Textarea v-model="editCategoryForm.description" rows="2" placeholder="Optional description" />
                    </div>
                    <div class="flex items-center justify-between rounded-md border px-3 py-2">
                        <Label class="text-xs">Active</Label>
                        <Switch v-model="editCategoryForm.isActive" />
                    </div>
                    <div class="space-y-1.5">
                        <Label>Sort order</Label>
                        <Input v-model.number="editCategoryForm.sortOrder" type="number" min="0" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" :disabled="editCategoryLoading" @click="editCategoryOpen = false">Cancel</Button>
                    <Button :disabled="editCategoryLoading || !editCategoryForm.label.trim()" @click="saveEditCategory">
                        {{ editCategoryLoading ? 'Saving...' : 'Save' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- Create subcategory -->
        <Dialog v-model:open="createSubOpen">
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add subcategory</DialogTitle>
                    <DialogDescription v-if="createSubTarget">Under "{{ createSubTarget.label }}"</DialogDescription>
                </DialogHeader>
                <div class="space-y-3">
                    <div class="space-y-1.5">
                        <Label>Code</Label>
                        <Input v-model="createSubForm.code" placeholder="e.g. antibiotics" />
                        <p class="text-[11px] text-muted-foreground">Letters, numbers, dashes, and underscores only.</p>
                    </div>
                    <div class="space-y-1.5">
                        <Label>Label</Label>
                        <Input v-model="createSubForm.label" placeholder="e.g. Antibiotics" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" :disabled="createSubLoading" @click="createSubOpen = false">Cancel</Button>
                    <Button :disabled="createSubLoading || !createSubForm.code.trim() || !createSubForm.label.trim()" @click="saveCreateSubcategory">
                        {{ createSubLoading ? 'Creating...' : 'Create' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <!-- Edit subcategory -->
        <Dialog v-model:open="editSubOpen">
            <DialogContent class="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit subcategory</DialogTitle>
                </DialogHeader>
                <div class="space-y-3">
                    <div class="space-y-1.5">
                        <Label>Label</Label>
                        <Input v-model="editSubForm.label" />
                    </div>
                    <div class="flex items-center justify-between rounded-md border px-3 py-2">
                        <Label class="text-xs">Active</Label>
                        <Switch v-model="editSubForm.isActive" />
                    </div>
                    <div class="space-y-1.5">
                        <Label>Sort order</Label>
                        <Input v-model.number="editSubForm.sortOrder" type="number" min="0" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" :disabled="editSubLoading" @click="editSubOpen = false">Cancel</Button>
                    <Button :disabled="editSubLoading || !editSubForm.label.trim()" @click="saveEditSubcategory">
                        {{ editSubLoading ? 'Saving...' : 'Save' }}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </AppLayout>
</template>
