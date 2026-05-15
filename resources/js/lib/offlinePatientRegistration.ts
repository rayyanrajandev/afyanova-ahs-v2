import { csrfRequestHeaders, refreshCsrfToken } from '@/lib/csrf';
import { generateRequestKey } from '@/lib/idempotency';

export type OfflinePatientRegistrationPayload = {
    firstName: string;
    middleName: string | null;
    lastName: string;
    gender: string;
    dateOfBirth: string;
    phone: string;
    email: string | null;
    nationalId: string | null;
    countryCode: string;
    region: string;
    district: string;
    addressLine: string;
    nextOfKinName: string | null;
    nextOfKinPhone: string | null;
};

export type OfflinePatientUpdatePayload = OfflinePatientRegistrationPayload;

export type OfflinePatientRegistrationStatus =
    | 'pending'
    | 'syncing'
    | 'synced'
    | 'failed';

export type OfflinePatientUpdateStatus = OfflinePatientRegistrationStatus;

export type OfflinePatientRegistrationRecord = {
    id: string;
    temporaryPatientNumber: string;
    idempotencyKey: string;
    payload: OfflinePatientRegistrationPayload;
    status: OfflinePatientRegistrationStatus;
    attempts: number;
    createdAt: string;
    updatedAt: string;
    syncedAt: string | null;
    error: string | null;
    cloudPatientId: string | null;
    cloudPatientNumber: string | null;
};

export type OfflinePatientUpdateRecord = {
    id: string;
    patientId: string;
    patientNumber: string | null;
    patientName: string;
    idempotencyKey: string;
    payload: OfflinePatientUpdatePayload;
    status: OfflinePatientUpdateStatus;
    attempts: number;
    createdAt: string;
    updatedAt: string;
    syncedAt: string | null;
    error: string | null;
};

export type OfflinePatientSyncResult = {
    attempted: number;
    synced: number;
    failed: number;
    remaining: number;
};

const DATABASE_NAME = 'afyanova-offline';
const DATABASE_VERSION = 2;
const REGISTRATION_STORE_NAME = 'patient-registration-outbox';
const UPDATE_STORE_NAME = 'patient-update-outbox';

let databasePromise: Promise<IDBDatabase> | null = null;

function nowIso(): string {
    return new Date().toISOString();
}

function randomSuffix(): string {
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
        const values = new Uint16Array(2);
        window.crypto.getRandomValues(values);
        return Array.from(values)
            .map((value) => value.toString(36).padStart(2, '0'))
            .join('')
            .slice(0, 4)
            .toUpperCase();
    }

    return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function generateOfflineId(): string {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
        return `offline-patient-${window.crypto.randomUUID()}`;
    }

    return `offline-patient-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function generateOfflineUpdateId(): string {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
        return `offline-patient-update-${window.crypto.randomUUID()}`;
    }

    return `offline-patient-update-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function generateTemporaryPatientNumber(createdAt: string): string {
    const date = createdAt.slice(0, 10).replaceAll('-', '');
    const time = createdAt.slice(11, 19).replaceAll(':', '');
    return `TMP-PAT-${date}-${time}-${randomSuffix()}`;
}

function ensureRegistrationStore(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(REGISTRATION_STORE_NAME)) {
        const store = db.createObjectStore(REGISTRATION_STORE_NAME, {
            keyPath: 'id',
        });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('temporaryPatientNumber', 'temporaryPatientNumber', {
            unique: true,
        });
    }
}

function ensureUpdateStore(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains(UPDATE_STORE_NAME)) {
        const store = db.createObjectStore(UPDATE_STORE_NAME, {
            keyPath: 'id',
        });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('patientId', 'patientId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
    }
}

function openDatabase(): Promise<IDBDatabase> {
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(
                new Error('Offline storage is not available in this browser.'),
            );
            return;
        }

        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            ensureRegistrationStore(db);
            ensureUpdateStore(db);
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
            reject(
                request.error ?? new Error('Unable to open offline storage.'),
            );
        request.onblocked = () =>
            reject(new Error('Offline storage is blocked by another tab.'));
    });

    return databasePromise;
}

async function withStore<T>(
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest<T> | void,
    storeName = REGISTRATION_STORE_NAME,
): Promise<T | undefined> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        let request: IDBRequest<T> | void;

        transaction.oncomplete = () =>
            resolve(request ? request.result : undefined);
        transaction.onerror = () =>
            reject(
                transaction.error ??
                    new Error('Offline storage transaction failed.'),
            );
        transaction.onabort = () =>
            reject(
                transaction.error ??
                    new Error('Offline storage transaction aborted.'),
            );

        request = callback(store);
    });
}

