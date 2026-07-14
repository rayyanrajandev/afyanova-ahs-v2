import type { NavSectionKey } from '@/config/appNavCatalog';

export type RoleNavMapping = {
    label: string;
    match: (roleCode: string) => boolean;
    sections: NavSectionKey[];
};

function codeIncludes(...patterns: string[]): (code: string) => boolean {
    return (code: string) => patterns.some((p) => code.includes(p.toUpperCase()));
}

export const roleNavMappings: RoleNavMapping[] = [
    {
        label: 'Nurse',
        match: codeIncludes('NURSE'),
        sections: ['clinical_care', 'diagnostics', 'front_office'],
    },
    {
        label: 'Registration Clerk',
        match: codeIncludes('REGISTRATION', 'CLERK', 'RECEPTION', 'FRONT.DESK'),
        sections: ['front_office', 'billing'],
    },
    {
        label: 'Doctor / Clinician',
        match: codeIncludes('DOCTOR', 'CLINICIAN', 'PHYSICIAN', 'MEDICAL.OFFICER'),
        sections: ['clinical_care', 'diagnostics', 'front_office'],
    },
    {
        label: 'Lab Technician',
        match: codeIncludes('LAB', 'LABORATORY'),
        sections: ['diagnostics'],
    },
    {
        label: 'Pharmacist',
        match: codeIncludes('PHARMACY', 'PHARMACIST'),
        sections: ['diagnostics'],
    },
    {
        label: 'Billing Clerk',
        match: codeIncludes('BILLING', 'FINANCE', 'CASHIER'),
        sections: ['billing', 'front_office'],
    },
    {
        label: 'Storekeeper',
        match: codeIncludes('INVENTORY', 'STORE', 'SUPPLY'),
        sections: ['stores'],
    },
    {
        label: 'Administrator',
        match: codeIncludes('ADMIN', 'SUPER.ADMIN', 'SUPER_ADMIN'),
        sections: ['front_office', 'clinical_care', 'diagnostics', 'billing', 'stores', 'people', 'facility_setup', 'system_access'],
    },
    {
        label: 'People / HR',
        match: codeIncludes('HR', 'PEOPLE', 'CREDENTIALING', 'STAFF'),
        sections: ['people'],
    },
];

export function findMappingForRole(roleCode: string): RoleNavMapping | undefined {
    return roleNavMappings.find((m) => m.match(roleCode));
}

export function sectionsForRole(roleCode: string): NavSectionKey[] | null {
    return findMappingForRole(roleCode)?.sections ?? null;
}
