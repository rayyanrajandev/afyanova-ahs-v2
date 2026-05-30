import type { DashboardWorkflowKey } from '@/types/dashboard';

export type ApiEnvelope<T> = { data: T; meta?: Record<string, unknown> };

export type DashboardBatchEntry = readonly [string, () => Promise<unknown>];

export type DashboardLoaderDeps = {
    guardedRequest: <T>(label: string, permission: string, callback: () => Promise<T>) => Promise<T | null>;
    apiGet: <T>(path: string, query?: Record<string, string | number | boolean>) => Promise<T>;
    currentUserId: number | null;
};

export type { DashboardWorkflowKey };
