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

/**
 * Name predates the fix in routes/web.php's `encounters/by-appointment/{id}`
 * route — it used to render the pre-cutover encounters/Show.vue page
 * directly (a real bug, not intentional), so this helper's URL landed
 * clinicians on the legacy workspace with no way to reach WorkspaceV2 via an
 * appointment id. That route now resolves the encounter server-side and
 * redirects to the canonical encounters/{encounterId} route
 * (encounters/WorkspaceV2.vue), so this helper's actual behavior is no
 * longer "legacy" at all — kept the name to avoid a purely-cosmetic rename
 * touching every legacy-page caller (appointments/Index.vue,
 * medical-records/Index.vue) for no functional benefit.
 */
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
