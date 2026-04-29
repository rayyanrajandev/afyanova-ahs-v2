import { computed, ref } from 'vue';

export type MasterDataSetupStepKey =
    | 'warehouses'
    | 'suppliers'
    | 'clinical'
    | 'pricing'
    | 'inventory'
    | 'opening_stock'
    | 'department_requisitions'
    | 'procurement_requests';

type StepCountSummary = {
    total: number | null;
    active: number | null;
    error: string | null;
};

export type MasterDataSetupStep = {
    key: MasterDataSetupStepKey;
    label: string;
    href: string;
    description: string;
    total: number | null;
    active: number | null;
    ready: boolean;
    error: string | null;
};

type CountResponse = {
    data?: {
        total?: number | string | null;
        active?: number | string | null;
    } | null;
};

type StockAlertCountResponse = {
    data?: {
        total?: number | string | null;
    } | null;
};

type StockMovementSummaryResponse = {
    data?: {
        total?: number | string | null;
        receive?: number | string | null;
    } | null;
};

type PagedCountResponse = {
    meta?: {
        total?: number | string | null;
    } | null;
};

const stepDefinitions: ReadonlyArray<{
    key: MasterDataSetupStepKey;
    label: string;
    href: string;
    description: string;
}> = [
    {
        key: 'warehouses',
        label: 'Warehouses',
        href: '/inventory-procurement/warehouses',
        description: 'Create the physical stores first so stock can be received, transferred, and counted in a real location.',
    },
    {
        key: 'suppliers',
        label: 'Suppliers',
        href: '/inventory-procurement/suppliers',
        description: 'Register active suppliers before procurement and default sourcing start relying on master data.',
    },
    {
        key: 'clinical',
        label: 'Clinical Care Catalog',
        href: '/platform/admin/clinical-catalogs',
        description: 'Define what clinicians and cashiers select in care workflows: tests, procedures, and medicines.',
    },
    {
        key: 'pricing',
        label: 'Service Price List',
        href: '/billing-service-catalog',
        description: 'Create billable tariffs after the care definition exists so finance does not recreate codes and names.',
    },
    {
        key: 'inventory',
        label: 'Inventory Items',
        href: '/inventory-procurement',
        description: 'Register physical stock only after warehouse, supplier, and catalog foundations are ready.',
    },
    {
        key: 'opening_stock',
        label: 'Opening Stock',
        href: '/inventory-procurement?section=inventory',
        description: 'Load day-0 counted balances after item master data exists. This is setup stock, not a purchase or requisition.',
    },
    {
        key: 'department_requisitions',
        label: 'Department Requisitions',
        href: '/inventory-procurement?section=requisitions',
        description: 'Start live store demand with a department requesting stock from stores, not by editing quantities directly.',
    },
    {
        key: 'procurement_requests',
        label: 'Procurement Requests',
        href: '/inventory-procurement?section=procurement',
        description: 'Raise supplier procurement only after live demand or low-stock need is visible and auditable.',
    },
] as const;

function normalizeCount(value: number | string | null | undefined): number | null {
    if (value == null) return null;

    const numeric = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(numeric) ? numeric : null;
}

