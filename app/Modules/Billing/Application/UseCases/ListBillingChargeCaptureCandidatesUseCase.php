<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use App\Modules\Billing\Infrastructure\Models\BillingInvoiceModel;
use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;
use App\Modules\Laboratory\Infrastructure\Models\LaboratoryOrderModel;
use App\Modules\Pharmacy\Infrastructure\Models\PharmacyOrderModel;
use App\Modules\Platform\Domain\Services\DefaultCurrencyResolverInterface;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Support\PlatformScopeQueryApplier;
use App\Modules\Radiology\Infrastructure\Models\RadiologyOrderModel;
use App\Modules\Staff\Infrastructure\Models\ClinicalSpecialtyModel;
use App\Modules\Staff\Infrastructure\Models\StaffProfileModel;
use App\Modules\Staff\Infrastructure\Models\StaffProfileSpecialtyModel;
use App\Modules\Staff\Infrastructure\Models\StaffRegulatoryProfileModel;
use App\Modules\TheatreProcedure\Infrastructure\Models\TheatreProcedureModel;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;

class ListBillingChargeCaptureCandidatesUseCase
{
    private const INVOICE_SOURCE_KINDS = [
        'appointment_consultation',
        'laboratory_order',
        'pharmacy_order',
        'radiology_order',
        'theatre_procedure',
    ];

    public function __construct(
        private readonly BillingServiceCatalogItemRepositoryInterface $serviceCatalogRepository,
        private readonly PlatformScopeQueryApplier $platformScopeQueryApplier,
        private readonly FeatureFlagResolverInterface $featureFlagResolver,
        private readonly DefaultCurrencyResolverInterface $defaultCurrencyResolver,
    ) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function execute(array $filters): array
    {
        $patientId = trim((string) ($filters['patientId'] ?? ''));
        $appointmentId = $this->normalizeNullableUuid($filters['appointmentId'] ?? null);
        $admissionId = $this->normalizeNullableUuid($filters['admissionId'] ?? null);
        $currencyCode = strtoupper(trim((string) ($filters['currencyCode'] ?? '')));
        $currencyCode = $currencyCode !== '' ? $currencyCode : $this->defaultCurrencyResolver->resolve();
        $includeInvoiced = filter_var($filters['includeInvoiced'] ?? false, FILTER_VALIDATE_BOOL);
        $limit = max(min((int) ($filters['limit'] ?? 100), 200), 1);

        if ($patientId === '') {
            return [
                'data' => [],
                'meta' => $this->buildMeta([], $currencyCode, $includeInvoiced),
            ];
        }

        $invoicedSources = $this->invoicedSourceIndex($patientId);
        $candidates = array_merge(
            $this->consultationCandidates($patientId, $appointmentId, $admissionId, $currencyCode, $invoicedSources),
            $this->laboratoryCandidates($patientId, $appointmentId, $admissionId, $currencyCode, $invoicedSources),
            $this->radiologyCandidates($patientId, $appointmentId, $admissionId, $currencyCode, $invoicedSources),
            $this->pharmacyCandidates($patientId, $appointmentId, $admissionId, $currencyCode, $invoicedSources),
            $this->theatreCandidates($patientId, $appointmentId, $admissionId, $currencyCode, $invoicedSources),
        );

        usort(
            $candidates,
            static fn (array $left, array $right): int => strcmp(
                (string) ($right['performedAt'] ?? ''),
                (string) ($left['performedAt'] ?? ''),
            ),
        );

        $visibleCandidates = $includeInvoiced
            ? $candidates
            : array_values(array_filter(
                $candidates,
                static fn (array $candidate): bool => ! (bool) ($candidate['alreadyInvoiced'] ?? false),
            ));

        $visibleCandidates = array_slice($visibleCandidates, 0, $limit);

        return [
            'data' => $visibleCandidates,
            'meta' => $this->buildMeta($candidates, $currencyCode, $includeInvoiced),
        ];
    }