export async function enqueueOfflinePatientRegistration(
    payload: OfflinePatientRegistrationPayload,
): Promise<OfflinePatientRegistrationRecord> {
    const createdAt = nowIso();
    const record: OfflinePatientRegistrationRecord = {
        id: generateOfflineId(),
        temporaryPatientNumber: generateTemporaryPatientNumber(createdAt),
        idempotencyKey: generateRequestKey('offline-patient-registration'),
        payload,
        status: 'pending',
        attempts: 0,
        createdAt,
        updatedAt: createdAt,
        syncedAt: null,
        error: null,
        cloudPatientId: null,
        cloudPatientNumber: null,
    };

    await withStore('readwrite', (store) => store.add(record));

    return record;
}

export async function updateOfflinePatientRegistrationDraft(
    recordId: string,
    payload: OfflinePatientRegistrationPayload,
): Promise<OfflinePatientRegistrationRecord> {
    const record = await withStore<OfflinePatientRegistrationRecord>(
        'readonly',
        (store) => store.get(recordId),
    );

    if (!record) {
        throw new Error('Offline patient registration was not found.');
    }

    const updatedRecord: OfflinePatientRegistrationRecord = {
        ...record,
        payload,
        status: 'pending',
        updatedAt: nowIso(),
        error: null,
    };

    await saveOfflinePatientRegistration(updatedRecord);

    return updatedRecord;
}

export async function enqueueOfflinePatientUpdate(
    patient: { id: string; patientNumber: string | null; patientName: string },
    payload: OfflinePatientUpdatePayload,
): Promise<OfflinePatientUpdateRecord> {
    const createdAt = nowIso();
    const record: OfflinePatientUpdateRecord = {
        id: generateOfflineUpdateId(),
        patientId: patient.id,
        patientNumber: patient.patientNumber,
        patientName: patient.patientName,
        idempotencyKey: generateRequestKey('offline-patient-update'),
        payload,
        status: 'pending',
        attempts: 0,
        createdAt,
        updatedAt: createdAt,
        syncedAt: null,
        error: null,
    };

    await withStore(
        'readwrite',
        (store) => store.add(record),
        UPDATE_STORE_NAME,
    );

    return record;
}

export async function listOfflinePatientRegistrations(): Promise<
    OfflinePatientRegistrationRecord[]
> {
    const records = await withStore<OfflinePatientRegistrationRecord[]>(
        'readonly',
        (store) => store.getAll(),
    );

    return (records ?? []).sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
    );
}

export async function listOfflinePatientUpdates(): Promise<
    OfflinePatientUpdateRecord[]
> {
    const records = await withStore<OfflinePatientUpdateRecord[]>(
        'readonly',
        (store) => store.getAll(),
        UPDATE_STORE_NAME,
    );

    return (records ?? []).sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
    );
}

export async function countPendingOfflinePatientRegistrations(): Promise<number> {
    const records = await listOfflinePatientRegistrations();

    return records.filter(
        (record) => record.status === 'pending' || record.status === 'failed',
    ).length;
}

export async function countPendingOfflinePatientUpdates(): Promise<number> {
    const records = await listOfflinePatientUpdates();

    return records.filter(
        (record) => record.status === 'pending' || record.status === 'failed',
    ).length;
}

async function saveOfflinePatientRegistration(
    record: OfflinePatientRegistrationRecord,
): Promise<void> {
    await withStore('readwrite', (store) => store.put(record));
}

async function saveOfflinePatientUpdate(
    record: OfflinePatientUpdateRecord,
): Promise<void> {
    await withStore(
        'readwrite',
        (store) => store.put(record),
        UPDATE_STORE_NAME,
    );
}

function isNetworkFailure(error: unknown): boolean {
    if (typeof navigator !== 'undefined' && navigator.onLine === false)
        return true;
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    return (
        message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('load failed')
    );
}

export function isLikelyPatientOfflineFailure(error: unknown): boolean {
    return isNetworkFailure(error);
}

async function parseResponseJson(
    response: Response,
): Promise<Record<string, unknown>> {
    const text = await response.text();
    if (text.trim() === '') return {};

    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        return { message: text };
    }
}

async function postPatientToCloud(
    record: OfflinePatientRegistrationRecord,
    retryOnCsrfMismatch = true,
): Promise<Record<string, unknown>> {
    const response = await fetch('/api/v1/patients', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-Idempotency-Key': record.idempotencyKey,
            'X-Offline-Registration-Id': record.id,
            ...csrfRequestHeaders(),
        },
        body: JSON.stringify(record.payload),
    });

    if (response.status === 419 && retryOnCsrfMismatch) {
        await refreshCsrfToken();
        return postPatientToCloud(record, false);
    }

    const payload = await parseResponseJson(response);

    if (!response.ok) {
        const message =
            typeof payload.message === 'string' && payload.message.trim() !== ''
                ? payload.message
                : `${response.status} ${response.statusText}`;
        throw new Error(message);
    }

    return payload;
}

