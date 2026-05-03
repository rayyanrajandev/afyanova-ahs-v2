<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Domain\Repositories\BillingPayerContractRepositoryInterface;

class ListPatientInsuranceOptionsUseCase
{
    public function __construct(
        private readonly BillingPayerContractRepositoryInterface $payerContractRepository,
    ) {}

    public function execute(array $filters = []): array
    {
        $contracts = $this->payerContractRepository->search(
            query: $filters['query'] ?? null,
            payerType: 'insurance',
            status: 'active',
            currencyCode: null,
            requiresPreAuthorization: null,
            page: 1,
            perPage: 50,
            sortBy: 'payer_name',
            sortDirection: 'asc',
        );

        return [
            'providerPresets' => $this->providerPresets(),
            'payerContracts' => array_map(
                static fn (array $contract): array => [
                    'id' => $contract['id'] ?? null,
                    'contractCode' => $contract['contract_code'] ?? null,
                    'contractName' => $contract['contract_name'] ?? null,
                    'payerName' => $contract['payer_name'] ?? null,
                    'payerPlanCode' => $contract['payer_plan_code'] ?? null,
                    'payerPlanName' => $contract['payer_plan_name'] ?? null,
                    'defaultCoveragePercent' => $contract['default_coverage_percent'] ?? null,
                    'requiresPreAuthorization' => $contract['requires_pre_authorization'] ?? false,
                ],
                $contracts['data'] ?? [],
            ),
        ];
    }

    private function providerPresets(): array
    {
        return [
            ['code' => 'nhif', 'name' => 'NHIF', 'category' => 'government'],
            ['code' => 'uhi', 'name' => 'Universal Health Insurance', 'category' => 'government'],
            ['code' => 'strategis', 'name' => 'Strategis Insurance', 'category' => 'private'],
            ['code' => 'jubilee', 'name' => 'Jubilee Health Insurance', 'category' => 'private'],
            ['code' => 'aetna', 'name' => 'Aetna International', 'category' => 'private'],
            ['code' => 'britam', 'name' => 'Britam Insurance', 'category' => 'private'],
            ['code' => 'resolution', 'name' => 'Resolution Insurance', 'category' => 'private'],
            ['code' => 'other', 'name' => 'Other insurer', 'category' => 'other'],
        ];
    }
}
