<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBillingPatientWorkspace } from '@/composables/billingWorkspace/useBillingPatientWorkspace';
import { useBillingCashierActions } from '@/composables/billingCashierQueue/useBillingCashierActions';
import { useStickyScrollContainer } from '@/composables/useStickyScrollContainer';
import AppLayout from '@/layouts/AppLayout.vue';
import { deriveAgeFromDateOfBirth, formatAgeLabel } from '@/lib/patientAge';
import type { BreadcrumbItem } from '@/types';
import InvoicesTab from './tabs/InvoicesTab.vue';
import PaymentsTab from './tabs/PaymentsTab.vue';
import ChargesTab from './tabs/ChargesTab.vue';
import InsuranceTab from './tabs/InsuranceTab.vue';
import AuditTab from './tabs/AuditTab.vue';

/**
 * Structure matches encounters/WorkspaceV2.vue: Tabs wraps the whole page
 * (class="contents"), a sticky header (patient identity + stat tiles +
 * TabsList) only renders once workspace data has loaded, and TabsContent
 * blocks sit in a single scrolling content area below rather than each
 * being its own independently-scrolling panel.
 */
const props = defineProps<{
    patientId: string;
}>();

const workspace = useBillingPatientWorkspace(computed(() => props.patientId));
const actions = useBillingCashierActions();

const focusInvoiceId = new URLSearchParams(window.location.search).get('focusInvoiceId');
const activeTab = ref('invoices');

const patient = computed(() => workspace.data.value?.patient ?? null);
const invoices = computed(() => workspace.data.value?.invoices ?? []);
const charges = computed(() => workspace.data.value?.charges ?? []);

const breadcrumbs = computed<BreadcrumbItem[]>(() => [
    { title: 'Billing', href: '/billing' },
    { title: patientName.value || 'Patient', href: `/billing/${props.patientId}` },
]);

const patientName = computed(() => {
    if (!patient.value) return '';
    return [patient.value.firstName, patient.value.lastName].filter(Boolean).join(' ');
});

/** Matches the "gender | DOB (age y)" convention used in encounters/WorkspaceV2.vue and PatientLookupField.vue. */
const patientDemographics = computed(() => {
    const p = patient.value;
    if (!p) return null;

    const parts: string[] = [];
    if (p.gender) parts.push(p.gender);

    const age = p.dateOfBirth ? deriveAgeFromDateOfBirth(p.dateOfBirth) : null;
    if (p.dateOfBirth && age) {
        parts.push(`${p.dateOfBirth} (${formatAgeLabel(age)})`);
    } else if (p.dateOfBirth) {
        parts.push(p.dateOfBirth);
    }

    if (p.patientNumber) parts.push(p.patientNumber);
    if (p.phone) parts.push(p.phone);

    return parts.length > 0 ? parts.join(' · ') : null;
});

const workspaceSummary = computed(() => workspace.data.value?.summary ?? null);
const unpaidInvoices = computed(() =>
    invoices.value.filter((inv) => inv.status !== 'cancelled' && inv.status !== 'voided' && inv.balanceAmount > 0),
);
const totalUnpaid = computed(() => workspaceSummary.value?.totalUnpaid ?? unpaidInvoices.value.reduce((sum, inv) => sum + inv.balanceAmount, 0));
const totalBilled = computed(() => workspaceSummary.value?.totalBilled ?? invoices.value.reduce((sum, inv) => sum + inv.totalAmount, 0));

