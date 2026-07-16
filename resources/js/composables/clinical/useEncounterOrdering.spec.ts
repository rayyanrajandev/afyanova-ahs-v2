import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import type {
    EncounterCareLaboratoryOrder,
    EncounterCarePharmacyOrder,
    EncounterCareRadiologyOrder,
    EncounterCareTheatreProcedure,
} from '@/lib/encounterWorkspaceCare';
import { useEncounterOrdering } from './useEncounterOrdering';

function labOrder(overrides: Partial<EncounterCareLaboratoryOrder> = {}): EncounterCareLaboratoryOrder {
    return {
        id: 'lab-1',
        orderNumber: 'LAB-1',
        orderedAt: '2026-01-01T00:00:00Z',
        testName: 'CBC',
        priority: 'routine',
        resultSummary: null,
        resultedAt: null,
        status: 'ordered',
        statusReason: null,
        ...overrides,
    };
}

async function mountOrdering(
    permissionNames: string[],
    build: (state: {
        onOrderChanged: ReturnType<typeof vi.fn>;
        laboratoryOrders: EncounterCareLaboratoryOrder[];
        pharmacyOrders: EncounterCarePharmacyOrder[];
        radiologyOrders: EncounterCareRadiologyOrder[];
        theatreProcedures: EncounterCareTheatreProcedure[];
    }) => ReturnType<typeof useEncounterOrdering>,
) {
    vi.spyOn(apiClient, 'apiGet').mockResolvedValue({
        data: permissionNames.map((name) => ({ name })),
    });

    const onOrderChanged = vi.fn();
    const laboratoryOrders = [labOrder()];
    const pharmacyOrders: EncounterCarePharmacyOrder[] = [];
    const radiologyOrders: EncounterCareRadiologyOrder[] = [];
    const theatreProcedures: EncounterCareTheatreProcedure[] = [];

    let ordering!: ReturnType<typeof useEncounterOrdering>;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const TestComponent = defineComponent({
        setup() {
            ordering = build({
                onOrderChanged,
                laboratoryOrders,
                pharmacyOrders,
                radiologyOrders,
                theatreProcedures,
            });
            return () => h('div');
        },
    });

    render(TestComponent, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));

    return { ordering, onOrderChanged, laboratoryOrders };
}

function baseOptions(overrides: Partial<Parameters<typeof useEncounterOrdering>[0]> = {}) {
    return {
        encounterId: () => 'enc-1',
        patientId: () => 'pat-1',
        appointmentId: () => null,
        admissionId: () => null,
        isLoading: () => false,
        loadError: () => null,
        laboratoryOrders: () => [],
        pharmacyOrders: () => [],
        radiologyOrders: () => [],
        theatreProcedures: () => [],
        onOrderChanged: () => {},
        ...overrides,
    };
}

