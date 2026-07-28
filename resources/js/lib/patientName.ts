export interface PatientNameParts {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
}

export function formatPatientName(patient: PatientNameParts | null | undefined): string {
    if (!patient) return '';

    return [patient.firstName, patient.middleName, patient.lastName]
        .filter((part): part is string => part != null && part !== '')
        .join(' ')
        .toUpperCase();
}

export function patientInitials(patient: PatientNameParts | null | undefined): string {
    if (!patient) return '?';
    const first = patient.firstName?.trim()?.[0] ?? '';
    const last = patient.lastName?.trim()?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
}
