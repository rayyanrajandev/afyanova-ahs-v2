export function encounterWorkspaceHref(
    encounterId: string,
    options?: { from?: string; patientId?: string; appointmentId?: string },
): string {
    const normalizedId = encounterId.trim();
    if (!normalizedId) {
        return '/medical-records';
    }

    const params = new URLSearchParams();
    if (options?.from?.trim()) {
        params.set('from', options.from.trim());
    }
    if (options?.patientId?.trim()) {
        params.set('patientId', options.patientId.trim());
    }
    if (options?.appointmentId?.trim()) {
        params.set('appointmentId', options.appointmentId.trim());
    }

    const query = params.toString();
    return query
        ? `/encounters/${normalizedId}?${query}`
        : `/encounters/${normalizedId}`;
}

export function encounterWorkspaceLegacyAppointmentHref(
    appointmentId: string,
    options?: { from?: string },
): string {
    const normalizedId = appointmentId.trim();
    if (!normalizedId) {
        return '/medical-records';
    }

    const params = new URLSearchParams();
    if (options?.from?.trim()) {
        params.set('from', options.from.trim());
    }

    const query = params.toString();
    return query
        ? `/encounters/by-appointment/${normalizedId}?${query}`
        : `/encounters/by-appointment/${normalizedId}`;
}

export function encounterWorkspaceHrefForRecord(
    record: {
        encounterId?: string | null;
        appointmentId?: string | null;
    },
    options?: { from?: string },
): string {
    const encounterId = record.encounterId?.trim() ?? '';
    if (encounterId) {
        return encounterWorkspaceHref(encounterId, options);
    }

    return encounterWorkspaceLegacyAppointmentHref(record.appointmentId ?? '', options);
}

export function parseEncounterReturnTo(value: string | null | undefined): string | null {
    const normalized = (value ?? '').trim();
    if (
        !normalized.startsWith('/encounters/')
        && !normalized.startsWith('/encounters/by-appointment/')
    ) {
        return null;
    }

    return normalized;
}

export function encounterReturnLabel(returnTo: string | null): string {
    return returnTo ? 'Return to encounter' : '';
}
