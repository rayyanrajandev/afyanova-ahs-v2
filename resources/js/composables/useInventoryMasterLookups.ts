import { ref } from 'vue';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { apiRequestJson } from '@/lib/apiClient';

export type InventoryLookupOption = {
    id: string;
    name: string;
    code: string | null;
};

export type InventoryCategoryOption = {
    value: string;
    label: string;
    requiresExpiryTracking: boolean;
};

function normalizeLookupOption(
    row: Record<string, unknown>,
    nameKeys: string[],
    codeKeys: string[],
): InventoryLookupOption | null {
    const id = String(row.id ?? '').trim();
    if (!id) {
        return null;
    }

    const name = nameKeys.map((key) => row[key]).find((value) => typeof value === 'string' && value.trim()) as string | undefined;
    const code = codeKeys.map((key) => row[key]).find((value) => typeof value === 'string' && value.trim()) as string | undefined;

    return {
        id,
        name: name?.trim() ?? 'Unnamed',
        code: code?.trim() ?? null,
    };
}

export function useInventoryMasterLookups() {
    const { isFacilitySuperAdmin } = usePlatformAccess();

    const suppliers = ref<InventoryLookupOption[]>([]);
    const warehouses = ref<InventoryLookupOption[]>([]);
    const departments = ref<InventoryLookupOption[]>([]);
    const categoryOptions = ref<InventoryCategoryOption[]>([]);
    const lookupsLoading = ref(false);

    async function loadLookups(): Promise<void> {
        lookupsLoading.value = true;

        try {
            const [suppliersRes, warehousesRes, deptsRes, referenceRes] = await Promise.all([
                apiRequestJson<{ data: Record<string, unknown>[] }>('GET', '/inventory-procurement/suppliers', {
                    query: { perPage: 200, status: 'active' },
                }).catch(() => ({ data: [] })),
                apiRequestJson<{ data: Record<string, unknown>[] }>('GET', '/inventory-procurement/warehouses', {
                    query: { perPage: 200, status: 'active' },
                }).catch(() => ({ data: [] })),
                apiRequestJson<{ data: Record<string, unknown>[] }>('GET', '/departments', {
                    query: { perPage: 200, status: 'active' },
                }).catch(() => ({ data: [] })),
                apiRequestJson<{
                    categoryOptions?: Array<{
                        value: string;
                        label: string;
                        requiresExpiryTracking?: boolean;
                    }>;
                }>('GET', '/inventory-procurement/reference-data').catch(() => ({})),
            ]);

            suppliers.value = (suppliersRes.data ?? [])
                .map((row) => normalizeLookupOption(row, ['supplierName', 'name'], ['supplierCode', 'code']))
                .filter((row): row is InventoryLookupOption => row !== null);
            warehouses.value = (warehousesRes.data ?? [])
                .map((row) => normalizeLookupOption(row, ['warehouseName', 'name'], ['warehouseCode', 'code']))
                .filter((row): row is InventoryLookupOption => row !== null);
            departments.value = (deptsRes.data ?? [])
                .map((row) => normalizeLookupOption(row, ['name'], ['code']))
                .filter((row): row is InventoryLookupOption => row !== null);

            categoryOptions.value = (referenceRes.categoryOptions ?? []).map((option) => ({
                value: option.value,
                label: option.label,
                requiresExpiryTracking: Boolean(option.requiresExpiryTracking),
            }));
        } finally {
            lookupsLoading.value = false;
        }
    }

    function categoryRequiresExpiry(category: string | null | undefined): boolean {
        const match = categoryOptions.value.find((option) => option.value === category);
        return Boolean(match?.requiresExpiryTracking);
    }

    function lookupLabel(options: InventoryLookupOption[], id: string): string {
        const match = options.find((option) => option.id === id);
        if (!match) {
            return '—';
        }

        return match.code ? `${match.name} (${match.code})` : match.name;
    }

    return {
        suppliers,
        warehouses,
        departments,
        categoryOptions,
        lookupsLoading,
        loadLookups,
        categoryRequiresExpiry,
        lookupLabel,
        isFacilitySuperAdmin,
    };
}
