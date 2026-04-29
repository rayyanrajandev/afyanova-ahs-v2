export type PatientChartHrefOptions = {
    tab?: string | null;
    recordId?: string | null;
    appointmentId?: string | null;
    admissionId?: string | null;
    from?: string | null;
};

export function patientChartHref(
    patientId: string,
    options?: PatientChartHrefOptions,
): string {
    const normalizedPatientId = patientId.trim();
    if (!normalizedPatientId) {
        return '/patients';
    }

    const params = new URLSearchParams();

    Object.entries(options ?? {}).forEach(([key, value]) => {
        const normalizedValue = String(value ?? '').trim();
        if (normalizedValue === '') return;
        params.set(key, normalizedValue);
    });

    const query = params.toString();
    const basePath = `/patients/${encodeURIComponent(normalizedPatientId)}/chart`;

    return query ? `${basePath}?${query}` : basePath;
}
