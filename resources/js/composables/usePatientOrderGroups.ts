import { computed, ref, watch, type Ref } from 'vue';
import {
    groupDirectServiceOrdersByPatient,
    shouldDefaultExpandPatientGroup,
    type DirectServiceModuleKey,
    type DirectServiceOrderLike,
    type PatientOrderGroup,
} from '@/lib/directServicePatientWorklist';

export function usePatientOrderGroups<T extends DirectServiceOrderLike>(
    orders: Ref<T[]>,
    moduleKey: DirectServiceModuleKey,
    focusPatientId: Ref<string>,
) {
    const expandedPatientGroups = ref<Set<string>>(new Set());

    const patientOrderGroups = computed<PatientOrderGroup<T>[]>(() =>
        groupDirectServiceOrdersByPatient(orders.value, moduleKey),
    );

    const useGroupedQueueView = computed(() => patientOrderGroups.value.length > 0);

    function syncExpandedPatientGroups(): void {
        const groups = patientOrderGroups.value;
        const next = new Set<string>();

        for (const group of groups) {
            if (shouldDefaultExpandPatientGroup(group.patientId, focusPatientId.value, groups.length)) {
                next.add(group.patientId);
            }
        }

        expandedPatientGroups.value = next;
    }

    watch([patientOrderGroups, focusPatientId], syncExpandedPatientGroups, { immediate: true });

    function isPatientGroupExpanded(patientId: string): boolean {
        return expandedPatientGroups.value.has(patientId);
    }

    function setPatientGroupExpanded(patientId: string, open: boolean): void {
        const next = new Set(expandedPatientGroups.value);
        if (open) {
            next.add(patientId);
        } else {
            next.delete(patientId);
        }
        expandedPatientGroups.value = next;
    }

    function togglePatientGroup(patientId: string): void {
        setPatientGroupExpanded(patientId, !isPatientGroupExpanded(patientId));
    }

    return {
        patientOrderGroups,
        useGroupedQueueView,
        expandedPatientGroups,
        isPatientGroupExpanded,
        setPatientGroupExpanded,
        togglePatientGroup,
    };
}
