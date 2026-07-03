function readCookie(name: string): string | null {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));

    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Read the XSRF-TOKEN cookie and return the header object for fetch requests.
 *
 * The cookie is the **single source of truth** — no meta tag fallback.
 * Laravel encrypts the session CSRF token into this cookie via the
 * EncryptCookies middleware and VerifyCsrfToken compares the decrypted
 * header value against the session `_token`.
 */
export function csrfRequestHeaders(): Record<string, string> {
    const xsrfToken = readCookie('XSRF-TOKEN');
    if (xsrfToken) {
        return { 'X-XSRF-TOKEN': xsrfToken };
    }

    return {};
}

/**
 * Request a fresh CSRF token from the server.
 *
 * Calls the existing `GET /auth/csrf-token` endpoint which:
 *  1. Regenerates the session `_token` via `session()->regenerateToken()`
 *  2. Returns the response through EncryptCookies → sets a fresh XSRF-TOKEN cookie
 *
 * Deduplicates concurrent calls so multiple simultaneous 419 recoveries
 * only trigger one server round-trip.
 */
let refreshPromise: Promise<void> | null = null;

export async function refreshCsrfToken(): Promise<void> {
    if (refreshPromise) {
        return refreshPromise;
    }

    refreshPromise = (async () => {
        const response = await fetch('/auth/csrf-token', {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
        });

        if (!response.ok) {
            throw new Error(`Unable to refresh CSRF token (${response.status}).`);
        }

        const xsrfToken = readCookie('XSRF-TOKEN');
        if (xsrfToken) {
            const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
            if (meta) {
                meta.content = xsrfToken;
            }
        }
    })().finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
}
