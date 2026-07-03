<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';

const props = defineProps({
    state: { type: Object, required: true },
    view: { type: Object, required: true },
    actions: { type: Object, required: true },
    helpers: { type: Object, required: true },
});

const state = props.state as Record<string, any>;
const view = props.view as Record<string, any>;
const actions = props.actions as Record<string, any>;
const helpers = props.helpers as Record<string, any>;

const editForm = state.editForm;

const editDialogInvoiceLabel = view.editDialogInvoiceLabel;
const editDialogCanOpenDraftWorkspace = view.editDialogCanOpenDraftWorkspace;
const editDialogSourceInvoice = view.editDialogSourceInvoice;
const editDialogLoading = view.editDialogLoading;
const editDialogError = view.editDialogError;
const editBillingDraftPreviewLoading = view.editBillingDraftPreviewLoading;
const editBillingDraftPreviewInvoice = view.editBillingDraftPreviewInvoice;
const defaultBillingCurrencyCode = view.defaultBillingCurrencyCode;
const canReadBillingPayerContracts = view.canReadBillingPayerContracts;
const billingPayerContractsLoading = view.billingPayerContractsLoading;
const billingPayerContractsError = view.billingPayerContractsError;
const editBillingPayerContractOptions = view.editBillingPayerContractOptions;
const selectedEditBillingPayerPreview = view.selectedEditBillingPayerPreview;
const editDraftExecutionPreview = view.editDraftExecutionPreview;
const editBillingDraftPreviewCoverageMetricBadges =
    view.editBillingDraftPreviewCoverageMetricBadges;
const editBillingDraftPreviewNegotiatedCount =
    view.editBillingDraftPreviewNegotiatedCount;
const editLineItemsCount = view.editLineItemsCount;
const editLineItemsSubtotal = view.editLineItemsSubtotal;
const editDraftSaveGuidanceDescription = view.editDraftSaveGuidanceDescription;

const closeEditInvoiceDialog = actions.closeEditInvoiceDialog;
const openDraftBillingWorkspace = actions.openDraftBillingWorkspace;
const editFieldError = actions.editFieldError;
const submitEditInvoice = actions.submitEditInvoice;
const removeEditLineItem = actions.removeEditLineItem;
const applyCalculatedEditSubtotal = actions.applyCalculatedEditSubtotal;

const formatMoney = helpers.formatMoney;
const formatPercent = helpers.formatPercent;
const createLineItemTotalDraft = helpers.createLineItemTotalDraft;
</script>

