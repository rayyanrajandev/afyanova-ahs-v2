export type PlatformRoleRiskTier = 'hospital' | 'platform' | 'system' | 'other';
export type PlatformRoleAssignmentPolicy = 'full' | 'hospital_operational';

export type PlatformRoleAssignmentOption = {
    id: string | null;
    name: string | null;
    code: string | null;
    riskTier?: PlatformRoleRiskTier | null;
    isElevated?: boolean | null;
};

export type PlatformRoleAssignmentGroup = {
    key: PlatformRoleRiskTier;
    label: string;
    description: string;
    roles: PlatformRoleAssignmentOption[];
};

export function normalizeRoleCode(code: string | null | undefined): string {
    return String(code ?? '')
        .trim()
        .toUpperCase();
}

export function resolvePlatformRoleRiskTier(code: string | null | undefined): PlatformRoleRiskTier {
    const normalized = normalizeRoleCode(code);

    if (normalized === '') {
        return 'other';
    }

    if (normalized.includes('SUPER.ADMIN') || normalized.startsWith('SYSTEM.')) {
        return 'system';
    }

    if (normalized.startsWith('PLATFORM.')) {
        return 'platform';
    }

    if (normalized.startsWith('HOSPITAL.')) {
        return 'hospital';
    }

    return 'other';
}

export function isElevatedPlatformRole(code: string | null | undefined, isElevated?: boolean | null): boolean {
    if (isElevated === true) {
        return true;
    }

    const normalized = normalizeRoleCode(code);

    return (
        normalized.startsWith('PLATFORM.') ||
        normalized.includes('SUPER.ADMIN') ||
        normalized === 'HOSPITAL.FACILITY.ADMIN'
    );
}

const GROUP_META: Record<PlatformRoleRiskTier, { label: string; description: string }> = {
    hospital: {
        label: 'Hospital operational',
        description: 'Day-to-day clinical and administrative access within a facility.',
    },
    platform: {
        label: 'Platform administration',
        description: 'Tenant-wide IAM, configuration, and cross-facility platform controls.',
    },
    system: {
        label: 'System / super admin',
        description: 'Highest privilege. Grant only to break-glass or platform owner accounts.',
    },
    other: {
        label: 'Other roles',
        description: 'Custom or legacy roles outside standard naming tiers.',
    },
};

const GROUP_ORDER: PlatformRoleRiskTier[] = ['hospital', 'platform', 'system', 'other'];

export function groupPlatformRolesForAssignment(roles: PlatformRoleAssignmentOption[]): PlatformRoleAssignmentGroup[] {
    const buckets: Record<PlatformRoleRiskTier, PlatformRoleAssignmentOption[]> = {
        hospital: [],
        platform: [],
        system: [],
        other: [],
    };

    for (const role of roles) {
        const tier = role.riskTier ?? resolvePlatformRoleRiskTier(role.code);
        buckets[tier].push(role);
    }

    for (const tier of GROUP_ORDER) {
        buckets[tier].sort((left, right) => {
            const leftLabel = String(left.name ?? left.code ?? left.id ?? '').toLowerCase();
            const rightLabel = String(right.name ?? right.code ?? right.id ?? '').toLowerCase();

            return leftLabel.localeCompare(rightLabel);
        });
    }

    return GROUP_ORDER.map((key) => ({
        key,
        label: GROUP_META[key].label,
        description: GROUP_META[key].description,
        roles: buckets[key],
    })).filter((group) => group.roles.length > 0);
}

export function selectedElevatedPlatformRoles(
    roles: PlatformRoleAssignmentOption[],
    selectedRoleIds: string[],
): PlatformRoleAssignmentOption[] {
    const selected = new Set(selectedRoleIds.map((value) => String(value)));

    return roles.filter((role) => {
        const roleId = String(role.id ?? '');
        if (!roleId || !selected.has(roleId)) {
            return false;
        }

        return isElevatedPlatformRole(role.code, role.isElevated);
    });
}
