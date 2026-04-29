<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Domain\Repositories\BillingPayerContractRepositoryInterface;
use App\Modules\Billing\Domain\Repositories\PatientInsuranceRepositoryInterface;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;

class DetermineBillingRouteUseCase
{
    public function __construct(
        private readonly PatientInsuranceRepositoryInterface $patientInsuranceRepository,
        private readonly BillingPayerContractRepositoryInterface $payerContractRepository,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
    ) {}

    /**
     * Determine the billing route for a patient
     *
     * @param array<string, mixed> $payload
     *
     * @return array<string, mixed>
     */
    public function execute(array $payload): array
    {
        $patientId = (string) $payload['patient_id'];
        $serviceId = $payload['service_id'] ?? null;

        $route = $this->determineRoute($patientId, $serviceId);

        return $route;
    }

    /**
     * @return array<string, mixed>
     */
    private function determineRoute(string $patientId, ?string $serviceId): array
    {
        $tenantId = $this->platformScopeContext->tenantId();
        $facilityId = $this->platformScopeContext->facilityId();

        // Check for active insurance
        $activeInsurance = $this->patientInsuranceRepository->findActiveInsurance(
            $patientId,
            $tenantId
        );

        if ($activeInsurance === null || $activeInsurance['status'] !== 'active') {
            // No active insurance = cash billing
            return [
                'routing_decision' => 'cash',
                'payer_type' => 'self_pay',
                'payer_id' => null,
                'payer_name' => 'Patient (Cash)',
                'use_insurance_pricing' => false,
                'reason' => 'No active insurance found',
            ];
        }

        // Has insurance - verify it covers this service
        $insuranceProvider = $activeInsurance['insurance_provider'];
        $policyNumber = $activeInsurance['policy_number'];

        // Get payer contract for this insurance provider
        $contract = $this->payerContractRepository->findActiveContractByProvider(
            $insuranceProvider,
            $tenantId,
            $facilityId
        );

        if ($contract === null) {
            // Insurance exists but no contract = route to cash (can't bill insurance)
            return [
                'routing_decision' => 'cash',
                'payer_type' => 'self_pay_unverified_insurance',
                'payer_id' => null,
                'payer_name' => 'Patient (Insurance unverified)',
                'use_insurance_pricing' => false,
                'reason' => 'No active contract for insurance provider',
            ];
        }

        // Has active contract
        return [
            'routing_decision' => 'insurance',
            'payer_type' => 'insurance',
            'payer_id' => $contract['id'] ?? $contract['billing_payer_contract_id'],
            'payer_name' => $insuranceProvider,
            'use_insurance_pricing' => true,
            'insurance_type' => $activeInsurance['insurance_type'],
            'policy_number' => $policyNumber,
            'coverage_level' => $activeInsurance['coverage_level'] ?? null,
            'reason' => 'Active insurance with valid contract',
        ];
    }
}
