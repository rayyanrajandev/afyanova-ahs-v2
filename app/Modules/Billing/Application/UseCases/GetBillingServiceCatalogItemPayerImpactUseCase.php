<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Domain\Repositories\BillingPayerAuthorizationRuleRepositoryInterface;
use App\Modules\Billing\Domain\Repositories\BillingPayerContractRepositoryInterface;
use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use Carbon\CarbonImmutable;

class GetBillingServiceCatalogItemPayerImpactUseCase
{
    public function __construct(
        private readonly BillingServiceCatalogItemRepositoryInterface $serviceCatalogRepository,
        private readonly BillingPayerContractRepositoryInterface $payerContractRepository,
        private readonly BillingPayerAuthorizationRuleRepositoryInterface $payerAuthorizationRuleRepository,
    ) {}

    public function execute(string $id): ?array
    {
        $item = $this->serviceCatalogRepository->findById($id);
        if (! $item) {
            return null;
        }

        $currencyCode = $this->normalizeNullableUppercase($item['currency_code'] ?? null);
        $serviceCode = $this->normalizeNullableUppercase($item['service_code'] ?? null);
        $serviceType = $this->normalizeNullableTrimmed($item['service_type'] ?? null);
        $department = $this->normalizeNullableTrimmed($item['department'] ?? null);

        $contracts = $this->loadActiveContractsForCurrency($currencyCode);
        $effectiveContracts = array_values(array_filter(
            $contracts,
            fn (array $contract): bool => $this->isCurrentlyEffective($contract['effective_from'] ?? null, $contract['effective_to'] ?? null),
        ));

        $preAuthorizationContractCount = 0;
        $contractsWithMatchingRulesCount = 0;
        $matchingRuleCount = 0;
        $authorizationRequiredRuleCount = 0;
        $autoApproveRuleCount = 0;
        $serviceSpecificRuleCount = 0;
        $serviceTypeRuleCount = 0;
        $departmentRuleCount = 0;
        $coveragePercents = [];

        foreach ($effectiveContracts as $contract) {
            if ((bool) ($contract['requires_pre_authorization'] ?? false)) {
                $preAuthorizationContractCount++;
            }

            $coveragePercent = $contract['default_coverage_percent'] ?? null;
            if (is_numeric($coveragePercent)) {
                $coveragePercents[] = round((float) $coveragePercent, 2);
            }

            $matchingRules = $this->payerAuthorizationRuleRepository->listActiveMatchingRules(
                billingPayerContractId: (string) ($contract['id'] ?? ''),
                serviceCode: $serviceCode,
                serviceType: $serviceType,
                department: $department,
                asOfDateTime: CarbonImmutable::now()->toDateTimeString(),
            );

            if ($matchingRules !== []) {
                $contractsWithMatchingRulesCount++;
            }

            foreach ($matchingRules as $rule) {
                $matchingRuleCount++;

                if ((bool) ($rule['requires_authorization'] ?? false)) {
                    $authorizationRequiredRuleCount++;
                }

                if ((bool) ($rule['auto_approve'] ?? false)) {
                    $autoApproveRuleCount++;
                }

                if ($this->normalizeNullableUppercase($rule['service_code'] ?? null) !== null) {
                    $serviceSpecificRuleCount++;
                }

                if ($this->normalizeNullableTrimmed($rule['service_type'] ?? null) !== null) {
                    $serviceTypeRuleCount++;
                }

                if ($this->normalizeNullableTrimmed($rule['department'] ?? null) !== null) {
                    $departmentRuleCount++;
                }
            }
        }

        sort($coveragePercents);

        return [
            'serviceCode' => $serviceCode,
            'serviceType' => $serviceType,
            'department' => $department,
            'currencyCode' => $currencyCode,
            'activeContractCount' => count($effectiveContracts),
            'preAuthorizationContractCount' => $preAuthorizationContractCount,
            'contractsWithMatchingRulesCount' => $contractsWithMatchingRulesCount,
            'matchingRuleCount' => $matchingRuleCount,
            'authorizationRequiredRuleCount' => $authorizationRequiredRuleCount,
            'autoApproveRuleCount' => $autoApproveRuleCount,
            'serviceSpecificRuleCount' => $serviceSpecificRuleCount,
            'serviceTypeRuleCount' => $serviceTypeRuleCount,
            'departmentRuleCount' => $departmentRuleCount,
            'coveragePercentMin' => $coveragePercents !== [] ? $coveragePercents[0] : null,
            'coveragePercentMax' => $coveragePercents !== [] ? $coveragePercents[count($coveragePercents) - 1] : null,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function loadActiveContractsForCurrency(?string $currencyCode): array
    {
        $page = 1;
        $perPage = 100;
        $contracts = [];

        do {
            $result = $this->payerContractRepository->search(
                query: null,
                payerType: null,
                status: 'active',
                currencyCode: $currencyCode,
                requiresPreAuthorization: null,
                page: $page,
                perPage: $perPage,
                sortBy: 'contract_name',
                sortDirection: 'asc',
            );

            $contracts = array_merge($contracts, $result['data'] ?? []);
            $lastPage = (int) (($result['meta']['lastPage'] ?? 1));
            $page++;
        } while ($page <= max($lastPage, 1));

        return $contracts;
    }

    private function isCurrentlyEffective(mixed $effectiveFrom, mixed $effectiveTo): bool
    {
        $now = CarbonImmutable::now();
        $from = $this->normalizeNullableDateTime($effectiveFrom);
        $to = $this->normalizeNullableDateTime($effectiveTo);

        if ($from !== null && $from->greaterThan($now)) {
            return false;
        }

        if ($to !== null && $to->lessThan($now)) {
            return false;
        }

        return true;
    }

    private function normalizeNullableDateTime(mixed $value): ?CarbonImmutable
    {
        $normalized = $this->normalizeNullableTrimmed($value);

        return $normalized === null ? null : CarbonImmutable::parse($normalized);
    }

    private function normalizeNullableTrimmed(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }

    private function normalizeNullableUppercase(mixed $value): ?string
    {
        $normalized = $this->normalizeNullableTrimmed($value);

        return $normalized === null ? null : strtoupper($normalized);
    }
}
