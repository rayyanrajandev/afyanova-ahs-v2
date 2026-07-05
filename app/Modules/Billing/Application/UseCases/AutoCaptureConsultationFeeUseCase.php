<?php

namespace App\Modules\Billing\Application\UseCases;

use App\Modules\Billing\Infrastructure\Models\ConsultationMappingModel;
use App\Modules\Appointment\Domain\Repositories\AppointmentRepositoryInterface;
use App\Modules\Billing\Domain\Repositories\BillingInvoiceRepositoryInterface;
use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use App\Modules\Platform\Domain\Services\DefaultCurrencyResolverInterface;
use App\Modules\Staff\Infrastructure\Models\StaffProfileModel;
use DateTimeInterface;

class AutoCaptureConsultationFeeUseCase
{
    public function __construct(
        private readonly AppointmentRepositoryInterface $appointmentRepository,
        private readonly BillingInvoiceRepositoryInterface $billingInvoiceRepository,
        private readonly BillingServiceCatalogItemRepositoryInterface $serviceCatalogRepository,
        private readonly CreateBillingInvoiceUseCase $createBillingInvoiceUseCase,
        private readonly DefaultCurrencyResolverInterface $defaultCurrencyResolver,
    ) {}

    public function execute(string $appointmentId, ?int $actorId = null): array
    {
        $appointment = $this->appointmentRepository->findById($appointmentId);
        if ($appointment === null) {
            return ['captured' => false, 'reason' => 'appointment_not_found', 'invoice' => null];
        }

        $patientId = (string) ($appointment['patient_id'] ?? '');
        if ($patientId === '') {
            return ['captured' => false, 'reason' => 'no_patient', 'invoice' => null];
        }

        $sourceKey = 'appointment_consultation:' . $appointmentId;
        $existingInvoice = $this->billingInvoiceRepository->findByLineItemSource(
            patientId: $patientId,
            sourceWorkflowKind: 'appointment_consultation',
            sourceWorkflowId: $appointmentId,
        );
        if ($existingInvoice !== null) {
            return ['captured' => false, 'reason' => 'already_captured', 'invoice' => null];
        }

        $clinicianUserId = (int) ($appointment['consultation_owner_user_id'] ?? $appointment['clinician_user_id'] ?? 0);
        $clinicianContext = $clinicianUserId > 0
            ? $this->resolveClinicianContext($clinicianUserId)
            : null;

        $department = trim((string) ($appointment['department'] ?? ''));
        $currencyCode = $this->defaultCurrencyResolver->resolve();
        $tier = $this->consultationClinicianTier($clinicianContext);

        // 1. Explicit Mapping Lookup
        $catalogItem = null;
        if ($tier !== null && $department !== '') {
            $mapping = ConsultationMappingModel::query()
                ->where('clinician_tier', $tier)
                ->where('department', $department)
                ->with('billingServiceCatalogItem')
                ->first();
            if ($mapping) {
                $catalogItem = $mapping->billingServiceCatalogItem?->toArray();
            }
        }

        // 2. Fallback to Brittle Generation Logic
        if (!$catalogItem) {
            $serviceCodes = $this->consultationServiceCodes($department, $clinicianContext);
            $catalogItem = $this->findActivePricingByServiceCodes($serviceCodes, $currencyCode);
        }

        $serviceName = $this->consultationServiceName($department, $clinicianContext);

        $unitPrice = $catalogItem !== null
            ? round(max((float) ($catalogItem['base_price'] ?? 0), 0), 2)
            : 0;
        $normalizedServiceCode = $catalogItem !== null
            ? strtoupper(trim((string) ($catalogItem['service_code'] ?? '')))
            : 'CONSULTATION'; // Default fallback if no pricing at all
        
        $resolvedUnit = trim((string) ($catalogItem['unit'] ?? 'visit'));
        $resolvedDescription = trim((string) ($catalogItem['service_name'] ?? $serviceName));

        $performedAt = $appointment['consultation_started_at']
            ?? $appointment['triaged_at']
            ?? $appointment['scheduled_at']
            ?? $appointment['updated_at'];

        $performedAtString = $performedAt instanceof DateTimeInterface
            ? $performedAt->format(DateTimeInterface::ATOM)
            : (is_string($performedAt) ? $performedAt : null);

        $lineNotes = sprintf(
            'Charge capture from appointment_consultation %s%s.',
            $appointment['appointment_number'] ?? $appointmentId,
            $performedAtString !== null ? ' performed ' . $performedAtString : '',
        );

        $lineItem = [
            'description' => $resolvedDescription,
            'quantity' => 1,
            'unitPrice' => $unitPrice,
            'lineTotal' => $unitPrice,
            'serviceCode' => $normalizedServiceCode,
            'unit' => $resolvedUnit,
            'notes' => $lineNotes,
            'sourceWorkflowKind' => 'appointment_consultation',
            'sourceWorkflowId' => $appointmentId,
        ];

        $payload = [
            'patient_id' => $patientId,
            'appointment_id' => $appointmentId,
            'invoice_date' => now()->toDateTimeString(),
            'line_items' => [$lineItem],
            'subtotal_amount' => $unitPrice,
            'currency_code' => $currencyCode,
            'issued_by_user_id' => $actorId,
        ];

        $invoice = $this->createBillingInvoiceUseCase->execute($payload, $actorId);

        return [
            'captured' => $invoice !== null,
            'reason' => $invoice !== null ? 'created' : 'creation_failed',
            'invoice' => $invoice,
        ];
    }

