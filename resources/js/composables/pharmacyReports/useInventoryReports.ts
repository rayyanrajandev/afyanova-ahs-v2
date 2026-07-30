import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { toRef, toValue, type MaybeRefOrGetter } from 'vue';
import { apiGet } from '@/lib/apiClient';

export type InventoryReportFilters = {
    from: string;
    to: string;
    q: string;
    category?: string;
    warehouseId?: string;
    manufacturer?: string;
    itemId?: string;
    page?: number;
    perPage?: number;
};

export type PaginationMeta = {
    currentPage: number;
    perPage: number;
    total: number;
    lastPage: number;
};

export type StockStatusItem = {
    id: string;
    itemCode: string;
    itemName: string;
    category: string | null;
    currentStock: number;
    reservedStock: number;
    availableStock: number;
    reorderLevel: number;
    maxStockLevel: number | null;
    unit: string | null;
    stockState: string;
    manufacturer: string | null;
    lastMovementDate: string | null;
    status: string | null;
};

export type LowStockItem = {
    id: string;
    itemCode: string;
    itemName: string;
    category: string | null;
    currentStock: number;
    reorderLevel: number;
    unit: string | null;
    stockRatio: number;
    manufacturer: string | null;
};

export type OutOfStockItem = {
    id: string;
    itemCode: string;
    itemName: string;
    category: string | null;
    currentStock: number;
    reorderLevel: number;
    unit: string | null;
    manufacturer: string | null;
    lastStockedAt: string | null;
    daysOutOfStock: number | null;
};

export type NearExpiryItem = {
    id: string;
    itemId: string;
    itemCode: string;
    itemName: string;
    batchNumber: string | null;
    lotNumber: string | null;
    expiryDate: string | null;
    quantity: number;
    unitCost: number | null;
    estimatedValue: number | null;
    daysUntilExpiry: number;
    urgency: string;
    warehouseId: string | null;
};

export type ExpiredItem = {
    id: string;
    itemId: string;
    itemCode: string;
    itemName: string;
    batchNumber: string | null;
    expiryDate: string | null;
    quantity: number;
    unitCost: number | null;
    estimatedValue: number | null;
    daysSinceExpiry: number;
    warehouseId: string | null;
};

type PaginatedResponse<T> = {
    data: T[];
    meta: PaginationMeta;
};

type NearExpiryResponse = PaginatedResponse<NearExpiryItem> & {
    summary: { criticalCount: number; warningCount: number };
};

type ExpiredResponse = PaginatedResponse<ExpiredItem> & {
    summary: { totalCount: number; totalValue: number };
};

export type StockStatusResponse = PaginatedResponse<StockStatusItem>;
export type LowStockResponse = PaginatedResponse<LowStockItem>;
export type OutOfStockResponse = PaginatedResponse<OutOfStockItem>;

function filterQuery(filters: InventoryReportFilters) {
    return {
        q: filters.q.trim() || null,
        category: filters.category || null,
        warehouseId: filters.warehouseId || null,
        manufacturer: filters.manufacturer || null,
        itemId: filters.itemId || null,
        page: filters.page || null,
        perPage: filters.perPage || null,
    };
}

function useInventoryQuery<T>(key: string, path: string, filters: MaybeRefOrGetter<InventoryReportFilters>, extra?: Record<string, string | number | null>): UseQueryReturnType<T, Error> {
    const filtersRef = toRef(() => toValue(filters));
    return useQuery({
        queryKey: ['pharmacy-reports', 'inventory', key, filtersRef],
        queryFn: () => apiGet<T>(path, { ...(extra ?? {}), ...filterQuery(toValue(filtersRef)) }),
    });
}

export function useStockStatus(filters: MaybeRefOrGetter<InventoryReportFilters>): UseQueryReturnType<StockStatusResponse, Error> {
    return useInventoryQuery<StockStatusResponse>('stock-status', '/pharmacy-reports/inventory/stock-status', filters);
}

export function useLowStock(filters: MaybeRefOrGetter<InventoryReportFilters>): UseQueryReturnType<LowStockResponse, Error> {
    return useInventoryQuery<LowStockResponse>('low-stock', '/pharmacy-reports/inventory/low-stock', filters);
}

export function useOutOfStock(filters: MaybeRefOrGetter<InventoryReportFilters>): UseQueryReturnType<OutOfStockResponse, Error> {
    return useInventoryQuery<OutOfStockResponse>('out-of-stock', '/pharmacy-reports/inventory/out-of-stock', filters);
}

export function useNearExpiry(filters: MaybeRefOrGetter<InventoryReportFilters>): UseQueryReturnType<NearExpiryResponse, Error> {
    return useInventoryQuery<NearExpiryResponse>('near-expiry', '/pharmacy-reports/inventory/near-expiry', filters, { warningDays: 90, criticalDays: 30 });
}

export function useExpired(filters: MaybeRefOrGetter<InventoryReportFilters>): UseQueryReturnType<ExpiredResponse, Error> {
    return useInventoryQuery<ExpiredResponse>('expired', '/pharmacy-reports/inventory/expired', filters);
}
