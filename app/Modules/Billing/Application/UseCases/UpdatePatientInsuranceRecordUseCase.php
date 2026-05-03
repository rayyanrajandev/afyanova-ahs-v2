<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Domain\Repositories\PatientInsuranceRepositoryInterface;
use App\Modules\Billing\Infrastructure\Repositories\PatientInsuranceAuditEventRepository;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;

class UpdatePatientInsuranceRecordUseCase
{
    public function __construct(
        private readonly PatientInsuranceRepositoryInterface $repository,
        private readonly PatientInsuranceAuditEventRepository $auditEventRepository,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(string $patientId, string $recordId, array $payload, ?int $actorId = null): ?array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $existing = $this->repository->findById($recordId);
        if ($existing === null || ($existing['patient_id'] ?? null) !== $patientId) {
            return null;
        }

        $updated = $this->repository->update($recordId, $this->normalizedPayload($payload));

        $this->auditEventRepository->write(
            patientInsuranceRecordId: $recordId,
            patientId: $patientId,
            action: 'patient-insurance.updated',
            actorId: $actorId,
            changes: [
                'before' => $this->trackedFields($existing),
                'after' => $this->trackedFields($updated),
            ],
        );

        return $updated;
    }

    private function normalizedPayload(array $payload): array
    {
        $attributes = [];
        $mapping = [
            'billing_payer_contract_id',
            'insurance_type',
            'insurance_provider',
            'provider_code',
            'plan_name',
            'policy_number',
            'member_id',
            'principal_member_name',
            'relationship_to_principal',
            'card_number',
            'effective_date',
            'expiry_date',
            'coverage_level',
            'copay_percent',
            'coverage_limit_amount',
            'status',
            'verification_status',
            'verification_date',
            'verification_source',
            'verification_reference',
            'last_verified_at',
            'verified_by_user_id',
            'notes',
            'metadata',
        ];

        foreach ($mapping as $field) {
            if (! array_key_exists($field, $payload)) {
                continue;
            }

            $attributes[$field] = $this->normalizeField($field, $payload[$field]);
        }

        return $attributes;
    }

    private function normalizeField(string $field, mixed $value): mixed
    {
        if (in_array($field, ['insurance_type', 'provider_code', 'relationship_to_principal', 'status', 'verification_status'], true)) {
            $normalized = strtolower(trim((string) $value));

            return $normalized === '' ? null : $normalized;
        }

        if (in_array($field, ['copay_percent', 'coverage_limit_amount'], true)) {
            return $value === null || $value === '' ? null : round((float) $value, 2);
        }

        if ($field === 'metadata') {
            return is_array($value) ? $value : null;
        }

        if (is_string($value)) {
            $normalized = trim($value);

            return $normalized === '' ? null : $normalized;
        }

        return $value;
    }

    private function trackedFields(array $record): array
    {
        return array_intersect_key($record, array_flip([
            'billing_payer_contract_id',
            'insurance_type',
            'insurance_provider',
            'provider_code',
            'plan_name',
            'policy_number',
            'member_id',
            'card_number',
            'effective_date',
            'expiry_date',
            'coverage_level',
            'copay_percent',
            'coverage_limit_amount',
            'status',
            'verification_status',
            'verification_reference',
            'last_verified_at',
        ]));
    }
}
