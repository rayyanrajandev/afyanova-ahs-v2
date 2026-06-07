import type { Reactive } from 'vue';

export type InventoryWorkspaceApi = Reactive<Record<string, unknown>>;

let workspaceApi: InventoryWorkspaceApi | null = null;

export function registerInventoryWorkspace(api: InventoryWorkspaceApi): void {
    workspaceApi = api;
}

export function useInventoryWorkspace(): InventoryWorkspaceApi {
    if (!workspaceApi) {
        throw new Error('Inventory workspace API is not registered.');
    }

    return workspaceApi;
}

export function clearInventoryWorkspace(): void {
    workspaceApi = null;
}
