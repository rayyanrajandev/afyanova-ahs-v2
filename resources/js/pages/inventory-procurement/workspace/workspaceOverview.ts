import type { InventoryWorkspaceSection } from '@/lib/inventoryProcurement';

export type WorkspaceNextActionTone = 'danger' | 'warning' | 'success' | 'neutral';

export type WorkspaceNextAction = {
    key: string;
    label: string;
    value: string | number;
    helper: string;
    icon: string;
    tone: WorkspaceNextActionTone;
    target: InventoryWorkspaceSection;
};

export type RequestPipelineStage = {
    key: string;
    label: string;
    value: number;
    helper: string;
    icon: string;
    target: InventoryWorkspaceSection;
    status?: string;
    readiness?: 'all' | 'ready' | 'waiting';
    kind: 'requisition' | 'shortage' | 'procurement';
};

export function nextActionClass(tone: WorkspaceNextActionTone): string {
    if (tone === 'danger') return 'border-destructive/30 bg-destructive/5 text-destructive';
    if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100';
    if (tone === 'success') return 'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-100';

    return 'border-sidebar-border/70 bg-card text-foreground';
}
