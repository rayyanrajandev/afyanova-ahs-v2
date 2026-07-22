import { formatEnumLabel } from '@/lib/labels';
import type { SearchableSelectOption } from '@/lib/patientLocations';

// ---------------------------------------------------------------------------
// Service type constants
// ---------------------------------------------------------------------------

export const SERVICE_TYPE_OPTIONS = [
    'consultation',
    'laboratory',
    'radiology',
    'pharmacy',
    'procedure',
    'admission',
    'theatre',
    'imaging',
    'consumable',
    'other',
] as const;

export type ServiceType = (typeof SERVICE_TYPE_OPTIONS)[number];

/**
 * Service type tabs displayed in the catalog list.
 * "all" is a meta-tab that clears the service type filter.
 */
export const SERVICE_TYPE_TABS = [
    { value: '__all__', label: 'All', icon: 'layers' as const },
    { value: 'consultation', label: 'Consultation', icon: 'stethoscope' as const },
    { value: 'laboratory', label: 'Laboratory', icon: 'flask-conical' as const },
    { value: 'radiology', label: 'Radiology', icon: 'activity' as const },
    { value: 'pharmacy', label: 'Pharmacy', icon: 'pill' as const },
    { value: 'procedure', label: 'Procedures', icon: 'scissors' as const },
    { value: 'admission', label: 'Admission', icon: 'bed-double' as const },
    { value: 'theatre', label: 'Theatre', icon: 'heart-pulse' as const },
    { value: 'imaging', label: 'Imaging', icon: 'eye' as const },
    { value: 'consumable', label: 'Consumable', icon: 'package' as const },
    { value: 'other', label: 'Others', icon: 'tag' as const },
] as const;

// ---------------------------------------------------------------------------
// Unit options
// ---------------------------------------------------------------------------

export const UNIT_OPTIONS = ['service', 'study', 'test', 'item', 'session', 'day', 'procedure', 'dose', 'package'] as const;

export const PHARMACY_UNIT_OPTIONS = [
    'tablet', 'capsule', 'vial', 'ampoule', 'sachet', 'bottle', 'inhaler', 'pack', 'box', 'strip', 'dose', 'ml', 'mg', 'g', 'iu',
] as const;

// ---------------------------------------------------------------------------
// Facility tier options
// ---------------------------------------------------------------------------

export const FACILITY_TIER_OPTIONS = [
    { value: 'dispensary', label: 'Dispensary' },
    { value: 'health_centre', label: 'Health centre' },
    { value: 'district_hospital', label: 'District hospital' },
    { value: 'regional_hospital', label: 'Regional hospital' },
    { value: 'zonal_referral', label: 'Zonal referral' },
] as const;

// ---------------------------------------------------------------------------
// Clinical catalog source config
// ---------------------------------------------------------------------------

export type ClinicalCatalogType = 'lab_test' | 'radiology_procedure' | 'theatre_procedure' | 'clinical_procedure' | 'formulary_item';