    /**
     * @param  array<string, array<string, mixed>>  $invoicedSources
     * @return array<int, array<string, mixed>>
     */
    private function consultationCandidates(
        string $patientId,
        ?string $appointmentId,
        ?string $admissionId,
        string $currencyCode,
        array $invoicedSources,
    ): array {
        if ($admissionId !== null && $appointmentId === null) {
            return [];
        }

        $query = AppointmentModel::query()
            ->where('patient_id', $patientId)
            ->whereIn('status', [
                'checked_in',
                'waiting_triage',
                'waiting_provider',
                'in_consultation',
                'completed',
            ]);

        if ($appointmentId !== null) {
            $query->where('id', $appointmentId);
        }

        $this->applyPlatformScopeIfEnabled($query);

        $appointments = $query
            ->orderByDesc('consultation_started_at')
            ->orderByDesc('triaged_at')
            ->orderByDesc('scheduled_at')
            ->limit(100)
            ->get();

        $clinicianContexts = $this->consultationClinicianContextIndex(
            $appointments
                ->map(fn (AppointmentModel $appointment): ?int => $this->consultationOwnerUserId($appointment))
                ->filter()
                ->unique()
                ->values()
                ->all(),
        );

        return $appointments
            ->map(function (AppointmentModel $appointment) use ($clinicianContexts, $currencyCode, $invoicedSources): array {
                $department = trim((string) $appointment->department);
                $clinicianContext = $clinicianContexts[$this->consultationOwnerUserId($appointment) ?? 0] ?? null;
                $performedAt = $this->dateTimeString(
                    $appointment->consultation_started_at
                    ?? $appointment->triaged_at
                    ?? $appointment->scheduled_at
                    ?? $appointment->updated_at
                );

                return $this->buildCandidate(
                    sourceKind: 'appointment_consultation',
                    sourceId: (string) $appointment->id,
                    patientId: (string) $appointment->patient_id,
                    appointmentId: $this->normalizeNullableUuid($appointment->id),
                    admissionId: null,
                    sourceNumber: $appointment->appointment_number,
                    serviceCode: $this->consultationServiceCodes($department, $clinicianContext),
                    serviceName: $this->consultationServiceName($department, $clinicianContext),
                    serviceType: 'consultation',
                    sourceStatus: $appointment->status,
                    performedAt: $performedAt,
                    quantity: 1,
                    unit: 'visit',
                    currencyCode: $currencyCode,
                    invoicedSources: $invoicedSources,
                );
            })
            ->all();
    }

    /**
     * @param  array<string, array<string, mixed>>  $invoicedSources
     * @return array<int, array<string, mixed>>
     */
    private function laboratoryCandidates(
        string $patientId,
        ?string $appointmentId,
        ?string $admissionId,
        string $currencyCode,
        array $invoicedSources,
    ): array {
        $query = LaboratoryOrderModel::query()
            ->where('patient_id', $patientId)
            ->whereNull('entered_in_error_at')
            ->where(function (Builder $builder): void {
                $builder->where('status', 'completed')
                    ->orWhereNotNull('resulted_at');
            });

        $this->applyClinicalContextFilters($query, $appointmentId, $admissionId);
        $this->applyPlatformScopeIfEnabled($query);

        $orders = $query
            ->orderByDesc('resulted_at')
            ->orderByDesc('ordered_at')
            ->limit(100)
            ->get();

        $catalogItems = $this->clinicalCatalogIndex($orders->pluck('lab_test_catalog_item_id')->all());

        return $orders
            ->map(function (LaboratoryOrderModel $order) use ($catalogItems, $currencyCode, $invoicedSources): array {
                $catalogItem = $catalogItems[(string) $order->lab_test_catalog_item_id] ?? null;

                return $this->buildCandidate(
                    sourceKind: 'laboratory_order',
                    sourceId: (string) $order->id,
                    patientId: (string) $order->patient_id,
                    appointmentId: $this->normalizeNullableUuid($order->appointment_id),
                    admissionId: $this->normalizeNullableUuid($order->admission_id),
                    sourceNumber: $order->order_number,
                    serviceCode: $this->resolveServiceCode($order->test_code, $catalogItem),
                    serviceName: $this->resolveServiceName($order->test_name, $catalogItem),
                    serviceType: 'laboratory',
                    sourceStatus: $order->status,
                    performedAt: $this->dateTimeString($order->resulted_at ?? $order->updated_at ?? $order->ordered_at),
                    quantity: 1,
                    unit: $this->resolveUnit('test', $catalogItem),
                    currencyCode: $currencyCode,
                    invoicedSources: $invoicedSources,
                );
            })
            ->all();
    }