<template>
    <Sheet
        :open="state.editDialogOpen"
        @update:open="
            (open) =>
                open
                    ? (state.editDialogOpen = true)
                    : closeEditInvoiceDialog()
        "
    >
        <SheetContent
            side="right"
            variant="form"
            size="4xl"
        >
            <SheetHeader
                class="sticky top-0 z-10 shrink-0 border-b bg-background px-6 py-4 text-left"
            >
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div class="space-y-1.5">
                        <SheetTitle>Quick Edit Draft</SheetTitle>
                        <SheetDescription>
                            Make smaller draft corrections for
                            {{ editDialogInvoiceLabel }} without leaving the invoice queue.
                        </SheetDescription>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Badge variant="outline" class="rounded-lg">Quick edit</Badge>
                        <Button
                            v-if="editDialogCanOpenDraftWorkspace && editDialogSourceInvoice"
                            type="button"
                            variant="outline"
                            size="sm"
                            class="gap-1.5"
                            @click="openDraftBillingWorkspace(editDialogSourceInvoice)"
                        >
                            <AppIcon name="plus" class="size-3.5" />
                            Open Full Draft Workspace
                        </Button>
                    </div>
                </div>
            </SheetHeader>

            <div class="flex-1 overflow-y-auto px-6 py-4">
                <div class="space-y-3">
                    <Alert class="border-border/70 bg-muted/20">
                        <AlertTitle>Quick edit only</AlertTitle>
                        <AlertDescription class="text-sm leading-5">
                            Use this sheet for dates, notes, payer link, adjustments, and
                            existing line corrections. If you forgot services or need broader
                            charge revision, continue in the full draft workspace.
                        </AlertDescription>
                    </Alert>

                    <Alert v-if="editDialogError" variant="destructive">
                        <AlertTitle>Edit validation</AlertTitle>
                        <AlertDescription>{{ editDialogError }}</AlertDescription>
                    </Alert>

                    <div class="grid gap-3 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <SingleDatePopoverField
                                input-id="bil-edit-invoice-date"
                                label="Invoice Date"
                                v-model="editForm.invoiceDate"
                                placeholder="Select invoice date"
                                :error-message="editFieldError('invoiceDate')"
                            />
                        </div>
                        <div class="grid gap-2">
                            <SingleDatePopoverField
                                input-id="bil-edit-payment-due-at"
                                label="Payment Due Date"
                                v-model="editForm.paymentDueAt"
                                placeholder="Select due date"
                                :error-message="editFieldError('paymentDueAt')"
                            />
                        </div>
                    </div>

                    <div class="grid gap-3 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="bil-edit-currency-code">Currency Code</Label>
                            <Input
                                id="bil-edit-currency-code"
                                v-model="editForm.currencyCode"
                                maxlength="3"
                                :placeholder="defaultBillingCurrencyCode"
                            />
                            <p
                                v-if="editFieldError('currencyCode')"
                                class="text-xs text-destructive"
                            >
                                {{ editFieldError('currencyCode') }}
                            </p>
                        </div>
                        <div class="grid gap-2">
                            <div class="flex items-center justify-between gap-2">
                                <Label for="bil-edit-subtotal-amount">Subtotal Amount</Label>
                                <span
                                    v-if="editLineItemsCount > 0"
                                    class="text-[11px] text-muted-foreground"
                                >
                                    Calculated
                                    {{
                                        formatMoney(
                                            editLineItemsSubtotal,
                                            editForm.currencyCode ||
                                                defaultBillingCurrencyCode,
                                        )
                                    }}
                                </span>
                            </div>
                            <Input
                                id="bil-edit-subtotal-amount"
                                v-model="editForm.subtotalAmount"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                            />
                            <p
                                v-if="editFieldError('subtotalAmount')"
                                class="text-xs text-destructive"
                            >
                                {{ editFieldError('subtotalAmount') }}
                            </p>
                        </div>
                    </div>

                    <div class="space-y-3 rounded-lg border p-3">
                        <div
                            class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between"
                        >
                            <div class="space-y-1">
                                <p class="text-sm font-medium">Settlement route</p>
                                <p class="text-xs text-muted-foreground">
                                    Keep the draft self-pay, or relink it to one active payer
                                    contract before issuing it.
                                </p>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <Badge :variant="selectedEditBillingPayerPreview.statusTone">
                                    {{ selectedEditBillingPayerPreview.statusLabel }}
                                </Badge>
                                <Badge
                                    v-if="editBillingDraftPreviewLoading"
                                    variant="outline"
                                >
                                    Refreshing live preview
                                </Badge>
                                <Badge
                                    v-else-if="editBillingDraftPreviewInvoice"
                                    variant="secondary"
                                >
                                    Live payer policy
                                </Badge>
                                <Button
                                    v-if="editForm.billingPayerContractId.trim()"
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    @click="editForm.billingPayerContractId = ''"
                                >
                                    Clear contract
                                </Button>
                            </div>
                        </div>

                        <div v-if="canReadBillingPayerContracts" class="grid gap-2">
                            <SearchableSelectField
                                input-id="bil-edit-payer-contract"
                                label="Payer Contract"
                                :model-value="editForm.billingPayerContractId"
                                :options="editBillingPayerContractOptions"
                                placeholder="Leave blank for self-pay"
                                search-placeholder="Search contract code, payer, plan"
                                :helper-text="
                                    billingPayerContractsLoading
                                        ? 'Loading active payer contracts...'
                                        : 'Switch the draft to a contract only when a third-party payer is expected to settle part of it.'
                                "
                                empty-text="No matching payer contract found."
                                :disabled="billingPayerContractsLoading"
                                @update:model-value="
                                    editForm.billingPayerContractId = $event
                                "
                            />
                            <p
                                v-if="editFieldError('billingPayerContractId')"
                                class="text-xs text-destructive"
                            >
                                {{ editFieldError('billingPayerContractId') }}
                            </p>
                        </div>

                        <Alert v-else class="py-2">
                            <AlertTitle>Payer contract access unavailable</AlertTitle>
                            <AlertDescription>
                                This user cannot browse payer contracts in the edit sheet, so
                                settlement changes must stay self-pay unless another billing user
                                relinks the draft.
                            </AlertDescription>
                        </Alert>

                        <Alert
                            v-if="canReadBillingPayerContracts && billingPayerContractsError"
                            variant="destructive"
                            class="py-2"
                        >
                            <AlertTitle>Payer contracts unavailable</AlertTitle>
                            <AlertDescription>
                                {{ billingPayerContractsError }}
                            </AlertDescription>
                        </Alert>

                        <div class="rounded-lg bg-muted/30 p-3">
                            <div
                                class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                            >
                                <div>
                                    <p
                                        class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                                    >
                                        Draft execution after issue
                                    </p>
                                    <p class="mt-1 text-sm font-medium text-foreground">
                                        {{ editDraftExecutionPreview.title }}
                                    </p>
                                    <p class="mt-1 text-xs text-muted-foreground">
                                        {{ editDraftExecutionPreview.helper }}
                                    </p>
                                </div>
                                <Badge :variant="editDraftExecutionPreview.badgeVariant">
                                    {{ editDraftExecutionPreview.afterIssueLabel }}
                                </Badge>
                            </div>
                        </div>

                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div class="rounded-lg bg-background/80 p-3">
                                <p
                                    class="text-[11px] uppercase tracking-wide text-muted-foreground"
                                >
                                    Settlement Path
                                </p>
                                <p class="mt-1 text-sm font-medium text-foreground">
                                    {{
                                        selectedEditBillingPayerPreview
                                            .settlementPathLabel
                                    }}
                                </p>
                            </div>
                            <div class="rounded-lg bg-background/80 p-3">
                                <p
                                    class="text-[11px] uppercase tracking-wide text-muted-foreground"
                                >
                                    Expected Payer
                                </p>
                                <p class="mt-1 text-sm font-medium text-foreground">
                                    {{
                                        formatMoney(
                                            selectedEditBillingPayerPreview.expectedPayerAmount,
                                            selectedEditBillingPayerPreview.currencyCode,
                                        )
                                    }}
                                </p>
                            </div>
                            <div class="rounded-lg bg-background/80 p-3">
                                <p
                                    class="text-[11px] uppercase tracking-wide text-muted-foreground"
                                >
                                    Expected Patient
                                </p>
                                <p class="mt-1 text-sm font-medium text-foreground">
                                    {{
                                        formatMoney(
                                            selectedEditBillingPayerPreview.expectedPatientAmount,
                                            selectedEditBillingPayerPreview.currencyCode,
                                        )
                                    }}
                                </p>
                            </div>
                            <div class="rounded-lg bg-background/80 p-3">
                                <p
                                    class="text-[11px] uppercase tracking-wide text-muted-foreground"
                                >
                                    After Issue Queue
                                </p>
                                <p class="mt-1 text-sm font-medium text-foreground">
                                    {{ editDraftExecutionPreview.afterIssueLabel }}
                                </p>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    {{ editDraftExecutionPreview.afterIssueHelper }}
                                </p>
                            </div>
                        </div>

                        <div
                            v-if="selectedEditBillingPayerPreview.selectedContract"
                            class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                        >
                            <Badge variant="outline">
                                Coverage
                                {{
                                    formatPercent(
                                        selectedEditBillingPayerPreview.coveragePercent,
                                    )
                                }}
                            </Badge>
                            <Badge variant="outline">
                                Copay
                                {{
                                    selectedEditBillingPayerPreview.copayType ===
                                    'fixed'
                                        ? formatMoney(
                                              selectedEditBillingPayerPreview.copayAmount,
                                              selectedEditBillingPayerPreview.currencyCode,
                                          )
                                        : selectedEditBillingPayerPreview.copayType ===
                                            'percentage'
                                          ? `${formatPercent(selectedEditBillingPayerPreview.copayValue)} | ${formatMoney(selectedEditBillingPayerPreview.copayAmount, selectedEditBillingPayerPreview.currencyCode)}`
                                          : 'None'
                                }}
                            </Badge>
                            <Badge
                                v-if="
                                    selectedEditBillingPayerPreview
                                        .requiresPreAuthorization
                                "
                                variant="outline"
                            >
                                Pre-authorization required
                            </Badge>
                        </div>
                        <div
                            v-if="
                                editForm.billingPayerContractId.trim() &&
                                (
                                    editBillingDraftPreviewCoverageMetricBadges.length > 0 ||
                                    editBillingDraftPreviewNegotiatedCount > 0
                                )
                            "
                            class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                        >
                            <Badge
                                v-for="badge in editBillingDraftPreviewCoverageMetricBadges"
                                :key="`edit-preview-badge-${badge.key}`"
                                :variant="badge.variant"
                            >
                                {{ badge.label }}
                            </Badge>
                            <Badge
                                v-if="editBillingDraftPreviewNegotiatedCount > 0"
                                variant="secondary"
                            >
                                {{
                                    `${editBillingDraftPreviewNegotiatedCount} negotiated price${editBillingDraftPreviewNegotiatedCount === 1 ? '' : 's'}`
                                }}
                            </Badge>
                        </div>

                        <Alert
                            v-if="
                                selectedEditBillingPayerPreview.blockingReasons.length > 0
                            "
                            variant="destructive"
                            class="py-2"
                        >
                            <AlertTitle>Settlement review needed</AlertTitle>
                            <AlertDescription class="space-y-1 text-sm leading-5">
                                <p
                                    v-for="reason in selectedEditBillingPayerPreview.blockingReasons"
                                    :key="`edit-payer-block-${reason}`"
                                >
                                    {{ reason }}
                                </p>
                            </AlertDescription>
                        </Alert>
                        <Alert
                            v-else-if="selectedEditBillingPayerPreview.guidance.length > 0"
                            class="py-2"
                        >
                            <AlertDescription class="space-y-1 text-sm leading-5">
                                <p
                                    v-for="guidance in selectedEditBillingPayerPreview.guidance"
                                    :key="`edit-payer-guidance-${guidance}`"
                                >
                                    {{ guidance }}
                                </p>
                            </AlertDescription>
                        </Alert>
                        <p
                            v-if="editBillingDraftPreviewLoading"
                            class="text-xs text-muted-foreground"
                        >
                            Refreshing negotiated price and payer policy preview for this
                            draft.
                        </p>
                        <p
                            v-else-if="editBillingDraftPreviewInvoice"
                            class="text-xs text-muted-foreground"
                        >
                            Live preview reflects current negotiated prices and active payer
                            policy. Final validation runs again when the draft is saved.
                        </p>
                    </div>

                    <div class="grid gap-3 sm:grid-cols-2">
                        <div class="grid gap-2">
                            <Label for="bil-edit-discount-amount">Discount Amount</Label>
                            <Input
                                id="bil-edit-discount-amount"
                                v-model="editForm.discountAmount"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                            />
                            <p
                                v-if="editFieldError('discountAmount')"
                                class="text-xs text-destructive"
                            >
                                {{ editFieldError('discountAmount') }}
                            </p>
                        </div>
                        <div class="grid gap-2">
                            <Label for="bil-edit-tax-amount">Tax Amount</Label>
                            <Input
                                id="bil-edit-tax-amount"
                                v-model="editForm.taxAmount"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                            />
                            <p
                                v-if="editFieldError('taxAmount')"
                                class="text-xs text-destructive"
                            >
                                {{ editFieldError('taxAmount') }}
                            </p>
                        </div>
                    </div>

                    <div class="space-y-3 rounded-lg border p-3">
                        <div
                            class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div>
                                <p class="text-sm font-medium">Line Items</p>
                                <p class="text-xs text-muted-foreground">
                                    Edit the existing draft lines here. Use the full draft
                                    workspace to add missed charges or import more completed
                                    services.
                                </p>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{{ editLineItemsCount }} items</Badge>
                                <Badge variant="secondary">
                                    Calculated:
                                    {{
                                        formatMoney(
                                            editLineItemsSubtotal,
                                            editForm.currencyCode ||
                                                defaultBillingCurrencyCode,
                                        )
                                    }}
                                </Badge>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    @click="applyCalculatedEditSubtotal"
                                >
                                    Use Calculated Subtotal
                                </Button>
                            </div>
                        </div>
                        <Alert class="border-border/70 bg-muted/20 py-2">
                            <AlertTitle>New items are added in full draft workspace</AlertTitle>
                            <AlertDescription>
                                Quick edit is limited to maintaining the lines already on this
                                draft. Use
                                <span class="font-medium text-foreground">
                                    Open Full Draft Workspace
                                </span>
                                when billing missed services.
                            </AlertDescription>
                        </Alert>

                        <p v-if="editFieldError('lineItems')" class="text-xs text-destructive">
                            {{ editFieldError('lineItems') }}
                        </p>

                        <div class="space-y-3">
                            <div
                                v-for="(item, index) in editForm.lineItems"
                                :key="item.key"
                                class="rounded-md border p-3"
                            >
                                <div
                                    class="mb-2 flex flex-wrap items-center justify-between gap-2"
                                >
                                    <p class="text-xs font-medium text-muted-foreground">
                                        Item {{ index + 1 }}
                                    </p>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        class="h-8 px-2 text-destructive"
                                        @click="removeEditLineItem(item.key)"
                                    >
                                        Remove From Draft
                                    </Button>
                                </div>

                                <div class="grid gap-3">
                                    <div class="grid gap-2">
                                        <Label>Item Description</Label>
                                        <Input
                                            v-model="item.description"
                                            placeholder="Consultation fee, lab service, medicine..."
                                        />
                                    </div>
                                    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        <div class="grid gap-2">
                                            <Label>Service Code</Label>
                                            <Input
                                                v-model="item.serviceCode"
                                                placeholder="Optional code"
                                            />
                                        </div>
                                        <div class="grid gap-2">
                                            <Label>Unit</Label>
                                            <Input
                                                v-model="item.unit"
                                                placeholder="service, test, unit"
                                            />
                                        </div>
                                        <div class="grid gap-2">
                                            <Label>Quantity</Label>
                                            <Input
                                                v-model="item.quantity"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="1"
                                            />
                                        </div>
                                        <div class="grid gap-2">
                                            <Label>Unit Price</Label>
                                            <Input
                                                v-model="item.unitPrice"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label>Line Notes</Label>
                                        <Input
                                            v-model="item.notes"
                                            placeholder="Optional line-item note"
                                        />
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        Line total:
                                        <span class="font-medium text-foreground">
                                            {{
                                                formatMoney(
                                                    createLineItemTotalDraft(item),
                                                    editForm.currencyCode ||
                                                        defaultBillingCurrencyCode,
                                                )
                                            }}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grid gap-2">
                        <Label for="bil-edit-notes">Notes</Label>
                        <Textarea
                            id="bil-edit-notes"
                            v-model="editForm.notes"
                            class="min-h-24"
                            placeholder="Invoice notes, payer instructions, comments..."
                        />
                        <p v-if="editFieldError('notes')" class="text-xs text-destructive">
                            {{ editFieldError('notes') }}
                        </p>
                    </div>
                </div>
            </div>

            <SheetFooter class="mt-auto shrink-0 border-t bg-background px-6 py-4">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p class="text-xs text-muted-foreground">
                        {{ editDraftSaveGuidanceDescription }}
                    </p>
                    <div class="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Button
                            variant="outline"
                            :disabled="editDialogLoading"
                            @click="closeEditInvoiceDialog"
                        >
                            Cancel
                        </Button>
                        <Button :disabled="editDialogLoading" @click="submitEditInvoice">
                            {{ editDialogLoading ? 'Saving...' : 'Save Draft Changes' }}
                        </Button>
                    </div>
                </div>
            </SheetFooter>
        </SheetContent>
    </Sheet>
</template>
