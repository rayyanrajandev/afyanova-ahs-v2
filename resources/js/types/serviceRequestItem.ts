export type ServiceRequestItemInput = {
    catalogItemId: string | null;
    itemName: string;
    itemCode: string | null;
    quantity: number;
    clinicalIndication?: string | null;
    instructions?: string | null;
};

export type ServiceRequestItemStatus = 'pending' | 'processing' | 'ordered' | 'completed' | 'failed' | 'cancelled';

export type ServiceRequestItem = ServiceRequestItemInput & {
    id: string;
    serviceRequestId: string;
    serviceType: string;
    status: ServiceRequestItemStatus;
    sortOrder: number;
    requestedByUserId: number | null;
    requestedAt: string | null;
    orderedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    cancelledAt: string | null;
    failureReason: string | null;
};
