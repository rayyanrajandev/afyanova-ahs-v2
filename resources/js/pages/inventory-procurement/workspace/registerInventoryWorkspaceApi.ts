import { reactive, type Reactive } from 'vue';
import { registerInventoryWorkspace, type InventoryWorkspaceApi } from './inventoryWorkspaceApi';

type WorkspaceBindings = Record<string, unknown>;

export function bindInventoryWorkspace(bindings: WorkspaceBindings): InventoryWorkspaceApi {
    const api = reactive(bindings) as InventoryWorkspaceApi;
    registerInventoryWorkspace(api);

    return api;
}
