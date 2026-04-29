export type ClinicalStockPrecheckLine = {
    recipeItemId: string;
    inventoryItemId: string | null;
    itemCode: string | null;
    itemName: string | null;
    category: string | null;
    inventoryStatus: string | null;
    unit: string | null;
    quantityPerOrder: number | null;
    wasteFactorPercent: number | null;
    requiredQuantity: number | null;
    currentStock: number | null;
    remainingStockAfterPlannedUse: number | null;
    reorderLevel: number | null;
    stockState: string | null;
    enoughStock: boolean;
    blockingReason: string | null;
    consumptionStage: string | null;
    notes: string | null;
};

export type ClinicalStockPrecheck = {
    supported: boolean;
    status:
        | 'not_supported'
        | 'no_catalog_item'
        | 'no_recipe'
        | 'ready'
        | 'insufficient'
        | string;
    blocking: boolean;
    summary: string;
    lineCount: number;
    insufficientLineCount: number;
    lines: ClinicalStockPrecheckLine[];
};

export function formatClinicalStockQuantity(
    value: number | string | null | undefined,
): string {
    const numeric = Number(value ?? 0);

    if (!Number.isFinite(numeric)) {
        return '0';
    }

    return numeric.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    });
}

export function clinicalStockPrecheckTitle(
    precheck: ClinicalStockPrecheck | null | undefined,
): string {
    switch (precheck?.status) {
        case 'insufficient':
            return 'Stock not ready for completion';
        case 'ready':
            return 'Stock ready for completion';
        case 'no_recipe':
            return 'No stock recipe configured';
        case 'no_catalog_item':
            return 'Catalog link missing';
        default:
            return 'Stock readiness';
    }
}
