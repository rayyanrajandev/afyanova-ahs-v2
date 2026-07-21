import { useMutation, type UseMutationReturnType } from '@tanstack/vue-query';
import { apiDelete } from '@/lib/apiClient';

export function useDeleteConsultationMapping(): UseMutationReturnType<void, Error, string, unknown> {
    return useMutation({
        mutationFn: async (id: string) => {
            await apiDelete(`/consultation-mappings/${id}`);
        },
    });
}