export const CLINICAL_CATALOG_SOURCES = [
    { type: 'lab_test' as ClinicalCatalogType, path: '/platform/admin/clinical-catalogs/lab-tests', label: 'Lab Tests', defaultServiceType: 'laboratory' },
    { type: 'radiology_procedure' as ClinicalCatalogType, path: '/platform/admin/clinical-catalogs/radiology-procedures', label: 'Radiology', defaultServiceType: 'radiology' },
    { type: 'theatre_procedure' as ClinicalCatalogType, path: '/platform/admin/clinical-catalogs/theatre-procedures', label: 'Theatre Procedures', defaultServiceType: 'theatre' },
    { type: 'clinical_procedure' as ClinicalCatalogType, path: '/platform/admin/clinical-catalogs/clinical-procedures', label: 'Clinical Procedures', defaultServiceType: 'procedure' },
    { type: 'formulary_item' as ClinicalCatalogType, path: '/platform/admin/clinical-catalogs/formulary-items', label: 'Formulary', defaultServiceType: 'pharmacy' },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CatalogStatus = 'active' | 'inactive' | 'retired';

export type StandardsCodes = Partial<Record<'LOCAL' | 'LOINC' | 'SNOMED_CT' | 'NHIF' | 'MSD' | 'CPT' | 'ICD', string>>;

export type ClinicalCatalogLink = {
    id: string | null;
    catalogType: string | null;
    code: string | null;
    name: string | null;
    status: string | null;
};

export type CatalogItem = {
    id: string | null;
    tenantId: string | null;
    facilityId: string | null;
    clinicalCatalogItemId: string | null;
    serviceCode: string | null;
    versionNumber: number | null;
    serviceName: string | null;
    serviceType: string | null;
    departmentId: string | null;
    department: string | null;
    unit: string | null;
    priceUnit: string | null;
    unitsPerPack: number | null;
    basePrice: string | null;
    currencyCode: string | null;
    taxRatePercent: string | null;
    isTaxable: boolean | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    codes: StandardsCodes | null;
    facilityTier: string | null;
    linkWarning: string | null;
    standardsWarnings: string[] | null;
    status: CatalogStatus | null;
    statusReason: string | null;
    supersedesBillingServiceCatalogItemId: string | null;
    clinicalCatalogItem: ClinicalCatalogLink | null;
    createdAt: string | null;
    updatedAt: string | null;
};

export type CatalogStatusCounts = { active: number; inactive: number; retired: number; other: number; total: number };

export type ServiceTypeCounts = Record<string, number> & { total: number };

export type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };

export type CatalogListResponse = { data: CatalogItem[]; meta: Pagination };

export type CatalogResponse = { data: CatalogItem };

export type CatalogVersionsResponse = { data: CatalogItem[] };

export type CatalogPayerImpactSummary = {
    serviceCode: string | null;
    serviceType: string | null;
    department: string | null;
    currencyCode: string | null;
    activeContractCount: number;
    preAuthorizationContractCount: number;
    contractsWithMatchingRulesCount: number;
    matchingRuleCount: number;
    authorizationRequiredRuleCount: number;
    autoApproveRuleCount: number;
    serviceSpecificRuleCount: number;
    serviceTypeRuleCount: number;
    departmentRuleCount: number;
    coveragePercentMin: number | null;
    coveragePercentMax: number | null;
};

export type CatalogPayerImpactResponse = { data: CatalogPayerImpactSummary };

export type StatusCountResponse = { data: CatalogStatusCounts };

export type ServiceTypeCountResponse = { data: ServiceTypeCounts };

export type Department = {
    id: string | null;
    code: string | null;
    name: string | null;
    serviceType: string | null;
};

export type DepartmentListResponse = { data: Department[]; meta: Pagination };

export type CreateIdentitySource = 'clinical' | 'standalone';

export type ClinicalCatalogLookupBillingItem = {
    id: string | null;
    clinicalCatalogItemId: string | null;
    serviceCode: string | null;
    serviceName: string | null;
    status: string | null;
    versionNumber: number | null;
    basePrice: string | null;
    currencyCode: string | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
};

export type ClinicalCatalogLookupLink = {
    status: string | null;
    serviceCode: string | null;
    item: ClinicalCatalogLookupBillingItem | null;
};

export type ClinicalCatalogLookupItem = {
    id: string | null;
    catalogType: ClinicalCatalogType | null;
    code: string | null;
    name: string | null;
    departmentId: string | null;
    category: string | null;
    unit: string | null;
    description: string | null;
    codes: StandardsCodes | null;
    facilityTier: string | null;
    billingServiceCode: string | null;
    billingLinkStatus: string | null;
    billingLink: ClinicalCatalogLookupLink | null;
    metadata: Record<string, unknown> | null;
    status: string | null;
};