    private function resolveClinicianContext(int $userId): ?array
    {
        $staffProfileTable = (new StaffProfileModel)->getTable();
        $regulatoryProfileTable = (new \App\Modules\Staff\Infrastructure\Models\StaffRegulatoryProfileModel)->getTable();
        $specialtyTable = (new \App\Modules\Staff\Infrastructure\Models\ClinicalSpecialtyModel)->getTable();
        $specialtyAssignmentTable = (new \App\Modules\Staff\Infrastructure\Models\StaffProfileSpecialtyModel)->getTable();

        $row = StaffProfileModel::query()
            ->select([
                "{$staffProfileTable}.*",
                "{$regulatoryProfileTable}.id as regulatory_profile_id",
                "{$regulatoryProfileTable}.cadre_code",
                "{$regulatoryProfileTable}.professional_title",
                "{$regulatoryProfileTable}.practice_authority_level",
                "{$specialtyTable}.id as specialty_id",
                "{$specialtyTable}.name as specialty_name",
                "{$specialtyTable}.code as specialty_code",
            ])
            ->leftJoin($regulatoryProfileTable, "{$regulatoryProfileTable}.staff_profile_id", '=', "{$staffProfileTable}.id")
            ->leftJoin($specialtyAssignmentTable, "{$specialtyAssignmentTable}.staff_profile_id", '=', "{$staffProfileTable}.id")
            ->leftJoin($specialtyTable, "{$specialtyTable}.id", '=', "{$specialtyAssignmentTable}.specialty_id")
            ->where("{$staffProfileTable}.user_id", $userId)
            ->orderByDesc("{$specialtyAssignmentTable}.is_primary")
            ->orderBy("{$specialtyAssignmentTable}.created_at")
            ->first();

        if ($row === null) {
            return null;
        }

        $profileArray = $row->toArray();

        $regulatoryProfile = null;
        if (isset($profileArray['regulatory_profile_id']) && $profileArray['regulatory_profile_id'] !== null) {
            $regulatoryProfile = [
                'id' => $profileArray['regulatory_profile_id'],
                'staff_profile_id' => $row->id,
                'cadre_code' => $profileArray['cadre_code'] ?? null,
                'professional_title' => $profileArray['professional_title'] ?? null,
                'practice_authority_level' => $profileArray['practice_authority_level'] ?? null,
            ];
        }

        $specialty = null;
        if (isset($profileArray['specialty_id']) && $profileArray['specialty_id'] !== null) {
            $specialty = [
                'id' => $profileArray['specialty_id'],
                'name' => $profileArray['specialty_name'] ?? null,
                'code' => $profileArray['specialty_code'] ?? null,
            ];
        }

        return [
            'profile' => $profileArray,
            'regulatoryProfile' => $regulatoryProfile,
            'specialty' => $specialty,
        ];
    }

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
            'SPECIALIST', 'CONSULTANT', 'CARDIOLOG', 'DERMAT', 'GYNAE',
            'NEURO', 'OBSTET', 'ORTHOP', 'PAEDIATR', 'PEDIATR',
            'PSYCHIATR', 'RADIOLOG', 'SURGEON', 'UROLOG',
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

    private function findActivePricingByServiceCodes(array $serviceCodes, string $currencyCode): ?array
    {
        $pricingMap = $this->serviceCatalogRepository->findActivePricingByServiceCodes(
            serviceCodes: $serviceCodes,
            currencyCode: $currencyCode,
            asOfDateTime: null,
        );

        foreach ($serviceCodes as $code) {
            $normalized = strtoupper(trim($code));
            if (isset($pricingMap[$normalized])) {
                return $pricingMap[$normalized];
            }
        }

        return null;
    }
}
