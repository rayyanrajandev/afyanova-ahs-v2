export const SENSITIVE_BROWSER_STORAGE_DISABLED_MESSAGE =
    'Local browser draft storage is disabled for patient and clinical data.';

const SENSITIVE_LOCAL_STORAGE_KEYS = [
    'ptReg_draft_v1',
    'afya.medical-records.create-draft.v1',
    'patient-lookup.recent-searches.v1',
    'patient-lookup.recent-patients.v1',
    'admission-lookup.recent-searches.v1',
    'admission-lookup.recent-admissions.v1',
    'ahs.laboratory-orders.create-draft.v2',
    'ahs.pharmacy-orders.create-draft.v4',
    'ahs.radiology-orders.create-draft.v3',
    'ahs.theatre-procedures.create-draft.v1',
    'ahs.billing-invoices.create-draft.v1',
    'ahs.inventory-procurement.create-item-draft.v1',
] as const;

const SENSITIVE_SESSION_STORAGE_KEYS = [
    'opd.laboratory.auditExportRetry.lastHandoff',
    'opd.pharmacy.auditExportRetry.lastHandoff',
    'opd.billing.auditExportRetry.lastHandoff',
] as const;

export function clearSensitiveLocalStorageKey(key: string): void {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.removeItem(key);
    } catch {
        // Ignore storage failures; the policy goal is best-effort purge.
    }
}

export function clearSensitiveSessionStorageKey(key: string): void {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.removeItem(key);
    } catch {
        // Ignore storage failures; the policy goal is best-effort purge.
    }
}

export function purgeKnownSensitiveBrowserStorage(): void {
    SENSITIVE_LOCAL_STORAGE_KEYS.forEach(clearSensitiveLocalStorageKey);
    SENSITIVE_SESSION_STORAGE_KEYS.forEach(clearSensitiveSessionStorageKey);
}

export function sensitiveBrowserDraftStorageAllowed(): false {
    return false;
}
