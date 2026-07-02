import { ref } from 'vue';

export type QueryValue = string | number | null | undefined;

export function setQueryParam(params: URLSearchParams, key: string, value: QueryValue): void {
    if (value === null || value === undefined) {
        params.delete(key);
        return;
    }

    const normalized = String(value).trim();
    if (!normalized) {
        params.delete(key);
        return;
    }

    params.set(key, normalized);
}

export function replaceUrlQuery(update: (params: URLSearchParams) => void): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    update(params);

    const nextQuery = params.toString();
    const nextUrl = `${url.pathname}${nextQuery ? `?${nextQuery}` : ''}${url.hash}`;
    const currentUrl = `${url.pathname}${url.search}${url.hash}`;

    if (nextUrl !== currentUrl) {
        window.history.replaceState(window.history.state, '', nextUrl);
    }
}

export function useUrlQueryState() {
    const hydrated = ref(false);

    return {
        hydrated,
        setQueryParam,
        replaceUrlQuery,
    };
}
