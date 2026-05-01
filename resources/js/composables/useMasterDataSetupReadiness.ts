import { computed, ref, unref, type Ref } from 'vue';

export type MasterDataSetupStepKey =
    | 'departments'
    | 'service_points'
    | 'ward_beds'
    | 'staff'
    | 'warehouses'
    | 'suppliers'
    | 'clinical'
    | 'pricing'
    | 'inventory'
    | 'opening_stock'
    | 'patients'
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

type MasterDataSetupReadinessOptions = {
    includeWardBeds?: boolean | Ref<boolean>;
};

const stepDefinitions: ReadonlyArray<{
    key: MasterDataSetupStepKey;
    label: string;
    href: string;
    description: string;
}> = [
    {
        key: 'departments',
        label: 'Departments',
        href: '/platform/admin/departments',
        description: 'Create the facility departments first so staff, service points, beds, orders, and reporting have a real operating structure.',
    },
    {
        key: 'service_points',
        label: 'Service Points',
        href: '/platform/admin/service-points',
        description: 'Register reception, OPD, laboratory, pharmacy, cashier, and other work areas where patients and staff actually move.',
    },
    {
        key: 'ward_beds',
        label: 'Wards & Beds',
        href: '/platform/admin/ward-beds',
        description: 'Create wards and bed numbers when the active facility plan includes inpatient or ward operations.',
    },
    {
        key: 'staff',
        label: 'Staff Profiles',
        href: '/staff',
        description: 'Create staff profiles and link verified users so duties, privileges, and accountability are traceable.',
    },
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
        label: 'Billable Service Catalog',
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
        key: 'patients',
        label: 'First Patient Registration',
        href: '/patients',
        description: 'Register the first real or test patient after facility structure and minimum catalogs are ready.',
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

export function useMasterDataSetupReadiness(options: MasterDataSetupReadinessOptions = {}) {
    const loading = ref(false);
    const summaries = ref<Record<MasterDataSetupStepKey, StepCountSummary>>({
        departments: { total: null, active: null, error: null },
        service_points: { total: null, active: null, error: null },
        ward_beds: { total: null, active: null, error: null },
        staff: { total: null, active: null, error: null },
        warehouses: { total: null, active: null, error: null },
        suppliers: { total: null, active: null, error: null },
        clinical: { total: null, active: null, error: null },
        pricing: { total: null, active: null, error: null },
        inventory: { total: null, active: null, error: null },
        opening_stock: { total: null, active: null, error: null },
        patients: { total: null, active: null, error: null },
        department_requisitions: { total: null, active: null, error: null },
        procurement_requests: { total: null, active: null, error: null },
    });
    const enabledStepDefinitions = computed(() =>
        stepDefinitions.filter((definition) =>
            definition.key !== 'ward_beds' || unref(options.includeWardBeds) === true,
        ),
    );

    async function loadSetupReadiness(stepKeys: MasterDataSetupStepKey[] | null = null): Promise<void> {
        loading.value = true;
        const enabledStepKeys = new Set(stepKeys ?? enabledStepDefinitions.value.map((definition) => definition.key));
        const shouldLoad = (key: MasterDataSetupStepKey): boolean => enabledStepKeys.has(key);
        const skipped = { total: null, active: null, error: null };

        const [
            departmentResult,
            servicePointResult,
            wardBedResult,
            staffResult,
            warehouseResult,
            supplierResult,
            clinicalResults,
            pricingResult,
            inventoryResult,
            openingStockResult,
            patientResult,
            departmentRequisitionResult,
            procurementRequestResult,
        ] = await Promise.allSettled([
            shouldLoad('departments') ? getJson<CountResponse>('/departments/status-counts') : Promise.resolve(null),
            shouldLoad('service_points') ? getJson<CountResponse>('/platform/admin/service-points/status-counts') : Promise.resolve(null),
            shouldLoad('ward_beds') ? getJson<CountResponse>('/platform/admin/ward-beds/status-counts') : Promise.resolve(null),
            shouldLoad('staff') ? getJson<CountResponse>('/staff/status-counts') : Promise.resolve(null),
            shouldLoad('warehouses') ? getJson<CountResponse>('/inventory-procurement/warehouses/status-counts') : Promise.resolve(null),
            shouldLoad('suppliers') ? getJson<CountResponse>('/inventory-procurement/suppliers/status-counts') : Promise.resolve(null),
            shouldLoad('clinical') ? Promise.all([
                getJson<CountResponse>('/platform/admin/clinical-catalogs/lab-tests/status-counts'),
                getJson<CountResponse>('/platform/admin/clinical-catalogs/radiology-procedures/status-counts'),
                getJson<CountResponse>('/platform/admin/clinical-catalogs/theatre-procedures/status-counts'),
                getJson<CountResponse>('/platform/admin/clinical-catalogs/formulary-items/status-counts'),
            ]) : Promise.resolve(null),
            shouldLoad('pricing') ? getJson<CountResponse>('/billing-service-catalog/items/status-counts') : Promise.resolve(null),
            shouldLoad('inventory') ? getJson<StockAlertCountResponse>('/inventory-procurement/stock-alert-counts') : Promise.resolve(null),
            shouldLoad('opening_stock') ? getJson<StockMovementSummaryResponse>('/inventory-procurement/stock-movements/summary', { movementType: 'receive' }) : Promise.resolve(null),
            shouldLoad('patients') ? getJson<CountResponse>('/patients/status-counts') : Promise.resolve(null),
            shouldLoad('department_requisitions') ? getJson<PagedCountResponse>('/inventory-procurement/department-requisitions', { perPage: 1 }) : Promise.resolve(null),
            shouldLoad('procurement_requests') ? getJson<PagedCountResponse>('/inventory-procurement/procurement-requests', { perPage: 1 }) : Promise.resolve(null),
        ]);

        if (departmentResult.status === 'fulfilled' && departmentResult.value !== null) {
            summaries.value.departments = {
                total: normalizeCount(departmentResult.value.data?.total),
                active: normalizeCount(departmentResult.value.data?.active),
                error: null,
            };
        } else if (departmentResult.status === 'fulfilled') {
            summaries.value.departments = skipped;
        } else {
            summaries.value.departments = { total: null, active: null, error: departmentResult.reason instanceof Error ? departmentResult.reason.message : 'Unavailable' };
        }

        if (servicePointResult.status === 'fulfilled' && servicePointResult.value !== null) {
            summaries.value.service_points = {
                total: normalizeCount(servicePointResult.value.data?.total),
                active: normalizeCount(servicePointResult.value.data?.active),
                error: null,
            };
        } else if (servicePointResult.status === 'fulfilled') {
            summaries.value.service_points = skipped;
        } else {
            summaries.value.service_points = { total: null, active: null, error: servicePointResult.reason instanceof Error ? servicePointResult.reason.message : 'Unavailable' };
        }

        if (wardBedResult.status === 'fulfilled' && wardBedResult.value !== null) {
            summaries.value.ward_beds = {
                total: normalizeCount(wardBedResult.value.data?.total),
                active: normalizeCount(wardBedResult.value.data?.active),
                error: null,
            };
        } else if (wardBedResult.status === 'fulfilled') {
            summaries.value.ward_beds = skipped;
        } else {
            summaries.value.ward_beds = { total: null, active: null, error: wardBedResult.reason instanceof Error ? wardBedResult.reason.message : 'Unavailable' };
        }

        if (staffResult.status === 'fulfilled' && staffResult.value !== null) {
            summaries.value.staff = {
                total: normalizeCount(staffResult.value.data?.total),
                active: normalizeCount(staffResult.value.data?.active),
                error: null,
            };
        } else if (staffResult.status === 'fulfilled') {
            summaries.value.staff = skipped;
        } else {
            summaries.value.staff = { total: null, active: null, error: staffResult.reason instanceof Error ? staffResult.reason.message : 'Unavailable' };
        }

        if (warehouseResult.status === 'fulfilled' && warehouseResult.value !== null) {
            summaries.value.warehouses = {
                total: normalizeCount(warehouseResult.value.data?.total),
                active: normalizeCount(warehouseResult.value.data?.active),
                error: null,
            };
        } else if (warehouseResult.status === 'fulfilled') {
            summaries.value.warehouses = skipped;
        } else {
            summaries.value.warehouses = { total: null, active: null, error: warehouseResult.reason instanceof Error ? warehouseResult.reason.message : 'Unavailable' };
        }

        if (supplierResult.status === 'fulfilled' && supplierResult.value !== null) {
            summaries.value.suppliers = {
                total: normalizeCount(supplierResult.value.data?.total),
                active: normalizeCount(supplierResult.value.data?.active),
                error: null,
            };
        } else if (supplierResult.status === 'fulfilled') {
            summaries.value.suppliers = skipped;
        } else {
            summaries.value.suppliers = { total: null, active: null, error: supplierResult.reason instanceof Error ? supplierResult.reason.message : 'Unavailable' };
        }

        if (clinicalResults.status === 'fulfilled' && clinicalResults.value !== null) {
            const total = clinicalResults.value.reduce((carry, response) => carry + (normalizeCount(response.data?.total) ?? 0), 0);
            const active = clinicalResults.value.reduce((carry, response) => carry + (normalizeCount(response.data?.active) ?? 0), 0);

            summaries.value.clinical = {
                total,
                active,
                error: null,
            };
        } else if (clinicalResults.status === 'fulfilled') {
            summaries.value.clinical = skipped;
        } else {
            summaries.value.clinical = { total: null, active: null, error: clinicalResults.reason instanceof Error ? clinicalResults.reason.message : 'Unavailable' };
        }

        if (pricingResult.status === 'fulfilled' && pricingResult.value !== null) {
            summaries.value.pricing = {
                total: normalizeCount(pricingResult.value.data?.total),
                active: normalizeCount(pricingResult.value.data?.active),
                error: null,
            };
        } else if (pricingResult.status === 'fulfilled') {
            summaries.value.pricing = skipped;
        } else {
            summaries.value.pricing = { total: null, active: null, error: pricingResult.reason instanceof Error ? pricingResult.reason.message : 'Unavailable' };
        }

        if (inventoryResult.status === 'fulfilled' && inventoryResult.value !== null) {
            summaries.value.inventory = {
                total: normalizeCount(inventoryResult.value.data?.total),
                active: normalizeCount(inventoryResult.value.data?.total),
                error: null,
            };
        } else if (inventoryResult.status === 'fulfilled') {
            summaries.value.inventory = skipped;
        } else {
            summaries.value.inventory = { total: null, active: null, error: inventoryResult.reason instanceof Error ? inventoryResult.reason.message : 'Unavailable' };
        }

        if (openingStockResult.status === 'fulfilled' && openingStockResult.value !== null) {
            const total = normalizeCount(openingStockResult.value.data?.receive ?? openingStockResult.value.data?.total);
            summaries.value.opening_stock = {
                total,
                active: total,
                error: null,
            };
        } else if (openingStockResult.status === 'fulfilled') {
            summaries.value.opening_stock = skipped;
        } else {
            summaries.value.opening_stock = { total: null, active: null, error: openingStockResult.reason instanceof Error ? openingStockResult.reason.message : 'Unavailable' };
        }

        if (patientResult.status === 'fulfilled' && patientResult.value !== null) {
            summaries.value.patients = {
                total: normalizeCount(patientResult.value.data?.total),
                active: normalizeCount(patientResult.value.data?.active),
                error: null,
            };
        } else if (patientResult.status === 'fulfilled') {
            summaries.value.patients = skipped;
        } else {
            summaries.value.patients = { total: null, active: null, error: patientResult.reason instanceof Error ? patientResult.reason.message : 'Unavailable' };
        }

        if (departmentRequisitionResult.status === 'fulfilled' && departmentRequisitionResult.value !== null) {
            summaries.value.department_requisitions = {
                total: normalizeCount(departmentRequisitionResult.value.meta?.total),
                active: normalizeCount(departmentRequisitionResult.value.meta?.total),
                error: null,
            };
        } else if (departmentRequisitionResult.status === 'fulfilled') {
            summaries.value.department_requisitions = skipped;
        } else {
            summaries.value.department_requisitions = { total: null, active: null, error: departmentRequisitionResult.reason instanceof Error ? departmentRequisitionResult.reason.message : 'Unavailable' };
        }

        if (procurementRequestResult.status === 'fulfilled' && procurementRequestResult.value !== null) {
            summaries.value.procurement_requests = {
                total: normalizeCount(procurementRequestResult.value.meta?.total),
                active: normalizeCount(procurementRequestResult.value.meta?.total),
                error: null,
            };
        } else if (procurementRequestResult.status === 'fulfilled') {
            summaries.value.procurement_requests = skipped;
        } else {
            summaries.value.procurement_requests = { total: null, active: null, error: procurementRequestResult.reason instanceof Error ? procurementRequestResult.reason.message : 'Unavailable' };
        }

        loading.value = false;
    }

    const steps = computed<MasterDataSetupStep[]>(() => enabledStepDefinitions.value.map((definition) => {
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

    const departmentReady = computed(() => (summaries.value.departments.total ?? 0) > 0);
    const servicePointReady = computed(() => (summaries.value.service_points.total ?? 0) > 0);
    const wardBedReady = computed(() => (summaries.value.ward_beds.total ?? 0) > 0);
    const staffReady = computed(() => (summaries.value.staff.total ?? 0) > 0);
    const warehouseReady = computed(() => (summaries.value.warehouses.total ?? 0) > 0);
    const supplierReady = computed(() => (summaries.value.suppliers.total ?? 0) > 0);
    const clinicalReady = computed(() => (summaries.value.clinical.total ?? 0) > 0);
    const pricingReady = computed(() => (summaries.value.pricing.total ?? 0) > 0);
    const inventoryReady = computed(() => (summaries.value.inventory.total ?? 0) > 0);
    const openingStockReady = computed(() => (summaries.value.opening_stock.total ?? 0) > 0);
    const patientRegistrationReady = computed(() => (summaries.value.patients.total ?? 0) > 0);
    const departmentRequisitionReady = computed(() => (summaries.value.department_requisitions.total ?? 0) > 0);
    const procurementRequestReady = computed(() => (summaries.value.procurement_requests.total ?? 0) > 0);
    const registryReady = computed(() => warehouseReady.value && supplierReady.value);

    return {
        loading,
        steps,
        readyStepCount,
        recommendedNextStep,
        departmentReady,
        servicePointReady,
        wardBedReady,
        staffReady,
        warehouseReady,
        supplierReady,
        clinicalReady,
        pricingReady,
        inventoryReady,
        openingStockReady,
        patientRegistrationReady,
        departmentRequisitionReady,
        procurementRequestReady,
        registryReady,
        loadSetupReadiness,
    };
}
