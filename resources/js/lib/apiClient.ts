import { csrfRequestHeaders } from '@/lib/csrf';
import { notifyFacilityEntitlementDenied } from '@/lib/facilityEntitlementNotify';

/** Laravel JSON API base (session + Sanctum-style web stack). */
export const API_V1_PREFIX = '/api/v1';

export type ApiJsonMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type ApiJsonQuery = Record<string, string | number | null | undefined>;

export type ApiJsonRequestOptions = {
    query?: ApiJsonQuery;
    /** JSON body for mutating methods (ignored for GET). */
    body?: Record<string, unknown>;
    /**
     * Shown in facility-entitlement toasts; defaults to the request path.
     * Use a short human label for noisy dashboards (e.g. "Admission counts").
     */
    entitlementContext?: string;
};

export class ApiClientError extends Error {
    readonly status: number;

    readonly payload: unknown;

    constructor(message: string, status: number, payload: unknown) {
        super(message);
        this.name = 'ApiClientError';
        this.status = status;
        this.payload = payload;
    }
}

export function isApiClientError(error: unknown): error is ApiClientError {
    return error instanceof ApiClientError;
}

function appendSearchParams(url: URL, query: ApiJsonQuery | undefined): void {
    Object.entries(query ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
            return;
        }
        url.searchParams.set(key, String(value));
    });
}

async function parseJsonBody(response: Response): Promise<unknown> {
    const text = await response.text();
    const trimmed = text.trim();
    if (trimmed === '') {
        return {};
    }
    try {
        return JSON.parse(trimmed) as unknown;
    } catch {
        return { message: trimmed };
    }
}

function messageFromFailurePayload(payload: unknown, status: number, statusText: string): string {
    if (payload && typeof payload === 'object' && 'message' in payload) {
        const message = (payload as { message?: unknown }).message;
        if (typeof message === 'string' && message.trim() !== '') {
            return message;
        }
    }
    return `${status} ${statusText}`;
}

/**
 * Single entry point for JSON calls under {@link API_V1_PREFIX}.
 * - Same-origin credentials, CSRF headers on mutating requests (cookie + meta via {@link csrfRequestHeaders}).
 * - On HTTP 403, surfaces facility subscription / entitlement feedback via {@link notifyFacilityEntitlementDenied}.
 * - Throws {@link ApiClientError} with `.payload` for validation and server messages.
 */
export async function apiRequestJson<T>(
    method: ApiJsonMethod,
    path: string,
    options?: ApiJsonRequestOptions,
): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${API_V1_PREFIX}${normalizedPath}`, window.location.origin);
    appendSearchParams(url, options?.query);

    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    let body: string | undefined;
    if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
        Object.assign(headers, csrfRequestHeaders());
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options?.body ?? {});
    } else if (method === 'DELETE') {
        Object.assign(headers, csrfRequestHeaders());
        if (options?.body !== undefined && Object.keys(options.body).length > 0) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(options.body);
        }
    }

    const response = await fetch(url.toString(), {
        method,
        credentials: 'same-origin',
        headers,
        body,
    });

    const payload = await parseJsonBody(response);

    if (!response.ok) {
        if (response.status === 403) {
            notifyFacilityEntitlementDenied(payload, options?.entitlementContext ?? normalizedPath);
        }
        throw new ApiClientError(
            messageFromFailurePayload(payload, response.status, response.statusText),
            response.status,
            payload,
        );
    }

    return payload as T;
}

export function apiGet<T>(path: string, query?: ApiJsonQuery, options?: Pick<ApiJsonRequestOptions, 'entitlementContext'>): Promise<T> {
    return apiRequestJson<T>('GET', path, { query, entitlementContext: options?.entitlementContext });
}

export function apiPost<T>(path: string, options?: ApiJsonRequestOptions): Promise<T> {
    return apiRequestJson<T>('POST', path, options);
}

export function apiPatch<T>(path: string, options?: ApiJsonRequestOptions): Promise<T> {
    return apiRequestJson<T>('PATCH', path, options);
}

export function apiPut<T>(path: string, options?: ApiJsonRequestOptions): Promise<T> {
    return apiRequestJson<T>('PUT', path, options);
}

export function apiDelete<T>(path: string, options?: ApiJsonRequestOptions): Promise<T> {
    return apiRequestJson<T>('DELETE', path, options);
}
