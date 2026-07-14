import { useStorage } from '@vueuse/core';
import { computed } from 'vue';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { findMappingForRole } from '@/config/roleNavMappings';

const ACTIVE_ROLE_STORAGE_KEY = 'afyanova-active-role-code';

function labelForRole(code: string): string {
    const mapping = findMappingForRole(code);
    if (mapping) return mapping.label;
    return code
        .replace(/^HOSPITAL\./i, '')
        .replace(/\./g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sectionsForRoleCode(code: string): import('@/config/appNavCatalog').NavSectionKey[] | null {
    return findMappingForRole(code)?.sections ?? null;
}

export function useActiveRole() {
    const { sessionRoleCodes } = usePlatformAccess();

    const storedRoleCode = useStorage<string | null>(ACTIVE_ROLE_STORAGE_KEY, null);

    const availableRoles = computed(() => {
        return sessionRoleCodes.value.map((code) => ({
            code,
            label: labelForRole(code),
        }));
    });

    const hasMultipleRoles = computed(() => sessionRoleCodes.value.length > 1);

    const activeRole = computed(() => {
        const code = storedRoleCode.value;
        if (code && sessionRoleCodes.value.includes(code)) {
            const sections = sectionsForRoleCode(code);
            return { code, label: labelForRole(code), sections };
        }
        return null;
    });

    const activeSections = computed(() => activeRole.value?.sections ?? null);

    function setActiveRole(code: string | null) {
        storedRoleCode.value = code;
    }

    return {
        activeRole,
        activeSections,
        availableRoles,
        hasMultipleRoles,
        setActiveRole,
    };
}
