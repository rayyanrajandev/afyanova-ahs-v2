import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { apiGet } from '@/lib/apiClient';

export type OrderCompletionNotification = {
    orderType: 'laboratory' | 'pharmacy' | 'radiology';
    orderId: string;
    patientId: string | null;
    patientName: string | null;
    patientNumber: string | null;
    appointmentId: string | null;
    label: string | null;
    completedAt: string | null;
};

type OrderCompletionNotificationsResponse = { data: OrderCompletionNotification[] };

/**
 * GET /patient-flow/notifications (Phase 4, Mode B of
 * reports/queue-based-workflow-modernization-plan.md) — gated server-side by
 * config/patient_flow_automation.php's mode_b_notifications flag, not here:
 * this composable always polls and simply renders whatever comes back,
 * mirroring how Reception's Mode C flag lives entirely in application code,
 * never in a frontend conditional. When the flag is off, the list is always
 * empty and the badge never appears.
 */
export function useOrderCompletionBadge(): UseQueryReturnType<OrderCompletionNotification[], Error> {
    return useQuery({
        queryKey: ['patient-flow-notifications'],
        queryFn: async () => {
            const response = await apiGet<OrderCompletionNotificationsResponse>('/patient-flow/notifications');
            return response.data;
        },
        refetchInterval: 30_000,
    });
}
