function readCookie(name: string): string | null {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));

    return match ? decodeURIComponent(match[1]) : null;
}

export function csrfRequestHeaders(): Record<string, string> {
    const xsrfToken = readCookie('XSRF-TOKEN');
    if (xsrfToken) {
        return { 'X-XSRF-TOKEN': xsrfToken };
    }

    const metaToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
    if (metaToken) {
        return { 'X-CSRF-TOKEN': metaToken };
    }

    return {};
}

export function setCsrfMetaToken(token: string | null | undefined): void {
    const normalized = token?.trim() ?? '';
    if (!normalized) return;

    const element = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    if (element) {
        element.content = normalized;
    }
}

export async function refreshCsrfToken(): Promise<void> {
    const response = await fetch('/api/v1/auth/csrf-token', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'Cache-Control': 'no-cache',
        },
    });

    const payload = (await response.json().catch(() => ({}))) as {
        token?: string | null;
        message?: string | null;
    };

    if (!response.ok) {
        const message = typeof payload.message === 'string' && payload.message.trim() !== ''
            ? payload.message
            : `Unable to refresh CSRF token (${response.status}).`;
        throw new Error(message);
    }

    setCsrfMetaToken(payload.token);
}