export type ClinicalCatalogLookupListResponse = { data: ClinicalCatalogLookupItem[]; meta: Pagination | null };

export type CatalogAuditLog = {
    id: string;
    billingServiceCatalogItemId: string | null;
    actorId: number | null;
    action: string | null;
    changes: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    createdAt: string | null;
};

export type CatalogAuditLogListResponse = { data: CatalogAuditLog[]; meta: Pagination };

export type ValidationErrorResponse = { message?: string; errors?: Record<string, string[]> };

export type ScopeData = {
    resolvedFrom: string;
    facility?: { name?: string | null; code?: string | null } | null;
    tenant?: { name?: string | null; code?: string | null } | null;
};

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function serviceTypeLabel(value: string): string {
    return formatEnumLabel(value);
}

export function buildDepartmentOptions(departments: Department[], preferredServiceType = ''): SearchableSelectOption[] {
    const normalizedServiceType = preferredServiceType.trim().toLowerCase();
    const source = normalizedServiceType
        ? departments.filter((department) => String(department.serviceType ?? '').trim().toLowerCase() === normalizedServiceType)
        : departments;

    return (source.length > 0 ? source : departments)
        .map((department) => {
            const id = String(department.id ?? '').trim();
            const name = String(department.name ?? '').trim();
            if (!id || !name) return null;

            const code = String(department.code ?? '').trim();
            const serviceType = String(department.serviceType ?? '').trim();

            return {
                value: id,
                label: code ? `${code} - ${name}` : name,
                description: serviceType ? `${formatEnumLabel(serviceType)} department` : 'Hospital department',
                keywords: [name, code, serviceType].filter((entry) => entry.trim().length > 0),
                group: serviceType ? formatEnumLabel(serviceType) : 'Other',
            } as SearchableSelectOption;
        })
        .filter((option): option is SearchableSelectOption => option !== null);
}

export function findDepartmentOption(options: SearchableSelectOption[], value: string): SearchableSelectOption | null {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) return null;

    return options.find((option) => option.value.trim().toLowerCase() === normalizedValue) ?? null;
}

export function clinicalCatalogSourceConfig(catalogType: string | null | undefined) {
    return CLINICAL_CATALOG_SOURCES.find((source) => source.type === catalogType) ?? null;
}

export function clinicalCatalogGroupLabel(catalogType: string | null | undefined): string {
    return clinicalCatalogSourceConfig(catalogType)?.label ?? 'Clinical Catalogs';
}

export function billingServiceTypeFromClinicalCatalogType(catalogType: string | null | undefined): string {
    return clinicalCatalogSourceConfig(catalogType)?.defaultServiceType ?? '';
}

