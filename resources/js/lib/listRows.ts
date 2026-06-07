/**
 * Shared status classes for registry dots and workflow queue stripes.
 */

export function activeInactiveStatusDotClass(status: string | null | undefined): string {
    if ((status ?? '').toLowerCase() === 'active') return 'bg-emerald-500';

    return 'bg-rose-500';
}

export function catalogTriStateStatusDotClass(status: string | null | undefined): string {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'bg-emerald-500';
    if (normalized === 'retired') return 'bg-rose-500';

    return 'bg-amber-500';
}

export function invoiceStatusDotClass(status: string | null | undefined): string {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'draft') return 'bg-slate-500';
    if (normalized === 'issued') return 'bg-sky-500';
    if (normalized === 'partially_paid') return 'bg-amber-500';
    if (normalized === 'paid') return 'bg-emerald-500';
    if (normalized === 'cancelled' || normalized === 'voided') return 'bg-rose-500';

    return 'bg-muted-foreground';
}

export function walkInServiceRequestStripeClass(status: string | null | undefined): string {
    switch (status) {
        case 'pending':
            return 'bg-amber-400';
        case 'in_progress':
            return 'bg-blue-500';
        case 'completed':
            return 'bg-emerald-500';
        case 'cancelled':
            return 'bg-red-400';
        default:
            return 'bg-muted-foreground/30';
    }
}

export function departmentRequisitionStripeClass(status: string | null | undefined): string {
    if (status === 'draft' || status === 'cancelled') return 'bg-muted-foreground/30';
    if (status === 'submitted') return 'bg-blue-500';
    if (status === 'approved') return 'bg-green-500';
    if (status === 'partially_issued') return 'bg-amber-400';
    if (status === 'issued') return 'bg-emerald-600';
    if (status === 'rejected') return 'bg-destructive';

    return 'bg-muted-foreground/30';
}

export function procurementRequestStripeClass(status: string | null | undefined): string {
    if (status === 'draft') return 'bg-muted-foreground/30';
    if (status === 'pending_approval') return 'bg-blue-400';
    if (status === 'approved') return 'bg-green-500';
    if (status === 'ordered') return 'bg-amber-500';
    if (status === 'received') return 'bg-emerald-500';
    if (status === 'rejected') return 'bg-red-500';
    if (status === 'cancelled') return 'bg-muted-foreground/20';

    return 'bg-muted-foreground/30';
}

export function shortageReadinessStripeClass(readyLineCount: number, waitingLineCount: number): string {
    if (readyLineCount > 0 && waitingLineCount === 0) return 'bg-green-500';
    if (readyLineCount > 0) return 'bg-amber-400';

    return 'bg-border';
}

export function stockMovementStripeClass(movementType: string | null | undefined): string {
    if (movementType === 'receive') return 'bg-green-500';
    if (movementType === 'issue') return 'bg-amber-500';
    if (movementType === 'adjust') return 'bg-blue-500';
    if (movementType === 'transfer') return 'bg-sky-500';

    return 'bg-muted-foreground/30';
}