async function getJson<T>(path: string, query?: Record<string, string | number | null | undefined>): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);

    Object.entries(query ?? {}).forEach(([key, value]) => {
        if (value == null || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = typeof payload?.message === 'string' && payload.message.trim() !== ''
            ? payload.message.trim()
            : `${response.status} ${response.statusText}`;

        throw new Error(message);
    }

    return payload as T;
}

export function useMasterDataSetupReadiness() {
    const loading = ref(false);
    const summaries = ref<Record<MasterDataSetupStepKey, StepCountSummary>>({
        warehouses: { total: null, active: null, error: null },
        suppliers: { total: null, active: null, error: null },
        clinical: { total: null, active: null, error: null },
        pricing: { total: null, active: null, error: null },
        inventory: { total: null, active: null, error: null },
        opening_stock: { total: null, active: null, error: null },
        department_requisitions: { total: null, active: null, error: null },
        procurement_requests: { total: null, active: null, error: null },
    });

    async function loadSetupReadiness(): Promise<void> {
        loading.value = true;

        const [
            warehouseResult,
            supplierResult,
            clinicalResults,
            pricingResult,
            inventoryResult,
            openingStockResult,
            departmentRequisitionResult,
            procurementRequestResult,
        ] = await Promise.allSettled([
            getJson<CountResponse>('/inventory-procurement/warehouses/status-counts'),
            getJson<CountResponse>('/inventory-procurement/suppliers/status-counts'),
            Promise.all([
                getJson<CountResponse>('/platform/admin/clinical-catalogs/lab-tests/status-counts'),
                getJson<CountResponse>('/platform/admin/clinical-catalogs/radiology-procedures/status-counts'),
                getJson<CountResponse>('/platform/admin/clinical-catalogs/theatre-procedures/status-counts'),
                getJson<CountResponse>('/platform/admin/clinical-catalogs/formulary-items/status-counts'),
            ]),
            getJson<CountResponse>('/billing-service-catalog/items/status-counts'),
            getJson<StockAlertCountResponse>('/inventory-procurement/stock-alert-counts'),
            getJson<StockMovementSummaryResponse>('/inventory-procurement/stock-movements/summary', { movementType: 'receive' }),
            getJson<PagedCountResponse>('/inventory-procurement/department-requisitions', { perPage: 1 }),
            getJson<PagedCountResponse>('/inventory-procurement/procurement-requests', { perPage: 1 }),
        ]);

        if (warehouseResult.status === 'fulfilled') {
            summaries.value.warehouses = {
                total: normalizeCount(warehouseResult.value.data?.total),
                active: normalizeCount(warehouseResult.value.data?.active),
                error: null,
            };
        } else {
            summaries.value.warehouses = { total: null, active: null, error: warehouseResult.reason instanceof Error ? warehouseResult.reason.message : 'Unavailable' };
        }

        if (supplierResult.status === 'fulfilled') {
            summaries.value.suppliers = {
                total: normalizeCount(supplierResult.value.data?.total),
                active: normalizeCount(supplierResult.value.data?.active),
                error: null,
            };
        } else {
            summaries.value.suppliers = { total: null, active: null, error: supplierResult.reason instanceof Error ? supplierResult.reason.message : 'Unavailable' };
        }

        if (clinicalResults.status === 'fulfilled') {
            const total = clinicalResults.value.reduce((carry, response) => carry + (normalizeCount(response.data?.total) ?? 0), 0);
            const active = clinicalResults.value.reduce((carry, response) => carry + (normalizeCount(response.data?.active) ?? 0), 0);

            summaries.value.clinical = {
                total,
                active,
                error: null,
            };
        } else {
            summaries.value.clinical = { total: null, active: null, error: clinicalResults.reason instanceof Error ? clinicalResults.reason.message : 'Unavailable' };
        }

        if (pricingResult.status === 'fulfilled') {
            summaries.value.pricing = {
                total: normalizeCount(pricingResult.value.data?.total),
                active: normalizeCount(pricingResult.value.data?.active),
                error: null,
            };
        } else {
            summaries.value.pricing = { total: null, active: null, error: pricingResult.reason instanceof Error ? pricingResult.reason.message : 'Unavailable' };
        }

        if (inventoryResult.status === 'fulfilled') {
            summaries.value.inventory = {
                total: normalizeCount(inventoryResult.value.data?.total),
                active: normalizeCount(inventoryResult.value.data?.total),
                error: null,
            };
        } else {
            summaries.value.inventory = { total: null, active: null, error: inventoryResult.reason instanceof Error ? inventoryResult.reason.message : 'Unavailable' };
        }

        if (openingStockResult.status === 'fulfilled') {
            const total = normalizeCount(openingStockResult.value.data?.receive ?? openingStockResult.value.data?.total);
            summaries.value.opening_stock = {
                total,
                active: total,
                error: null,
            };
        } else {
            summaries.value.opening_stock = { total: null, active: null, error: openingStockResult.reason instanceof Error ? openingStockResult.reason.message : 'Unavailable' };
        }

        if (departmentRequisitionResult.status === 'fulfilled') {
            summaries.value.department_requisitions = {
                total: normalizeCount(departmentRequisitionResult.value.meta?.total),
                active: normalizeCount(departmentRequisitionResult.value.meta?.total),
                error: null,
            };
        } else {
            summaries.value.department_requisitions = { total: null, active: null, error: departmentRequisitionResult.reason instanceof Error ? departmentRequisitionResult.reason.message : 'Unavailable' };
        }

        if (procurementRequestResult.status === 'fulfilled') {
            summaries.value.procurement_requests = {
                total: normalizeCount(procurementRequestResult.value.meta?.total),
                active: normalizeCount(procurementRequestResult.value.meta?.total),
                error: null,
            };
        } else {
            summaries.value.procurement_requests = { total: null, active: null, error: procurementRequestResult.reason instanceof Error ? procurementRequestResult.reason.message : 'Unavailable' };
        }

        loading.value = false;
    }

    const steps = computed<MasterDataSetupStep[]>(() => stepDefinitions.map((definition) => {
        const summary = summaries.value[definition.key];
        const total = summary.total ?? 0;

        return {
            ...definition,
            total: summary.total,
            active: summary.active,
            ready: total > 0,
            error: summary.error,
        };
    }));

    const readyStepCount = computed(() => steps.value.filter((step) => step.ready).length);
    const recommendedNextStep = computed(() => steps.value.find((step) => !step.ready) ?? null);

    const warehouseReady = computed(() => (summaries.value.warehouses.total ?? 0) > 0);
    const supplierReady = computed(() => (summaries.value.suppliers.total ?? 0) > 0);
    const clinicalReady = computed(() => (summaries.value.clinical.total ?? 0) > 0);
    const pricingReady = computed(() => (summaries.value.pricing.total ?? 0) > 0);
    const inventoryReady = computed(() => (summaries.value.inventory.total ?? 0) > 0);
    const openingStockReady = computed(() => (summaries.value.opening_stock.total ?? 0) > 0);
    const departmentRequisitionReady = computed(() => (summaries.value.department_requisitions.total ?? 0) > 0);
    const procurementRequestReady = computed(() => (summaries.value.procurement_requests.total ?? 0) > 0);
    const registryReady = computed(() => warehouseReady.value && supplierReady.value);

    return {
        loading,
        steps,
        readyStepCount,
        recommendedNextStep,
        warehouseReady,
        supplierReady,
        clinicalReady,
        pricingReady,
        inventoryReady,
        openingStockReady,
        departmentRequisitionReady,
        procurementRequestReady,
        registryReady,
        loadSetupReadiness,
    };
}