async function patchPatientToCloud(
    record: OfflinePatientUpdateRecord,
    retryOnCsrfMismatch = true,
): Promise<Record<string, unknown>> {
    const response = await fetch(`/api/v1/patients/${record.patientId}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-Idempotency-Key': record.idempotencyKey,
            'X-Offline-Update-Id': record.id,
            ...csrfRequestHeaders(),
        },
        body: JSON.stringify(record.payload),
    });

    if (response.status === 419 && retryOnCsrfMismatch) {
        await refreshCsrfToken();
        return patchPatientToCloud(record, false);
    }

    const payload = await parseResponseJson(response);

    if (!response.ok) {
        const message =
            typeof payload.message === 'string' && payload.message.trim() !== ''
                ? payload.message
                : `${response.status} ${response.statusText}`;
        throw new Error(message);
    }

    return payload;
}

function cloudPatientFromResponse(payload: Record<string, unknown>): {
    id: string | null;
    patientNumber: string | null;
} {
    const data = payload.data;
    if (!data || typeof data !== 'object') {
        return { id: null, patientNumber: null };
    }

    const patient = data as { id?: unknown; patientNumber?: unknown };

    return {
        id: typeof patient.id === 'string' ? patient.id : null,
        patientNumber:
            typeof patient.patientNumber === 'string'
                ? patient.patientNumber
                : null,
    };
}

export async function syncPendingOfflinePatientRegistrations(): Promise<OfflinePatientSyncResult> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const remaining = await countPendingOfflinePatientRegistrations();
        return { attempted: 0, synced: 0, failed: 0, remaining };
    }

    const records = (await listOfflinePatientRegistrations()).filter(
        (record) => record.status === 'pending' || record.status === 'failed',
    );

    let synced = 0;
    let failed = 0;

    for (const record of records) {
        const syncingRecord: OfflinePatientRegistrationRecord = {
            ...record,
            status: 'syncing',
            attempts: record.attempts + 1,
            updatedAt: nowIso(),
            error: null,
        };
        await saveOfflinePatientRegistration(syncingRecord);

        try {
            const responsePayload = await postPatientToCloud(syncingRecord);
            const cloudPatient = cloudPatientFromResponse(responsePayload);

            await saveOfflinePatientRegistration({
                ...syncingRecord,
                status: 'synced',
                syncedAt: nowIso(),
                updatedAt: nowIso(),
                cloudPatientId: cloudPatient.id,
                cloudPatientNumber: cloudPatient.patientNumber,
                error: null,
            });
            synced += 1;
        } catch (error) {
            const failedRecord: OfflinePatientRegistrationRecord = {
                ...syncingRecord,
                status: 'failed',
                updatedAt: nowIso(),
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unable to sync patient registration.',
            };
            await saveOfflinePatientRegistration(failedRecord);
            failed += 1;

            if (isNetworkFailure(error)) {
                break;
            }
        }
    }

    const remaining = await countPendingOfflinePatientRegistrations();

    return {
        attempted: records.length,
        synced,
        failed,
        remaining,
    };
}

export async function syncPendingOfflinePatientUpdates(): Promise<OfflinePatientSyncResult> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const remaining = await countPendingOfflinePatientUpdates();
        return { attempted: 0, synced: 0, failed: 0, remaining };
    }

    const records = (await listOfflinePatientUpdates()).filter(
        (record) => record.status === 'pending' || record.status === 'failed',
    );

    let synced = 0;
    let failed = 0;

    for (const record of records) {
        const syncingRecord: OfflinePatientUpdateRecord = {
            ...record,
            status: 'syncing',
            attempts: record.attempts + 1,
            updatedAt: nowIso(),
            error: null,
        };
        await saveOfflinePatientUpdate(syncingRecord);

        try {
            await patchPatientToCloud(syncingRecord);

            await saveOfflinePatientUpdate({
                ...syncingRecord,
                status: 'synced',
                syncedAt: nowIso(),
                updatedAt: nowIso(),
                error: null,
            });
            synced += 1;
        } catch (error) {
            const failedRecord: OfflinePatientUpdateRecord = {
                ...syncingRecord,
                status: 'failed',
                updatedAt: nowIso(),
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unable to sync patient update.',
            };
            await saveOfflinePatientUpdate(failedRecord);
            failed += 1;

            if (isNetworkFailure(error)) {
                break;
            }
        }
    }

    const remaining = await countPendingOfflinePatientUpdates();

    return {
        attempted: records.length,
        synced,
        failed,
        remaining,
    };
}

export function registerOfflinePatientServiceWorker(): void {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (import.meta.env.DEV) return;

    window.addEventListener('load', () => {
        void navigator.serviceWorker
            .register('/sw.js')
            .then(() => navigator.serviceWorker.ready)
            .then((registration) => {
                registration.active?.postMessage({
                    type: 'CACHE_PATIENT_NAVIGATION',
                    url: window.location.href,
                });
            })
            .catch(() => {
                // Offline registration still works without page refresh support.
            });
    });
}