    /**
     * @param  array<string, array<string, mixed>>  $invoicedSources
     * @return array<int, array<string, mixed>>
     */
    private function radiologyCandidates(
        string $patientId,
        ?string $appointmentId,
        ?string $admissionId,
        string $currencyCode,
        array $invoicedSources,
    ): array {
        $query = RadiologyOrderModel::query()
            ->where('patient_id', $patientId)
            ->whereNull('entered_in_error_at')
            ->where(function (Builder $builder): void {
                $builder->where('status', 'completed')
                    ->orWhereNotNull('completed_at');
            });

        $this->applyClinicalContextFilters($query, $appointmentId, $admissionId);
        $this->applyPlatformScopeIfEnabled($query);

        $orders = $query
            ->orderByDesc('completed_at')
            ->orderByDesc('ordered_at')
            ->limit(100)
            ->get();

        $catalogItems = $this->clinicalCatalogIndex($orders->pluck('radiology_procedure_catalog_item_id')->all());

        return $orders
            ->map(function (RadiologyOrderModel $order) use ($catalogItems, $currencyCode, $invoicedSources): array {
                $catalogItem = $catalogItems[(string) $order->radiology_procedure_catalog_item_id] ?? null;

                return $this->buildCandidate(
                    sourceKind: 'radiology_order',
                    sourceId: (string) $order->id,
                    patientId: (string) $order->patient_id,
                    appointmentId: $this->normalizeNullableUuid($order->appointment_id),
                    admissionId: $this->normalizeNullableUuid($order->admission_id),
                    sourceNumber: $order->order_number,
                    serviceCode: $this->resolveServiceCode($order->procedure_code, $catalogItem, $order->modality),
                    serviceName: $this->resolveServiceName($order->study_description, $catalogItem),
                    serviceType: 'radiology',
                    sourceStatus: $order->status,
                    performedAt: $this->dateTimeString($order->completed_at ?? $order->updated_at ?? $order->ordered_at),
                    quantity: 1,
                    unit: $this->resolveUnit('study', $catalogItem),
                    currencyCode: $currencyCode,
                    invoicedSources: $invoicedSources,
                );
            })
            ->all();
    }

    /**
     * @param  array<string, array<string, mixed>>  $invoicedSources
     * @return array<int, array<string, mixed>>
     */
    private function pharmacyCandidates(
        string $patientId,
        ?string $appointmentId,
        ?string $admissionId,
        string $currencyCode,
        array $invoicedSources,
    ): array {
        $query = PharmacyOrderModel::query()
            ->where('patient_id', $patientId)
            ->whereNull('entered_in_error_at')
            ->where(function (Builder $builder): void {
                $builder->whereIn('status', ['dispensed', 'partially_dispensed'])
                    ->orWhere('quantity_dispensed', '>', 0);
            });

        $this->applyClinicalContextFilters($query, $appointmentId, $admissionId);
        $this->applyPlatformScopeIfEnabled($query);

        $orders = $query
            ->orderByDesc('dispensed_at')
            ->orderByDesc('ordered_at')
            ->limit(100)
            ->get();

        $catalogItems = $this->clinicalCatalogIndex($orders->pluck('approved_medicine_catalog_item_id')->all());

        return $orders
            ->map(function (PharmacyOrderModel $order) use ($catalogItems, $currencyCode, $invoicedSources): array {
                $catalogItem = $catalogItems[(string) $order->approved_medicine_catalog_item_id] ?? null;
                $dispensedCode = $order->substitution_made
                    ? ($order->substituted_medication_code ?: $order->medication_code)
                    : $order->medication_code;
                $dispensedName = $order->substitution_made
                    ? ($order->substituted_medication_name ?: $order->medication_name)
                    : $order->medication_name;

                return $this->buildCandidate(
                    sourceKind: 'pharmacy_order',
                    sourceId: (string) $order->id,
                    patientId: (string) $order->patient_id,
                    appointmentId: $this->normalizeNullableUuid($order->appointment_id),
                    admissionId: $this->normalizeNullableUuid($order->admission_id),
                    sourceNumber: $order->order_number,
                    serviceCode: $this->resolveServiceCode($dispensedCode, $catalogItem),
                    serviceName: $this->resolveServiceName($dispensedName, $catalogItem),
                    serviceType: 'pharmacy',
                    sourceStatus: $order->status,
                    performedAt: $this->dateTimeString($order->dispensed_at ?? $order->updated_at ?? $order->ordered_at),
                    quantity: max((float) ($order->quantity_dispensed ?? 0), 1),
                    unit: $this->resolveUnit('unit', $catalogItem),
                    currencyCode: $currencyCode,
                    invoicedSources: $invoicedSources,
                );
            })
            ->all();
    }

