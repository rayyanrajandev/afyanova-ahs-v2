/**
 * Builds an "Open X" link-out href into a clinical module page, carrying the
 * same patientId/appointmentId/focus-* query context the old Show.vue's
 * clinicalModuleHref built (see patients/chart/Show.vue). Shared by the
 * Timeline tab and the Orders tab's current-care action links.
 */
export function patientChartModuleHref(
    path: string,
    patientId: string,
    appointmentId: string | null,
    options?: {
        includeAppointment?: boolean;
        includeTabNew?: boolean;
        focusOrderId?: string | null;
        focusProcedureId?: string | null;
        focusInvoiceId?: string | null;
        reorderOfId?: string | null;
        addOnToOrderId?: string | null;
    },
): string {
    const query = new URLSearchParams({ patientId, from: 'patient-chart' });

    if (options?.includeTabNew) {
        query.set('tab', 'new');
    }
    if ((options?.includeAppointment ?? true) && appointmentId) {
        query.set('appointmentId', appointmentId);
    }
    if (options?.focusOrderId) query.set('focusOrderId', options.focusOrderId);
    if (options?.focusProcedureId) query.set('focusProcedureId', options.focusProcedureId);
    if (options?.focusInvoiceId) query.set('focusInvoiceId', options.focusInvoiceId);
    if (options?.reorderOfId) query.set('reorderOfId', options.reorderOfId);
    if (options?.addOnToOrderId) query.set('addOnToOrderId', options.addOnToOrderId);

    return `${path}?${query.toString()}`;
}
