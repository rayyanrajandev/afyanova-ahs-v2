import type { DashboardQueueRow } from '@/lib/dashboardOperationsQueue';
import type { WorkflowSurface, WorkflowSurfaceBuilder } from '@/workflows/surfaceTypes';

export const buildCashierSurface: WorkflowSurfaceBuilder = ({ counts, lists, helpers, runtime, hasWidget }) => {

    const kpis = (() => {
return [
            helpers.metric('Draft invoices', 'Invoices still waiting for billing action.', 'receipt', helpers.numberValue(counts.billing, 'draft')),
            helpers.metric('Open claim exceptions', 'Claims still carrying active reconciliation exceptions.', 'alert-triangle', helpers.numberValue(counts.claimOpen, 'total')),
            helpers.metric('Resolved claim exceptions', 'Claims already closed out from exception follow-up.', 'check-circle', helpers.numberValue(counts.claimResolved, 'total')),
            helpers.metric('Partial payments', 'Invoices that still carry a remaining balance.', 'receipt', helpers.numberValue(counts.billing, 'partially_paid')),
        ];
    })();

    const actions = (() => {
return [
            { label: 'Billing drafts', icon: 'receipt', variant: 'default', href: '/billing?status=draft' },
            { label: 'Claim exceptions', icon: 'alert-triangle', variant: 'outline', href: '/claims-insurance?reconciliationExceptionStatus=open' },
            { label: 'All invoices', icon: 'receipt', variant: 'outline', href: '/billing' },
        ];
    })();

    const queueRows: DashboardQueueRow[] = (() => {
return (lists.draftInvoices ?? []).slice(0, 3).map((item: any) => ({
            id: String(item.id ?? item.invoiceNumber ?? Math.random()),
            title: String(item.invoiceNumber ?? 'Draft invoice'),
            subtitle: runtime.formatMoney(item.totalAmount, item.currencyCode),
            meta: item.paymentDueAt ? `Due ${runtime.formatDateTime(item.paymentDueAt)}` : `Created ${runtime.formatDateTime(item.createdAt)}`,
            status: runtime.formatEnumLabel(String(item.status ?? 'draft')),
            href: '/billing?status=draft',
            actionLabel: 'Open billing',
        }));
    })();

    const handoff = (() => {
const openClaims = helpers.numberValue(counts.claimOpen, 'total');
        const draftInvoices = helpers.numberValue(counts.billing, 'draft');
        const partialPayments = helpers.numberValue(counts.billing, 'partially_paid');

        return {
            title: 'Cashier shift handoff',
            note: 'Billing and payer follow-up',
            blockerTitle: Number(openClaims ?? 0) > 0
                ? 'Open claims exceptions'
                : Number(draftInvoices ?? 0) > 0
                    ? 'Draft invoices awaiting issue'
                    : Number(partialPayments ?? 0) > 0
                        ? 'Partially paid invoices'
                        : 'No critical cashier blockers',
            blockerNote: Number(openClaims ?? 0) > 0
                ? 'Payer blockers are still holding reconciliation open.'
                : Number(draftInvoices ?? 0) > 0
                    ? 'Revenue still depends on invoice completion or release.'
                    : Number(partialPayments ?? 0) > 0
                        ? 'Outstanding balances still need cashier follow-up.'
                        : 'Billing queues look stable for the next cashier handoff.',
            nextAction: Number(openClaims ?? 0) > 0
                ? 'Start with payer exceptions that are still blocking reconciliation.'
                : 'Review invoice drafts and partially paid balances next.',
            primaryAction: {
                label: Number(openClaims ?? 0) > 0 ? 'Open claim queue' : 'Open billing drafts',
                href: Number(openClaims ?? 0) > 0 ? '/claims-insurance?reconciliationExceptionStatus=open' : '/billing?status=draft',
            },
            secondaryAction: { label: 'Open billing', href: '/billing' },
            chips: [
                { label: 'Open claims', value: openClaims },
                { label: 'Draft invoices', value: draftInvoices },
                { label: 'Partially paid', value: partialPayments },
            ],
        };
    })();

    const watchItems = (() => {
return [
            {
                label: 'Open claims exceptions',
                note: 'Payer exceptions still blocking reconciliation.',
                value: helpers.numberValue(counts.claimOpen, 'total'),
                href: '/claims-insurance?reconciliationExceptionStatus=open',
                actionLabel: 'Open claims',
                icon: 'alert-triangle',
            },
            {
                label: 'Draft invoices awaiting issue',
                note: 'Revenue still depends on invoice completion or release.',
                value: helpers.numberValue(counts.billing, 'draft'),
                href: '/billing?status=draft',
                actionLabel: 'Open billing drafts',
                icon: 'receipt',
            },
            {
                label: 'Partially paid invoices',
                note: 'Outstanding balances still need cashier follow-up.',
                value: helpers.numberValue(counts.billing, 'partially_paid'),
                href: '/billing',
                actionLabel: 'Open billing',
                icon: 'receipt',
            },
        ];
    })();

    const queueTitle = (() => { return 'Live billing preview'; })();
    const queueDescription = (() => { return 'Draft billing work that still needs invoice follow-up.'; })();
    const searchPlaceholder = 'Patient name, MRN, phone, or appointment #';

    return {
        kpis,
        actions,
        queueRows,
        handoff,
        watchItems,
        queueTitle,
        queueDescription,
        searchPlaceholder,
    };
};
