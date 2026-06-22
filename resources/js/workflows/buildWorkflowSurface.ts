import type { DashboardWorkflowKey, DashboardWorkflowWidget } from '@/types/dashboard';
import { buildAdminSurface } from '@/workflows/admin/surface';
import { buildCashierSurface } from '@/workflows/cashier/surface';
import { buildClinicianSurface } from '@/workflows/clinician/surface';
import { buildDirectServiceSurface } from '@/workflows/direct_service/surface';
import { buildEmergencySurface } from '@/workflows/emergency/surface';
import { buildFrontDeskSurface } from '@/workflows/front_desk/surface';
import { buildNursingSurface } from '@/workflows/nursing/surface';
import { buildOperationsSurface } from '@/workflows/operations/surface';
import { buildRecordsSurface } from '@/workflows/records/surface';
import { buildSupplySurface } from '@/workflows/supply/surface';
import {
    createWidgetGate,
    type DashboardSurfaceHelpers,
    type DashboardSurfaceRuntime,
    type WorkflowSurface,
    type WorkflowSurfaceBuilder,
} from '@/workflows/surfaceTypes';
import { buildTheatreSurface } from '@/workflows/theatre/surface';

const SURFACE_BUILDERS: Record<DashboardWorkflowKey, WorkflowSurfaceBuilder> = {
    admin: buildAdminSurface,
    emergency: buildEmergencySurface,
    operations: buildOperationsSurface,
    cashier: buildCashierSurface,
    clinician: buildClinicianSurface,
    records: buildRecordsSurface,
    nursing: buildNursingSurface,
    theatre: buildTheatreSurface,
    direct_service: buildDirectServiceSurface,
    supply: buildSupplySurface,
    front_desk: buildFrontDeskSurface,
};

export function buildWorkflowSurface(
    workflowKey: string,
    counts: Record<string, unknown>,
    lists: Record<string, unknown>,
    helpers: DashboardSurfaceHelpers,
    widgets: DashboardWorkflowWidget[] = [],
    runtime: DashboardSurfaceRuntime,
): WorkflowSurface | null {
    const builder = SURFACE_BUILDERS[workflowKey as DashboardWorkflowKey];
    if (!builder) {
        return null;
    }

    return builder({
        counts,
        lists,
        helpers,
        runtime,
        hasWidget: createWidgetGate(widgets),
    });
}
