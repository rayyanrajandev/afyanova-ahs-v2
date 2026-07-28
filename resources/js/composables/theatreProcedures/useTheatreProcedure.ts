import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { apiGet } from '@/lib/apiClient';
import type { TheatreProcedure } from './useTheatreProcedures';

type TheatreProcedureResponse = { data: TheatreProcedure };

export function useTheatreProcedure(
    procedureId: MaybeRefOrGetter<string | null | undefined>,
): UseQueryReturnType<TheatreProcedureResponse, Error> {
    return useQuery({
        queryKey: ['theatre-procedure', computed(() => toValue(procedureId))],
        queryFn: () => {
            const id = toValue(procedureId);
            if (!id) {
                throw new Error('A theatre procedure id is required.');
            }

            return apiGet<TheatreProcedureResponse>(`/theatre-procedures/${id}`);
        },
        enabled: computed(() => Boolean(toValue(procedureId))),
    });
}
