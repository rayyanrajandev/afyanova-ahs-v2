import type { Reactive } from 'vue';

export type SupplyChainPageApi = Reactive<Record<string, any>>;

let pageApi: SupplyChainPageApi | null = null;

export function registerSupplyChainPageApi(api: SupplyChainPageApi): void {
    pageApi = api;
}

export function useSupplyChainPageApi(): SupplyChainPageApi {
    if (!pageApi) {
        throw new Error('Supply chain page API is not registered.');
    }

    return pageApi;
}

export function clearSupplyChainPageApi(): void {
    pageApi = null;
}