function formatMoney(amount: number): string {
    const formatted = new Intl.NumberFormat('en-TZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    return `${formatted} TZS`;
}

const { scrollContainerHeight } = useStickyScrollContainer();
</script>

<template>
    <Head title="Billing - Patient Workspace" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div ref="scrollContainer" class="flex flex-col gap-4 overflow-x-hidden overflow-y-auto rounded-lg" :style="{ height: scrollContainerHeight }">
            <Tabs v-model="activeTab" class="contents">
                <div v-if="patient" class="sticky top-0 z-10 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0 space-y-0.5">
                            <div class="flex flex-wrap items-baseline gap-2">
                                <h1 class="text-lg font-bold tracking-tight md:text-xl">
                                    <Link :href="`/patients/${patient.id}/chart`" class="hover:underline">{{ patientName }}</Link>
                                </h1>
                            </div>
                            <p v-if="patientDemographics" class="text-xs text-muted-foreground">{{ patientDemographics }}</p>
                            <p class="text-sm text-muted-foreground">
                                {{ invoices.length }} invoice{{ invoices.length === 1 ? '' : 's' }}
                                <span v-if="unpaidInvoices.length > 0"> · {{ unpaidInvoices.length }} unpaid</span>
                            </p>
                        </div>
                    </div>

                    <div class="mt-3 grid grid-cols-3 gap-2">
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Total billed</p>
                            <p class="text-sm font-bold tabular-nums">{{ formatMoney(totalBilled) }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Unpaid</p>
                            <p class="text-sm font-bold text-destructive tabular-nums">{{ formatMoney(totalUnpaid) }}</p>
                        </div>
                        <div class="rounded-md border bg-muted/50 px-2.5 py-1.5">
                            <p class="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">Unpaid invoices</p>
                            <p class="text-sm font-bold tabular-nums">{{ unpaidInvoices.length }}</p>
                        </div>
                    </div>

                    <TabsList class="mt-3 flex w-full flex-wrap justify-start gap-1">
                        <TabsTrigger value="invoices" class="inline-flex items-center gap-1.5">
                            Invoices
                            <Badge v-if="unpaidInvoices.length > 0" variant="destructive" class="h-4 min-w-4 px-1 text-[10px]">{{ unpaidInvoices.length }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="payments">Payments</TabsTrigger>
                        <TabsTrigger value="charges" class="inline-flex items-center gap-1.5">
                            Charges
                            <Badge v-if="charges.length > 0" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">{{ charges.length }}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="insurance">Insurance</TabsTrigger>
                        <TabsTrigger value="audit">Audit</TabsTrigger>
                    </TabsList>
                </div>

                <div class="space-y-4 px-4 pb-6 md:px-6">
                    <div v-if="workspace.isPending.value" class="space-y-2">
                        <Skeleton class="h-6 w-1/2" />
                        <Skeleton class="h-24 w-full" />
                    </div>

                    <Alert v-else-if="workspace.isError.value" variant="destructive">
                        <AlertTitle>Unable to load this patient's billing</AlertTitle>
                        <AlertDescription>
                            {{ workspace.error.value?.message ?? 'Unknown error.' }}
                        </AlertDescription>
                    </Alert>

                    <template v-else-if="patient">
                        <TabsContent value="invoices" class="space-y-4">
                            <div
                                v-if="invoices.length === 0"
                                class="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
                            >
                                No invoices found for this patient.
                            </div>
                            <InvoicesTab
                                v-else
                                :invoices="invoices"
                                :patient-id="patientId"
                                :focus-invoice-id="focusInvoiceId"
                                :record-payment="(input) => actions.recordPayment.mutateAsync(input)"
                                :issue-invoice="(id) => actions.issueInvoice.mutateAsync(id)"
                                :invalidate="(pid) => actions.invalidate(pid)"
                            />
                        </TabsContent>

                        <TabsContent value="payments" class="space-y-4">
                            <PaymentsTab
                                :invoices="invoices"
                                :patient-id="patientId"
                                :reverse-payment="(input) => actions.reversePayment.mutateAsync(input)"
                                :invalidate="(pid) => actions.invalidate(pid)"
                            />
                        </TabsContent>

                        <TabsContent value="charges" class="space-y-4">
                            <ChargesTab
                                :charges="charges"
                                :invoices="invoices"
                                :patient-id="patientId"
                                :add-charge-candidate-to-draft="(input) => actions.addChargeCandidateToDraft.mutateAsync(input)"
                                :create-invoice-from-candidate="(input) => actions.createInvoiceFromCandidate.mutateAsync(input)"
                                :invalidate="(pid) => actions.invalidate(pid)"
                            />
                        </TabsContent>

                        <TabsContent value="insurance" class="space-y-4">
                            <InsuranceTab :invoices="invoices" :patient-id="patientId" />
                        </TabsContent>

                        <TabsContent value="audit" class="space-y-4">
                            <AuditTab :invoices="invoices" :patient-id="patientId" />
                        </TabsContent>
                    </template>
                </div>
            </Tabs>
        </div>
    </AppLayout>
</template>
