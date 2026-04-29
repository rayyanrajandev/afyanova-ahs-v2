import { computed, ref, type Ref } from 'vue';

import type {
    AuthPermissionsResponse,
    BillingWorkspaceView,
} from '../types';

type BillingApiRequest = <T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: {
        query?: Record<string, string | number | boolean | string[] | null | undefined>;
        body?: Record<string, unknown>;
    },
) => Promise<T>;

type LoadBillingPermissionsOptions = {
    apiRequest: BillingApiRequest;
    billingWorkspaceView: Ref<BillingWorkspaceView>;
    syncBillingQueueFiltersToUrl: () => void;
    resetBillingPayerContractsState: () => void;
};

export function useBillingPermissions() {
    const billingPermissionsResolved = ref(false);
    const canRecordBillingPayments = ref(false);
    const canViewBillingPaymentHistory = ref(false);
    const canViewBillingInvoiceAuditLogs = ref(false);
    const canReverseBillingPayments = ref(false);
    const canCreateBillingInvoices = ref(false);
    const canReadBillingInvoices = ref(false);
    const canIssueBillingInvoices = ref(false);
    const canUpdateDraftBillingInvoices = ref(false);
    const canVoidBillingInvoices = ref(false);
    const canCancelBillingInvoices = ref(false);
    const canReadBillingFinancialControls = ref(false);
    const canReadBillingServiceCatalog = ref(false);
    const canReadBillingPayerContracts = ref(false);
    const canReadAppointments = ref(false);
    const canReadAdmissions = ref(false);
    const canReadMedicalRecords = ref(false);
    const canCreateLaboratoryOrders = ref(false);
    const canCreatePharmacyOrders = ref(false);
    const canCreateTheatreProcedures = ref(false);
    const canReadClaimsInsurance = ref(false);
    const canCreateClaimsInsurance = ref(false);

    const canOperateBillingWorkflow = computed(
        () =>
            canIssueBillingInvoices.value ||
            canRecordBillingPayments.value ||
            canUpdateDraftBillingInvoices.value,
    );
    const canManageBillingWorkflowExceptions = computed(
        () => canCancelBillingInvoices.value || canVoidBillingInvoices.value,
    );
    const hasBillingExecutionSurface = computed(
        () =>
            canOperateBillingWorkflow.value ||
            canManageBillingWorkflowExceptions.value,
    );

    function resetPermissions() {
        canRecordBillingPayments.value = false;
        canViewBillingPaymentHistory.value = false;
        canViewBillingInvoiceAuditLogs.value = false;
        canReverseBillingPayments.value = false;
        canCreateBillingInvoices.value = false;
        canReadBillingInvoices.value = false;
        canIssueBillingInvoices.value = false;
        canUpdateDraftBillingInvoices.value = false;
        canVoidBillingInvoices.value = false;
        canCancelBillingInvoices.value = false;
        canReadBillingFinancialControls.value = false;
        canReadBillingServiceCatalog.value = false;
        canReadBillingPayerContracts.value = false;
        canReadAppointments.value = false;
        canReadAdmissions.value = false;
        canReadMedicalRecords.value = false;
        canCreateLaboratoryOrders.value = false;
        canCreatePharmacyOrders.value = false;
        canCreateTheatreProcedures.value = false;
        canReadClaimsInsurance.value = false;
        canCreateClaimsInsurance.value = false;
    }

    async function loadBillingPermissions(
        options: LoadBillingPermissionsOptions,
    ) {
        billingPermissionsResolved.value = false;

        try {
            const response = await options.apiRequest<AuthPermissionsResponse>(
                'GET',
                '/auth/me/permissions',
            );
            const permissions = response.data ?? [];
            const names = new Set(
                permissions
                    .map((permission) => permission.name?.trim())
                    .filter((name): name is string => Boolean(name)),
            );

            canRecordBillingPayments.value = names.has('billing.payments.record');
            canViewBillingPaymentHistory.value = names.has(
                'billing.payments.view-history',
            );
            canViewBillingInvoiceAuditLogs.value =
                names.has('billing-invoices.view-audit-logs') ||
                names.has('billing.invoices.view-audit-logs');
            canReverseBillingPayments.value = names.has(
                'billing.payments.reverse',
            );
            canCreateBillingInvoices.value = names.has(
                'billing.invoices.create',
            );
            canReadBillingInvoices.value = names.has('billing.invoices.read');
            canIssueBillingInvoices.value = names.has('billing.invoices.issue');
            canUpdateDraftBillingInvoices.value = names.has(
                'billing.invoices.update-draft',
            );
            canVoidBillingInvoices.value = names.has('billing.invoices.void');
            canCancelBillingInvoices.value = names.has(
                'billing.invoices.cancel',
            );
            canReadBillingFinancialControls.value = names.has(
                'billing.financial-controls.read',
            );
            canReadBillingServiceCatalog.value = names.has(
                'billing.service-catalog.read',
            );
            canReadBillingPayerContracts.value = names.has(
                'billing.payer-contracts.read',
            );
            canReadAppointments.value = names.has('appointments.read');
            canReadAdmissions.value = names.has('admissions.read');
            canReadMedicalRecords.value = names.has('medical.records.read');
            canCreateLaboratoryOrders.value = names.has(
                'laboratory.orders.create',
            );
            canCreatePharmacyOrders.value = names.has(
                'pharmacy.orders.create',
            );
            canCreateTheatreProcedures.value = names.has(
                'theatre.procedures.create',
            );
            canReadClaimsInsurance.value = names.has(
                'claims.insurance.read',
            );
            canCreateClaimsInsurance.value = names.has(
                'claims.insurance.create',
            );

            if (!canReadBillingPayerContracts.value) {
                options.resetBillingPayerContractsState();
            }

            if (
                !canCreateBillingInvoices.value &&
                options.billingWorkspaceView.value === 'create'
            ) {
                options.billingWorkspaceView.value = 'queue';
                options.syncBillingQueueFiltersToUrl();
            }

            if (
                !canReadBillingFinancialControls.value &&
                options.billingWorkspaceView.value === 'board'
            ) {
                options.billingWorkspaceView.value = 'queue';
                options.syncBillingQueueFiltersToUrl();
            }
        } catch {
            resetPermissions();
            options.resetBillingPayerContractsState();

            if (
                options.billingWorkspaceView.value === 'create' ||
                options.billingWorkspaceView.value === 'board'
            ) {
                options.billingWorkspaceView.value = 'queue';
                options.syncBillingQueueFiltersToUrl();
            }
        } finally {
            billingPermissionsResolved.value = true;
        }
    }

    return {
        billingPermissionsResolved,
        canRecordBillingPayments,
        canViewBillingPaymentHistory,
        canViewBillingInvoiceAuditLogs,
        canReverseBillingPayments,
        canCreateBillingInvoices,
        canReadBillingInvoices,
        canIssueBillingInvoices,
        canUpdateDraftBillingInvoices,
        canVoidBillingInvoices,
        canCancelBillingInvoices,
        canReadBillingFinancialControls,
        canReadBillingServiceCatalog,
        canReadBillingPayerContracts,
        canReadAppointments,
        canReadAdmissions,
        canReadMedicalRecords,
        canCreateLaboratoryOrders,
        canCreatePharmacyOrders,
        canCreateTheatreProcedures,
        canReadClaimsInsurance,
        canCreateClaimsInsurance,
        canOperateBillingWorkflow,
        canManageBillingWorkflowExceptions,
        hasBillingExecutionSurface,
        loadBillingPermissions,
    };
}
