<?php

namespace App\Modules\ServiceRequest\Application\UseCases;

use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Modules\ServiceRequest\Application\Exceptions\ActiveServiceRequestAlreadyExistsException;
use App\Modules\ServiceRequest\Application\Exceptions\PatientNotEligibleForServiceRequestException;
use App\Modules\ServiceRequest\Domain\Repositories\ServiceRequestItemRepositoryInterface;
use App\Modules\ServiceRequest\Domain\Repositories\ServiceRequestRepositoryInterface;
use App\Modules\ServiceRequest\Domain\Services\PatientLookupServiceInterface;
use App\Modules\ServiceRequest\Domain\ValueObjects\ServiceRequestStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class CreateServiceRequestUseCase
{
    public function __construct(
        private readonly ServiceRequestRepositoryInterface $serviceRequestRepository,
        private readonly ServiceRequestItemRepositoryInterface $itemRepository,
        private readonly PatientLookupServiceInterface $patientLookupService,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
        private readonly AppendServiceRequestAuditEventUseCase $appendServiceRequestAuditEvent,
        private readonly FulfillServiceRequestItemsUseCase $fulfillItemsUseCase,
    ) {}

    public function execute(array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        if (isset($payload['appointment_id'])) {
            $aid = trim((string) $payload['appointment_id']);
            $payload['appointment_id'] = $aid !== '' ? $aid : null;
        }

        $patientId = (string) $payload['patient_id'];
        if (! $this->patientLookupService->patientExists($patientId)) {
            throw new PatientNotEligibleForServiceRequestException(
                'Service request can only be created for an existing patient.',
            );
        }

        $serviceType = (string) $payload['service_type'];
        $activeRequest = $this->serviceRequestRepository->findActiveForPatientAndServiceType($patientId, $serviceType);
        if ($activeRequest !== null) {
            throw new ActiveServiceRequestAlreadyExistsException($activeRequest);
        }

        if (isset($payload['items']) && is_array($payload['items'])) {
            $payload['items'] = array_map(
                static fn (array $item): array => [
                    'service_type' => $serviceType,
                    'catalog_item_id' => $item['catalog_item_id'] ?? $item['catalogItemId'] ?? null,
                    'item_name' => $item['item_name'] ?? $item['itemName'] ?? '',
                    'item_code' => $item['item_code'] ?? $item['itemCode'] ?? null,
                    'quantity' => $item['quantity'] ?? 1,
                    'clinical_indication' => $item['clinical_indication'] ?? $item['clinicalIndication'] ?? null,
                    'instructions' => $item['instructions'] ?? null,
                ],
                $payload['items'],
            );
        }

        $created = DB::transaction(function () use ($payload, $actorId, $serviceType): array {
            $payload['status'] = ServiceRequestStatus::IN_PROGRESS->value;
            $payload['request_number'] = $this->generateRequestNumber();
            $payload['tenant_id'] = $this->platformScopeContext->tenantId();
            $payload['facility_id'] = $this->platformScopeContext->facilityId();
            $payload['requested_by_user_id'] = $actorId;
            $payload['requested_at'] = now();
            $payload['acknowledged_at'] = now();
            $payload['acknowledged_by_user_id'] = $actorId;

            if (empty($payload['priority'])) {
                $payload['priority'] = 'routine';
            }

            $created = $this->serviceRequestRepository->create($payload);
            $id = (string) $created['id'];

            if (isset($payload['items']) && is_array($payload['items'])) {
                $this->itemRepository->createMany($id, $payload['items']);
            }

            $this->appendServiceRequestAuditEvent->execute(
                $id,
                'service_request.created',
                $actorId,
                null,
                ServiceRequestStatus::IN_PROGRESS->value,
                [
                    'patientId' => $created['patient_id'] ?? null,
                    'serviceType' => $created['service_type'] ?? null,
                    'departmentId' => $created['department_id'] ?? null,
                    'requestNumber' => $created['request_number'] ?? null,
                    'itemCount' => isset($payload['items']) ? count($payload['items']) : 0,
                ],
            );

            return $created;
        });

        $actorIdInt = is_int($actorId) ? $actorId : 0;
        $this->fulfillItemsUseCase->execute(
            serviceRequestId: (string) $created['id'],
            items: $this->itemRepository->findByServiceRequestId((string) $created['id']),
            actorId: $actorIdInt,
        );

        return $created;
    }

    private function generateRequestNumber(): string
    {
        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $candidate = 'SR'.now()->format('Ymd').strtoupper(Str::random(6));

            if (! $this->serviceRequestRepository->existsByRequestNumber($candidate)) {
                return $candidate;
            }
        }

        throw new RuntimeException('Unable to generate unique service request number.');
    }
}
