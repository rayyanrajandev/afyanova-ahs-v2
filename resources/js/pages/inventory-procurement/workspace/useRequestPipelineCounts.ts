import { ref } from 'vue';

export type RequestPipelineCounts = {
    submitted: number;
    approved: number;
    partiallyIssued: number;
    shortageWaiting: number;
    procurementPending: number;
    procurementApproved: number;
    procurementOrdered: number;
    procurementReceived: number;
    issued: number;
};

type PipelineCountResponse = { meta?: { total?: number; waitingLineCount?: number } };

type InventoryApiRequest = <T>(
    method: 'GET',
    path: string,
    opts?: { query?: Record<string, string | number | null> },
) => Promise<T>;

function metaTotal(response: PipelineCountResponse | null | undefined): number {
    return Number(response?.meta?.total ?? 0);
}

export function useRequestPipelineCounts(apiRequest: InventoryApiRequest) {
    const requestPipelineCounts = ref<RequestPipelineCounts>({
        submitted: 0,
        approved: 0,
        partiallyIssued: 0,
        shortageWaiting: 0,
        procurementPending: 0,
        procurementApproved: 0,
        procurementOrdered: 0,
        procurementReceived: 0,
        issued: 0,
    });

    async function loadRequestPipelineCounts(): Promise<void> {
        try {
            const [
                submitted,
                approved,
                partiallyIssued,
                issued,
                shortageWaiting,
                procurementPending,
                procurementApproved,
                procurementOrdered,
                procurementReceived,
            ] = await Promise.all([
                apiRequest<PipelineCountResponse>('GET', '/inventory-procurement/department-requisitions', { query: { status: 'submitted', page: 1, perPage: 1 } }),
                apiRequest<PipelineCountResponse>('GET', '/inventory-procurement/department-requisitions', { query: { status: 'approved', page: 1, perPage: 1 } }),
                apiRequest<PipelineCountResponse>('GET', '/inventory-procurement/department-requisitions', { query: { status: 'partially_issued', page: 1, perPage: 1 } }),
                apiRequest<PipelineCountResponse>('GET', '/inventory-procurement/department-requisitions', { query: { status: 'issued', page: 1, perPage: 1 } }),
                apiRequest<PipelineCountResponse>('GET', '/inventory-procurement/shortage-queue', { query: { readiness: 'waiting', page: 1, perPage: 1 } }),
                apiRequest<PipelineCountResponse>('GET', '/inventory-procurement/procurement-requests', { query: { status: 'pending_approval', page: 1, perPage: 1 } }),
                apiRequest<PipelineCountResponse>('GET', '/inventory-procurement/procurement-requests', { query: { status: 'approved', page: 1, perPage: 1 } }),
                apiRequest<PipelineCountResponse>('GET', '/inventory-procurement/procurement-requests', { query: { status: 'ordered', page: 1, perPage: 1 } }),
                apiRequest<PipelineCountResponse>('GET', '/inventory-procurement/procurement-requests', { query: { status: 'received', page: 1, perPage: 1 } }),
            ]);

            requestPipelineCounts.value = {
                submitted: metaTotal(submitted),
                approved: metaTotal(approved),
                partiallyIssued: metaTotal(partiallyIssued),
                shortageWaiting: Number(shortageWaiting.meta?.waitingLineCount ?? 0),
                procurementPending: metaTotal(procurementPending),
                procurementApproved: metaTotal(procurementApproved),
                procurementOrdered: metaTotal(procurementOrdered),
                procurementReceived: metaTotal(procurementReceived),
                issued: metaTotal(issued),
            };
        } catch {
            requestPipelineCounts.value = {
                submitted: 0,
                approved: 0,
                partiallyIssued: 0,
                shortageWaiting: 0,
                procurementPending: 0,
                procurementApproved: 0,
                procurementOrdered: 0,
                procurementReceived: 0,
                issued: 0,
            };
        }
    }

    return {
        requestPipelineCounts,
        loadRequestPipelineCounts,
    };
}