    /**
     * @param  array<string, array<string, mixed>>  $invoicedSources
     * @return array<int, array<string, mixed>>
     */
    private function theatreCandidates(
        string $patientId,
        ?string $appointmentId,
        ?string $admissionId,
        string $currencyCode,
        array $invoicedSources,
    ): array {
        $query = TheatreProcedureModel::query()
            ->where('patient_id', $patientId)
            ->whereNull('entered_in_error_at')
            ->where(function (Builder $builder): void {
                $builder->where('status', 'completed')
                    ->orWhereNotNull('completed_at');
            });

        $this->applyClinicalContextFilters($query, $appointmentId, $admissionId);
        $this->applyPlatformScopeIfEnabled($query);

        $procedures = $query
            ->orderByDesc('completed_at')
            ->orderByDesc('scheduled_at')
            ->limit(100)
            ->get();

        $catalogItems = $this->clinicalCatalogIndex($procedures->pluck('theatre_procedure_catalog_item_id')->all());

        return $procedures
            ->map(function (TheatreProcedureModel $procedure) use ($catalogItems, $currencyCode, $invoicedSources): array {
                $catalogItem = $catalogItems[(string) $procedure->theatre_procedure_catalog_item_id] ?? null;

                return $this->buildCandidate(
                    sourceKind: 'theatre_procedure',
                    sourceId: (string) $procedure->id,
                    patientId: (string) $procedure->patient_id,
                    appointmentId: $this->normalizeNullableUuid($procedure->appointment_id),
                    admissionId: $this->normalizeNullableUuid($procedure->admission_id),
                    sourceNumber: $procedure->procedure_number,
                    serviceCode: $this->resolveServiceCode(null, $catalogItem, $procedure->procedure_type),
                    serviceName: $this->resolveServiceName($procedure->procedure_name ?: $procedure->procedure_type, $catalogItem),
                    serviceType: 'theatre',
                    sourceStatus: $procedure->status,
                    performedAt: $this->dateTimeString($procedure->completed_at ?? $procedure->updated_at ?? $procedure->scheduled_at),
                    quantity: 1,
                    unit: $this->resolveUnit('procedure', $catalogItem),
                    currencyCode: $currencyCode,
                    invoicedSources: $invoicedSources,
                );
            })
            ->all();
    }