describe('useEncounterOrdering', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('gates workflow visibility on both read and create permissions', async () => {
        const { ordering } = await mountOrdering(
            ['laboratory.orders.read'], // read but no create
            (state) => useEncounterOrdering(baseOptions({ laboratoryOrders: () => state.laboratoryOrders })),
        );

        expect(ordering.canOpenLaboratoryWorkflow.value).toBe(false);
    });

    it('opens the laboratory workflow when both read and create are granted', async () => {
        const { ordering } = await mountOrdering(
            ['laboratory.orders.read', 'lab.order'],
            (state) => useEncounterOrdering(baseOptions({ laboratoryOrders: () => state.laboratoryOrders })),
        );

        expect(ordering.canOpenLaboratoryWorkflow.value).toBe(true);
    });

    it('only includes care summaries for readable order types, sized by the real counts', async () => {
        const { ordering } = await mountOrdering(
            ['laboratory.orders.read', 'pharmacy.orders.read'],
            (state) =>
                useEncounterOrdering(
                    baseOptions({
                        laboratoryOrders: () => state.laboratoryOrders,
                        pharmacyOrders: () => state.pharmacyOrders,
                    }),
                ),
        );

        const ids = ordering.careSummaries.value.map((summary) => summary.id);
        expect(ids).toEqual(['laboratory-orders', 'pharmacy-orders']);
        expect(ordering.careSummaries.value[0].count).toBe(1);
        expect(ordering.careSummaries.value[0].state).toBe('active');
    });

    it('marks summaries as loading or issue based on the shared workspace fetch state', async () => {
        const { ordering } = await mountOrdering(['laboratory.orders.read'], () =>
            useEncounterOrdering(
                baseOptions({ isLoading: () => true, loadError: () => 'boom' }),
            ),
        );

        expect(ordering.careSummaries.value[0].state).toBe('loading');
    });

    it('requires a patient plus at least one visit link before allowing inline orders', async () => {
        const { ordering } = await mountOrdering([], () =>
            useEncounterOrdering(baseOptions({ patientId: () => '', encounterId: () => '' })),
        );

        expect(ordering.canUseInlineOrders()).toBe(false);
    });

    it('opens, then clears, the inline order dialog on close', async () => {
        const { ordering } = await mountOrdering([], () => useEncounterOrdering(baseOptions()));

        ordering.openInlineOrder('pharmacy');
        expect(ordering.inlineOrderType.value).toBe('pharmacy');
        expect(ordering.careTab.value).toBe('pharmacy-orders');

        ordering.closeInlineOrder();
        expect(ordering.inlineOrderType.value).toBeNull();
    });

    it('refreshes the workspace and closes the dialog when an inline order is created', async () => {
        const { ordering, onOrderChanged } = await mountOrdering([], (state) =>
            useEncounterOrdering(baseOptions({ onOrderChanged: state.onOrderChanged })),
        );

        ordering.openInlineOrder('laboratory');
        ordering.handleInlineOrderCreated('laboratory');

        expect(ordering.inlineOrderType.value).toBeNull();
        expect(onOrderChanged).toHaveBeenCalledTimes(1);
    });

    it('builds context-preserving hrefs with a returnTo back to the v2 workspace', async () => {
        const { ordering } = await mountOrdering([], () =>
            useEncounterOrdering(
                baseOptions({ appointmentId: () => 'appt-1' }),
            ),
        );

        const href = ordering.contextCreateHref('/theatre-procedures', { includeTabNew: true });
        expect(href).toContain('/theatre-procedures?');
        expect(href).toContain('tab=new');
        expect(href).toContain('patientId=pat-1');
        expect(href).toContain('encounterId=enc-1');
        expect(href).toContain('appointmentId=appt-1');
        expect(href).toContain('returnTo=%2Fencounters%2Fenc-1%2Fv2');
    });

    it('requires a non-empty reason before submitting a lifecycle action', async () => {
        const { ordering } = await mountOrdering([], () => useEncounterOrdering(baseOptions()));

        ordering.openLifecycleDialog('laboratory', 'lab-1', 'cancel');
        await ordering.submitLifecycleDialog();

        expect(ordering.lifecycleError.value).toBe('Clinical reason is required.');
    });

    it('submits the lifecycle action, refreshes the workspace, and closes the dialog on success', async () => {
        const postSpy = vi.spyOn(apiClient, 'apiPost').mockResolvedValue({
            data: labOrder({ status: 'cancelled' }),
        });
        const { ordering, onOrderChanged } = await mountOrdering([], (state) =>
            useEncounterOrdering(baseOptions({ onOrderChanged: state.onOrderChanged })),
        );

        ordering.openLifecycleDialog('laboratory', 'lab-1', 'cancel');
        ordering.lifecycleReason.value = 'Ordered in error';
        await ordering.submitLifecycleDialog();

        expect(postSpy).toHaveBeenCalledWith('/laboratory-orders/lab-1/lifecycle', {
            body: { action: 'cancel', reason: 'Ordered in error' },
        });
        expect(onOrderChanged).toHaveBeenCalledTimes(1);
        expect(ordering.lifecycleDialogOpen.value).toBe(false);
    });

    it('surfaces the server error and keeps the dialog open when the lifecycle action fails', async () => {
        vi.spyOn(apiClient, 'apiPost').mockRejectedValue(new Error('nope'));
        const { ordering, onOrderChanged } = await mountOrdering([], () =>
            useEncounterOrdering(baseOptions()),
        );

        ordering.openLifecycleDialog('laboratory', 'lab-1', 'cancel');
        ordering.lifecycleReason.value = 'Ordered in error';
        await ordering.submitLifecycleDialog();

        expect(ordering.lifecycleDialogOpen.value).toBe(true);
        expect(ordering.lifecycleError.value).toBe('nope');
        expect(onOrderChanged).not.toHaveBeenCalled();
    });

    it('names the lifecycle target from the matching order for the confirmation copy', async () => {
        const { ordering } = await mountOrdering([], (state) =>
            useEncounterOrdering(baseOptions({ laboratoryOrders: () => state.laboratoryOrders })),
        );

        ordering.openLifecycleDialog('laboratory', 'lab-1', 'cancel');
        expect(ordering.lifecycleTargetName()).toBe('CBC');
    });
});