export function normalizeServiceCode(value: string): string {
    return value.trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Formatting utilities
// ---------------------------------------------------------------------------

export function formatDateTime(value: string | null): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

export function formatMoney(value: string | null, currencyCode: string | null, fallbackCurrency = 'TZS'): string {
    const amount = Number.parseFloat(value ?? '');
    if (!Number.isFinite(amount)) {
        return `${value || '0.00'} ${currencyCode || fallbackCurrency}`;
    }

    return `${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} ${currencyCode || fallbackCurrency}`;
}

// ---------------------------------------------------------------------------
// Tariff lifecycle utilities
// ---------------------------------------------------------------------------

export function tariffWindowLabel(effectiveFrom: string | null, effectiveTo: string | null): string {
    if (!effectiveFrom && !effectiveTo) return 'No effective window configured';
    if (effectiveFrom && !effectiveTo) return `Effective from ${formatDateTime(effectiveFrom)}`;
    if (!effectiveFrom && effectiveTo) return `Valid until ${formatDateTime(effectiveTo)}`;

    return `${formatDateTime(effectiveFrom)} to ${formatDateTime(effectiveTo)}`;
}

export function tariffLifecycleLabel(effectiveFrom: string | null, effectiveTo: string | null): string {
    const now = new Date();
    const from = effectiveFrom ? new Date(effectiveFrom) : null;
    const to = effectiveTo ? new Date(effectiveTo) : null;

    if (from && !Number.isNaN(from.getTime()) && from > now) return 'Scheduled';
    if (to && !Number.isNaN(to.getTime()) && to < now) return 'Expired window';
    if (from || to) return 'Effective window active';

    return 'No window';
}

export function windowRangeValidationMessage(effectiveFromInput: string, effectiveToInput: string): string | null {
    const effectiveFrom = toApiDateTime(effectiveFromInput);
    const effectiveTo = toApiDateTime(effectiveToInput);

    if (!effectiveFrom || !effectiveTo) return null;

    const fromTime = new Date(effectiveFrom).getTime();
    const toTime = new Date(effectiveTo).getTime();
    if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return null;

    if (toTime <= fromTime) {
        return 'Effective to must be later than effective from.';
    }

    return null;
}

// ---------------------------------------------------------------------------
// Date/time input utilities
// ---------------------------------------------------------------------------

export function toDateTimeInput(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

export function datePartFromDateTimeInput(value: string): string {
    const normalized = value.trim();
    if (!normalized) return '';
    const splitIndex = normalized.indexOf('T');
    return splitIndex >= 0 ? normalized.slice(0, splitIndex) : normalized.slice(0, 10);
}

export function timePartFromDateTimeInput(value: string): string {
    const normalized = value.trim();
    if (!normalized) return '';
    const splitIndex = normalized.indexOf('T');
    if (splitIndex < 0) return '';
    return normalized.slice(splitIndex + 1, splitIndex + 6);
}

export function mergeDateAndTimeInput(datePart: string, timePart: string, fallbackTime: string): string {
    const normalizedDate = datePart.trim();
    if (!normalizedDate) return '';

    const normalizedTime = timePart.trim() || fallbackTime;
    return `${normalizedDate}T${normalizedTime}`;
}

export function toApiDateTime(value: string): string | null {
    const normalized = value.trim();
    if (!normalized) return null;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

// ---------------------------------------------------------------------------
// Parsing utilities
// ---------------------------------------------------------------------------

export function parseDecimalOrNull(value: string): number | null | 'invalid' {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return 'invalid';
    return parsed;
}

export function statusVariant(status: string | null): 'outline' | 'secondary' | 'destructive' {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'active') return 'secondary';
    if (normalized === 'inactive' || normalized === 'retired') return 'destructive';
    return 'outline';
}

export function catalogStatusDotClass(item: { effectiveFrom: string | null; effectiveTo: string | null; status: string | null }): string {
    const lifecycle = tariffLifecycleLabel(item.effectiveFrom, item.effectiveTo);
    if (lifecycle === 'Scheduled') return 'bg-blue-500';

    const status = String(item.status ?? '').toLowerCase();
    if (status === 'active') return 'bg-emerald-500';
    if (status === 'inactive') return 'bg-amber-500';
    if (status === 'retired') return 'bg-rose-500';
    return 'bg-slate-400';
}

// ---------------------------------------------------------------------------
// Metadata utilities
// ---------------------------------------------------------------------------

export function metadataObject(value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return null;
    if (typeof value !== 'object') return null;
    if (Object.keys(value as Record<string, unknown>).length === 0) return null;

    return value as Record<string, unknown>;
}

export function metadataHasContent(value: unknown): boolean {
    return metadataObject(value) !== null;
}

export function metadataToFormText(value: unknown): string {
    const object = metadataObject(value);
    if (!object) return '';

    return JSON.stringify(object, null, 2);
}

export function parseMetadata(text: string): Record<string, unknown> | 'invalid' {
    const normalized = text.trim();
    if (!normalized) return {};

    try {
        const parsed = JSON.parse(normalized);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return 'invalid';
        }
        return parsed as Record<string, unknown>;
    } catch {
        return 'invalid';
    }
}