    /**
     * @param  array<string, array<string, mixed>>  $invoicedSources
     * @return array<string, mixed>
     */
    private function buildCandidate(
        string $sourceKind,
        string $sourceId,
        string $patientId,
        ?string $appointmentId,
        ?string $admissionId,
        mixed $sourceNumber,
        mixed $serviceCode,
        mixed $serviceName,
        string $serviceType,
        mixed $sourceStatus,
        ?string $performedAt,
        float $quantity,
        string $unit,
        string $currencyCode,
        array $invoicedSources,
    ): array {
        $serviceCodes = $this->normalizeServiceCodeCandidates($serviceCode);
        $normalizedServiceCode = $serviceCodes[0] ?? '';
        $label = trim((string) ($sourceNumber ?: $serviceName ?: $normalizedServiceCode ?: $sourceKind));
        $catalogItem = $this->findActivePricingByServiceCodes($serviceCodes, $currencyCode, $performedAt);

        if ($catalogItem !== null) {
            $normalizedServiceCode = strtoupper(trim((string) ($catalogItem['service_code'] ?? $normalizedServiceCode)));
        }

        $resolvedDescription = trim((string) ($catalogItem['service_name'] ?? $serviceName ?? $label));
        $resolvedUnit = trim((string) ($catalogItem['unit'] ?? $unit));
        $unitPrice = round(max((float) ($catalogItem['base_price'] ?? 0), 0), 2);
        $lineTotal = round(max($quantity, 0) * $unitPrice, 2);
        $sourceKey = $this->sourceKey($sourceKind, $sourceId);
        $invoiceLink = $invoicedSources[$sourceKey] ?? null;
        $pricingStatus = $catalogItem
            ? 'priced'
            : ($serviceCodes !== [] ? 'missing_catalog_price' : 'missing_service_code');

        $lineNotes = sprintf(
            'Charge capture from %s %s%s.',
            str_replace('_', ' ', $sourceKind),
            $label,
            $performedAt ? sprintf(' performed %s', $performedAt) : '',
        );

        return [
            'id' => $sourceKey,
            'sourceWorkflowKind' => $sourceKind,
            'sourceWorkflowId' => $sourceId,
            'sourceWorkflowLabel' => $label,
            'patientId' => $patientId,
            'appointmentId' => $appointmentId,
            'admissionId' => $admissionId,
            'sourceNumber' => $sourceNumber ? (string) $sourceNumber : null,
            'serviceCode' => $normalizedServiceCode !== '' ? $normalizedServiceCode : null,
            'serviceName' => $resolvedDescription,
            'serviceType' => $serviceType,
            'sourceStatus' => $sourceStatus ? (string) $sourceStatus : null,
            'performedAt' => $performedAt,
            'quantity' => round(max($quantity, 0), 2),
            'unit' => $resolvedUnit !== '' ? $resolvedUnit : $unit,
            'unitPrice' => $unitPrice,
            'lineTotal' => $lineTotal,
            'currencyCode' => $currencyCode,
            'pricingStatus' => $pricingStatus,
            'pricingSource' => $catalogItem ? 'service_catalog' : null,
            'pricingSourceId' => $catalogItem['id'] ?? null,
            'pricingLookupCodes' => $serviceCodes,
            'alreadyInvoiced' => $invoiceLink !== null,
            'invoiceId' => $invoiceLink['invoiceId'] ?? null,
            'invoiceNumber' => $invoiceLink['invoiceNumber'] ?? null,
            'invoiceStatus' => $invoiceLink['invoiceStatus'] ?? null,
            'suggestedLineItem' => [
                'description' => $resolvedDescription,
                'quantity' => round(max($quantity, 0), 2),
                'unitPrice' => $unitPrice,
                'lineTotal' => $lineTotal,
                'serviceCode' => $normalizedServiceCode !== '' ? $normalizedServiceCode : null,
                'unit' => $resolvedUnit !== '' ? $resolvedUnit : $unit,
                'notes' => $lineNotes,
                'sourceWorkflowKind' => $sourceKind,
                'sourceWorkflowId' => $sourceId,
                'sourceWorkflowLabel' => $label,
                'sourcePerformedAt' => $performedAt,
            ],
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function invoicedSourceIndex(string $patientId): array
    {
        $query = BillingInvoiceModel::query()
            ->where('patient_id', $patientId)
            ->whereNotIn('status', ['cancelled', 'voided']);

        $this->applyPlatformScopeIfEnabled($query);

        $index = [];
        $query->get(['id', 'invoice_number', 'status', 'notes', 'line_items'])
            ->each(function (BillingInvoiceModel $invoice) use (&$index): void {
                foreach ($this->extractInvoiceSourceRefs($invoice) as $sourceKey) {
                    $index[$sourceKey] = [
                        'invoiceId' => (string) $invoice->id,
                        'invoiceNumber' => $invoice->invoice_number,
                        'invoiceStatus' => $invoice->status,
                    ];
                }
            });

        return $index;
    }

    /**
     * @param  array<int, mixed>  $catalogItemIds
     * @return array<string, array<string, mixed>>
     */
    private function clinicalCatalogIndex(array $catalogItemIds): array
    {
        $normalizedIds = array_values(array_unique(array_filter(
            array_map(
                static fn (mixed $id): string => trim((string) $id),
                $catalogItemIds,
            ),
            static fn (string $id): bool => $id !== '',
        )));

        if ($normalizedIds === []) {
            return [];
        }

        $query = ClinicalCatalogItemModel::query()
            ->whereIn('id', $normalizedIds);

        $this->applyPlatformScopeIfEnabled($query);

        return $query
            ->get()
            ->mapWithKeys(static fn (ClinicalCatalogItemModel $item): array => [
                (string) $item->id => $item->toArray(),
            ])
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function extractInvoiceSourceRefs(BillingInvoiceModel $invoice): array
    {
        $sourceRefs = [];

        foreach (($invoice->line_items ?? []) as $lineItem) {
            if (! is_array($lineItem)) {
                continue;
            }

            $kind = trim((string) ($lineItem['sourceWorkflowKind'] ?? ''));
            $id = trim((string) ($lineItem['sourceWorkflowId'] ?? ''));
            if ($this->isValidSourceRef($kind, $id)) {
                $sourceRefs[] = $this->sourceKey($kind, $id);
            }
        }

        $notes = (string) ($invoice->notes ?? '');
        if (preg_match('/Source:\s*\[([a-z_]+)]\s.*\(id:\s*([^)]+)\)/i', $notes, $matches) === 1) {
            $kind = strtolower(trim($matches[1] ?? ''));
            $id = trim($matches[2] ?? '');
            if ($this->isValidSourceRef($kind, $id)) {
                $sourceRefs[] = $this->sourceKey($kind, $id);
            }
        }

        return array_values(array_unique($sourceRefs));
    }

    private function isValidSourceRef(string $kind, string $id): bool
    {
        return in_array($kind, self::INVOICE_SOURCE_KINDS, true) && $id !== '';
    }

    private function sourceKey(string $kind, string $id): string
    {
        return sprintf('%s:%s', $kind, $id);
    }

    /**
     * @param  array<string, mixed>|null  $clinicianContext
     * @return array<int, string>
     */
    private function consultationServiceCodes(string $department, ?array $clinicianContext): array
    {
        $departmentToken = $this->serviceCodeToken($department);
        $staffDepartmentToken = $this->serviceCodeToken((string) ($clinicianContext['profile']['department'] ?? ''));
        $tier = $this->consultationClinicianTier($clinicianContext);
        $specialtyTokens = $this->consultationSpecialtyTokens($clinicianContext);

        $codes = [];

        if ($tier !== null) {
            foreach ($specialtyTokens as $specialtyToken) {
                $codes[] = sprintf('CONSULT-%s-%s', $tier, $specialtyToken);
            }
        }

        if ($tier !== null && $departmentToken !== '') {
            $codes[] = sprintf('CONSULT-%s-%s', $tier, $departmentToken);
        }

        if ($tier !== null && $staffDepartmentToken !== '' && $staffDepartmentToken !== $departmentToken) {
            $codes[] = sprintf('CONSULT-%s-%s', $tier, $staffDepartmentToken);
        }

        if ($tier !== null) {
            $codes[] = sprintf('CONSULT-%s', $tier);
        }

        if ($departmentToken !== '') {
            $codes[] = sprintf('CONSULT-%s', $departmentToken);
        }

        if ($staffDepartmentToken !== '' && $staffDepartmentToken !== $departmentToken) {
            $codes[] = sprintf('CONSULT-%s', $staffDepartmentToken);
        }

        $codes[] = 'CONSULTATION';

        return array_values(array_unique($codes));
    }

    /**
     * @param  array<string, mixed>|null  $clinicianContext
     */
    private function consultationServiceName(string $department, ?array $clinicianContext): string
    {
        $tier = $this->consultationClinicianTier($clinicianContext);
        $specialtyName = trim((string) ($clinicianContext['specialty']['name'] ?? ''));
        $tierLabel = match ($tier) {
            'CO' => 'Clinical Officer',
            'AMO' => 'Assistant Medical Officer',
            'MD' => 'Medical Doctor',
            'SPECIALIST' => 'Specialist',
            default => null,
        };

        $serviceName = $tierLabel !== null ? sprintf('%s Consultation', $tierLabel) : 'Consultation';
        $scope = $specialtyName !== '' ? $specialtyName : $department;

        return trim($scope) !== '' ? sprintf('%s - %s', $serviceName, trim($scope)) : $serviceName;
    }

    /**
     * @param  array<string, mixed>|null  $clinicianContext
     * @return array<int, string>
     */
    private function consultationSpecialtyTokens(?array $clinicianContext): array
    {
        $tokens = [];

        foreach ([
            $clinicianContext['specialty']['code'] ?? null,
            $clinicianContext['specialty']['name'] ?? null,
        ] as $value) {
            $token = $this->serviceCodeToken((string) $value);
            if ($token !== '') {
                $tokens[] = $token;
            }
        }

        return array_values(array_unique($tokens));
    }

    /**
     * @param  array<int, int|null>  $userIds
     * @return array<int, array<string, mixed>>
     */
    private function consultationClinicianContextIndex(array $userIds): array
    {
        $normalizedUserIds = array_values(array_unique(array_filter(
            array_map(static fn (mixed $userId): int => (int) $userId, $userIds),
            static fn (int $userId): bool => $userId > 0,
        )));

        if ($normalizedUserIds === []) {
            return [];
        }

        $staffProfileQuery = StaffProfileModel::query()
            ->whereIn('user_id', $normalizedUserIds);
        $this->applyStaffPlatformScopeIfEnabled($staffProfileQuery);

        $staffProfiles = $staffProfileQuery->get();
        $staffProfileIds = $staffProfiles
            ->pluck('id')
            ->filter()
            ->map(static fn (mixed $id): string => (string) $id)
            ->values()
            ->all();

        if ($staffProfileIds === []) {
            return [];
        }

        $regulatoryProfileQuery = StaffRegulatoryProfileModel::query()
            ->whereIn('staff_profile_id', $staffProfileIds);
        $this->applyStaffPlatformScopeIfEnabled($regulatoryProfileQuery);

        $regulatoryProfiles = $regulatoryProfileQuery
            ->get()
            ->mapWithKeys(static fn (StaffRegulatoryProfileModel $profile): array => [
                (string) $profile->staff_profile_id => $profile->toArray(),
            ])
            ->all();

        $specialtyAssignments = StaffProfileSpecialtyModel::query()
            ->whereIn('staff_profile_id', $staffProfileIds)
            ->orderByDesc('is_primary')
            ->orderBy('created_at')
            ->get()
            ->groupBy('staff_profile_id')
            ->map(static fn ($assignments) => $assignments->first());

        $specialtyIds = $specialtyAssignments
            ->map(static fn (?StaffProfileSpecialtyModel $assignment): ?string => $assignment ? (string) $assignment->specialty_id : null)
            ->filter()
            ->unique()
            ->values()
            ->all();

        $specialtyQuery = ClinicalSpecialtyModel::query()
            ->whereIn('id', $specialtyIds);
        $this->applyStaffPlatformScopeIfEnabled($specialtyQuery);

        $specialties = $specialtyIds !== []
            ? $specialtyQuery
                ->get()
                ->mapWithKeys(static fn (ClinicalSpecialtyModel $specialty): array => [
                    (string) $specialty->id => $specialty->toArray(),
                ])
                ->all()
            : [];

        $contextIndex = [];

        foreach ($staffProfiles as $staffProfile) {
            $staffProfileId = (string) $staffProfile->id;
            $assignment = $specialtyAssignments->get($staffProfileId);
            $specialtyId = $assignment ? (string) $assignment->specialty_id : null;

            $contextIndex[(int) $staffProfile->user_id] = [
                'profile' => $staffProfile->toArray(),
                'regulatoryProfile' => $regulatoryProfiles[$staffProfileId] ?? null,
                'specialty' => $specialtyId !== null ? ($specialties[$specialtyId] ?? null) : null,
            ];
        }

        return $contextIndex;
    }

    private function consultationOwnerUserId(AppointmentModel $appointment): ?int
    {
        foreach ([$appointment->consultation_owner_user_id, $appointment->clinician_user_id] as $userId) {
            $normalizedUserId = (int) $userId;
            if ($normalizedUserId > 0) {
                return $normalizedUserId;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>|null  $clinicianContext
     */
    private function consultationClinicianTier(?array $clinicianContext): ?string
    {
        if ($clinicianContext === null) {
            return null;
        }

        $haystack = strtoupper(trim(implode(' ', array_filter([
            $clinicianContext['profile']['job_title'] ?? null,
            $clinicianContext['profile']['license_type'] ?? null,
            $clinicianContext['regulatoryProfile']['cadre_code'] ?? null,
            $clinicianContext['regulatoryProfile']['professional_title'] ?? null,
            $clinicianContext['regulatoryProfile']['practice_authority_level'] ?? null,
        ], static fn (mixed $value): bool => trim((string) $value) !== ''))));

        $haystack = preg_replace('/[^A-Z0-9]+/', ' ', $haystack) ?: '';

        if ($this->containsAny($haystack, [
            'SPECIALIST',
            'CONSULTANT',
            'CARDIOLOG',
            'DERMAT',
            'GYNAE',
            'NEURO',
            'OBSTET',
            'ORTHOP',
            'PAEDIATR',
            'PEDIATR',
            'PSYCHIATR',
            'RADIOLOG',
            'SURGEON',
            'UROLOG',
        ])) {
            return 'SPECIALIST';
        }

        if ($this->containsAny($haystack, ['ASSISTANT MEDICAL OFFICER', ' AMO '])) {
            return 'AMO';
        }

        if ($this->containsAny($haystack, ['CLINICAL OFFICER', ' CO '])) {
            return 'CO';
        }

        if ($this->containsAny($haystack, ['MEDICAL DOCTOR', 'MEDICAL OFFICER', 'PHYSICIAN', ' DOCTOR ', ' MD '])) {
            return 'MD';
        }

        return null;
    }

    /**
     * @param  array<int, string>  $needles
     */
    private function containsAny(string $haystack, array $needles): bool
    {
        $paddedHaystack = sprintf(' %s ', trim($haystack));

        foreach ($needles as $needle) {
            if (str_contains($paddedHaystack, $needle)) {
                return true;
            }
        }

        return false;
    }

    private function serviceCodeToken(string $value): string
    {
        $normalized = preg_replace('/[^A-Z0-9]+/', '-', strtoupper(trim($value)));
        $normalized = trim((string) $normalized, '-');

        return $normalized;
    }

    private function resolveServiceCode(mixed $preferredCode, ?array $clinicalCatalogItem, mixed $fallbackCode = null): ?string
    {
        $metadata = is_array($clinicalCatalogItem['metadata'] ?? null)
            ? $clinicalCatalogItem['metadata']
            : [];

        $candidateCodes = [
            $preferredCode,
            $metadata['billingServiceCode'] ?? null,
            $metadata['billing_service_code'] ?? null,
            $clinicalCatalogItem['code'] ?? null,
            $fallbackCode,
        ];

        foreach ($candidateCodes as $candidateCode) {
            $normalized = strtoupper(trim((string) $candidateCode));
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return null;
    }

    /**
     * @param  mixed|array<int, mixed>  $serviceCode
     * @return array<int, string>
     */
    private function normalizeServiceCodeCandidates(mixed $serviceCode): array
    {
        $rawCodes = is_array($serviceCode) ? $serviceCode : [$serviceCode];
        $codes = [];

        foreach ($rawCodes as $rawCode) {
            $code = strtoupper(trim((string) $rawCode));
            if ($code !== '') {
                $codes[] = $code;
            }
        }

        return array_values(array_unique($codes));
    }

    /**
     * @param  array<int, string>  $serviceCodes
     * @return array<string, mixed>|null
     */
    private function findActivePricingByServiceCodes(array $serviceCodes, string $currencyCode, ?string $performedAt): ?array
    {
        foreach ($serviceCodes as $serviceCode) {
            $catalogItem = $this->serviceCatalogRepository->findActivePricingByServiceCode(
                serviceCode: $serviceCode,
                currencyCode: $currencyCode,
                asOfDateTime: $performedAt,
            );

            if ($catalogItem !== null) {
                return $catalogItem;
            }
        }

        return null;
    }

    private function resolveServiceName(mixed $preferredName, ?array $clinicalCatalogItem, mixed $fallbackName = null): string
    {
        $candidateNames = [
            $preferredName,
            $clinicalCatalogItem['name'] ?? null,
            $fallbackName,
        ];

        foreach ($candidateNames as $candidateName) {
            $normalized = trim((string) $candidateName);
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return 'Clinical service';
    }

    private function resolveUnit(string $fallbackUnit, ?array $clinicalCatalogItem): string
    {
        $catalogUnit = trim((string) ($clinicalCatalogItem['unit'] ?? ''));

        return $catalogUnit !== '' ? $catalogUnit : $fallbackUnit;
    }

    private function applyClinicalContextFilters(Builder $query, ?string $appointmentId, ?string $admissionId): void
    {
        if ($appointmentId !== null) {
            $query->where('appointment_id', $appointmentId);
        }

        if ($admissionId !== null) {
            $query->where('admission_id', $admissionId);
        }
    }

    private function applyPlatformScopeIfEnabled(Builder $query): void
    {
        if (! $this->featureFlagResolver->isEnabled('platform.multi_facility_scoping')
            && ! $this->featureFlagResolver->isEnabled('platform.multi_tenant_isolation')) {
            return;
        }

        $this->platformScopeQueryApplier->apply($query);
    }

    private function applyStaffPlatformScopeIfEnabled(Builder $query): void
    {
        if (! $this->featureFlagResolver->isEnabled('platform.multi_facility_scoping')
            && ! $this->featureFlagResolver->isEnabled('platform.multi_tenant_isolation')) {
            return;
        }

        $this->platformScopeQueryApplier->apply($query, facilityColumn: null);
    }

    private function normalizeNullableUuid(mixed $value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    private function dateTimeString(mixed $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format(DateTimeInterface::ATOM);
        }

        $normalized = trim((string) $value);

        return $normalized !== '' ? $normalized : null;
    }

    /**
     * @param  array<int, array<string, mixed>>  $candidates
     * @return array<string, mixed>
     */
    private function buildMeta(array $candidates, string $currencyCode, bool $includeInvoiced): array
    {
        $pending = 0;
        $alreadyInvoiced = 0;
        $priced = 0;
        $missingPrice = 0;

        foreach ($candidates as $candidate) {
            if ((bool) ($candidate['alreadyInvoiced'] ?? false)) {
                $alreadyInvoiced++;
            } else {
                $pending++;
            }

            if (($candidate['pricingStatus'] ?? null) === 'priced') {
                $priced++;
            } else {
                $missingPrice++;
            }
        }

        return [
            'currencyCode' => $currencyCode,
            'includeInvoiced' => $includeInvoiced,
            'total' => count($candidates),
            'pending' => $pending,
            'alreadyInvoiced' => $alreadyInvoiced,
            'priced' => $priced,
            'missingPrice' => $missingPrice,
        ];
    }
}
