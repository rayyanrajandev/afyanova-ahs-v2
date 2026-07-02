import { reactive } from 'vue';
import { registerSupplyChainPageApi, type SupplyChainPageApi } from './supplyChainPageApi';

type SupplyChainPageBindings = Record<string, any>;

export function bindSupplyChainPageApi(bindings: SupplyChainPageBindings): SupplyChainPageApi {
    const api = reactive(bindings) as SupplyChainPageApi;
    registerSupplyChainPageApi(api);

    return api;
}


