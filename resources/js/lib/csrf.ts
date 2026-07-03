/**
 * Read the XSRF-TOKEN cookie and return the header object for fetch / Axios
 * requests.
 *
 * Laravel encrypts the session CSRF token into this cookie via the
 * EncryptCookies middleware. VerifyCsrfToken decrypts the header value
 * and compares it against the session `_token`.
 *
 * Axios automatically reads XSRF-TOKEN and sends it as X-XSRF-TOKEN,
 * so this helper is only needed for manual `fetch()` calls.
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
 *  2. Returns the plain-text token in JSON
 *  3. Sets a fresh encrypted XSRF-TOKEN cookie via Set-Cookie
 *
 * Returns the new plain-text token so callers can update meta tags or
 * hidden `_token` fields. Deduplicates concurrent calls.
 */
let refreshPromise: Promise<string> | null = null;

export async function refreshCsrfToken(): Promise<string> {
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

        const data = (await response.json()) as { token?: string };
        const token = data?.token ?? '';

        if (token) {
            const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
            if (meta) {
                meta.content = token;
            }
        }

        return token;
    })().finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
}

function readCookie(name: string): string | null {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(
        new RegExp(`(?:^|; )${escapedName}=([^;]*)`),
    );

    return match ? decodeURIComponent(match[1]) : null;
}
