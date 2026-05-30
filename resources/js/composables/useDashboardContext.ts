import { usePage } from '@inertiajs/vue3';
import { computed, ref } from 'vue';
import {
    DASHBOARD_PRESETS,
    eligibleDashboardPresets,
    inferDashboardPreset,
    type InferDashboardPresetInput,
} from '@/config/dashboardPresets';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { apiGet } from '@/lib/apiClient';
import type { DashboardContextPayload, DashboardWorkflowDefinition, DashboardWorkflowKey } from '@/types/dashboard';

type DashboardPageProps = {
    dashboardContext?: DashboardContextPayload | null;
};

function isWorkflowKey(value: string): value is DashboardWorkflowKey {
    return DASHBOARD_PRESETS.some((preset) => preset.key === value);
}

export function useDashboardContext(initialContext?: DashboardContextPayload | null) {
    const page = usePage<DashboardPageProps>();
    const { hasPermission, isFacilitySuperAdmin, isPlatformSuperAdmin, sessionRoleCodes } = usePlatformAccess();

    const context = ref<DashboardContextPayload | null>(
        initialContext ?? page.props.dashboardContext ?? null,
    );
    const contextLoading = ref(false);
    const contextError = ref<string | null>(null);

    const presetContextInput = computed<InferDashboardPresetInput>(() => ({
        roleCodesUpper: context.value?.session.roleCodes ?? sessionRoleCodes.value,
        isFacilitySuperAdmin: isFacilitySuperAdmin.value,
        isPlatformSuperAdmin: isPlatformSuperAdmin.value,
        hasPermission,
    }));

    const clientEligibleKeys = computed(() => eligibleDashboardPresets(presetContextInput.value));
    const clientDefaultKey = computed(() => inferDashboardPreset(presetContextInput.value));

    const eligibleWorkflowKeys = computed<DashboardWorkflowKey[]>(() => {
        const fromServer = context.value?.eligibleWorkflowKeys ?? [];
        if (fromServer.length > 0) {
            return fromServer.filter(isWorkflowKey);
        }

        return clientEligibleKeys.value;
    });

    const defaultWorkflowKey = computed<DashboardWorkflowKey>(() => {
        const serverDefault = context.value?.defaultWorkflowKey;
        if (serverDefault && isWorkflowKey(serverDefault)) {
            return serverDefault;
        }

        return clientDefaultKey.value;
    });

    const workflowDefinitions = computed<DashboardWorkflowDefinition[]>(() => {
        if (context.value?.workflows?.length) {
            return context.value.workflows;
        }

        const eligible = new Set(eligibleWorkflowKeys.value);

        return DASHBOARD_PRESETS.filter((preset) => eligible.has(preset.key)).map((preset) => ({
            key: preset.key,
            label: preset.label,
            description: preset.description,
            modules: [...preset.modules],
        }));
    });

    const canSwitchWorkflow = computed(
        () => context.value?.canSwitchWorkflow ?? eligibleWorkflowKeys.value.length > 1,
    );

    async function refreshDashboardContext(): Promise<void> {
        contextLoading.value = true;
        contextError.value = null;
        try {
            const response = await apiGet<{ data: DashboardContextPayload }>('/dashboard/context');
            context.value = response?.data ?? null;
        } catch (error) {
            contextError.value = error instanceof Error ? error.message : 'Unable to refresh dashboard context.';
        } finally {
            contextLoading.value = false;
        }
    }

    return {
        context,
        contextLoading,
        contextError,
        eligibleWorkflowKeys,
        defaultWorkflowKey,
        workflowDefinitions,
        canSwitchWorkflow,
        refreshDashboardContext,
        presetContextInput,
    };
}
