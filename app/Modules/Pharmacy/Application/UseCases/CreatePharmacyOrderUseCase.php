<?php

namespace App\Modules\Pharmacy\Application\UseCases;

use App\Modules\Pharmacy\Application\Support\ApprovedMedicineGovernance;
use App\Modules\Pharmacy\Application\Support\MedicationSafetyRuleCatalog;
use App\Modules\Pharmacy\Application\Support\MedicationSafetyReviewGate;
use App\Modules\Pharmacy\Application\Exceptions\AdmissionNotEligibleForPharmacyOrderException;
use App\Modules\Pharmacy\Application\Exceptions\AppointmentNotEligibleForPharmacyOrderException;
use App\Modules\Pharmacy\Application\Exceptions\PatientNotEligibleForPharmacyOrderException;
use App\Modules\Pharmacy\Application\Exceptions\PharmacyOrderApprovedMedicineCatalogItemNotEligibleException;
use App\Modules\Pharmacy\Domain\Repositories\PharmacyOrderAuditLogRepositoryInterface;
use App\Modules\Pharmacy\Domain\Repositories\PharmacyOrderRepositoryInterface;
use App\Modules\Pharmacy\Domain\Services\AdmissionLookupServiceInterface;
use App\Modules\Pharmacy\Domain\Services\AppointmentLookupServiceInterface;
use App\Modules\Pharmacy\Domain\Services\ApprovedMedicineCatalogLookupServiceInterface;
use App\Modules\Pharmacy\Domain\Services\PatientLookupServiceInterface;
use App\Modules\Pharmacy\Domain\ValueObjects\PharmacyOrderStatus;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Support\ClinicalOrders\ClinicalOrderLifecycle;
use App\Support\ClinicalOrders\OrderSessionManager;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class CreatePharmacyOrderUseCase
{
    public function __construct(
        private readonly PharmacyOrderRepositoryInterface $pharmacyOrderRepository,
        private readonly PharmacyOrderAuditLogRepositoryInterface $auditLogRepository,
        private readonly PatientLookupServiceInterface $patientLookupService,
        private readonly AppointmentLookupServiceInterface $appointmentLookupService,
        private readonly AdmissionLookupServiceInterface $admissionLookupService,
        private readonly ApprovedMedicineCatalogLookupServiceInterface $approvedMedicineCatalogLookupService,
        private readonly CurrentPlatformScopeContextInterface $platformScopeContext,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
        private readonly OrderSessionManager $orderSessionManager,
        private readonly MedicationSafetyReviewGate $medicationSafetyReviewGate,
    ) {}

    public function execute(array $payload, ?int $actorId = null): array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $patientId = (string) $payload['patient_id'];
        if (! $this->patientLookupService->patientExists($patientId)) {
            throw new PatientNotEligibleForPharmacyOrderException(
                'Pharmacy order can only be created for an existing patient.',
            );
        }

        $appointmentId = $payload['appointment_id'] ?? null;
        if ($appointmentId !== null && ! $this->appointmentLookupService->isValidForPatient((string) $appointmentId, $patientId)) {
            throw new AppointmentNotEligibleForPharmacyOrderException(
                'Appointment is not valid for the selected patient.',
            );
        }

        $admissionId = $payload['admission_id'] ?? null;
        if ($admissionId !== null && ! $this->admissionLookupService->isValidForPatient((string) $admissionId, $patientId)) {
            throw new AdmissionNotEligibleForPharmacyOrderException(
                'Admission is not valid for the selected patient.',
            );
        }

        $selectedCatalogItem = $this->applyCatalogManagedApprovedMedicineSelection($payload);
        foreach (ApprovedMedicineGovernance::draftPolicyDefaults($selectedCatalogItem) as $field => $value) {
            $payload[$field] = $value;
        }
        $safetyAcknowledged = (bool) ($payload['safety_acknowledged'] ?? false);
        $safetyOverrideCode = trim((string) ($payload['safety_override_code'] ?? ''));
        $safetyOverrideReason = trim((string) ($payload['safety_override_reason'] ?? ''));
        $entryState = ClinicalOrderLifecycle::normalizeEntryState(
            isset($payload['entry_mode']) ? (string) $payload['entry_mode'] : null,
        );

        $payload['status'] = PharmacyOrderStatus::PENDING->value;
        $payload['order_number'] = $this->generateOrderNumber();
        $payload['tenant_id'] = $this->platformScopeContext->tenantId();
        $payload['facility_id'] = $this->platformScopeContext->facilityId();
        $payload['ordered_by_user_id'] = $payload['ordered_by_user_id'] ?? $actorId;

        if (
            ! array_key_exists('ordered_at', $payload)
            || blank($payload['ordered_at'])
        ) {
            $payload['ordered_at'] = now();
        }

        $payload['quantity_dispensed'] = round((float) ($payload['quantity_dispensed'] ?? 0), 2);
        $payload['quantity_prescribed'] = round((float) ($payload['quantity_prescribed'] ?? 0), 2);

        $this->applyLifecycleLinkage($payload);
        $payload['clinical_order_session_id'] = $this->resolveClinicalOrderSessionId(
            $payload,
            $actorId,
        );
        if ($entryState === 'draft') {
            $safetyReview = [
                'severity' => 'none',
                'blockers' => [],
                'warnings' => [],
                'suggestedActions' => [],
                'rules' => [],
                'ruleGroups' => [],
                'ruleCodes' => [],
                'ruleCatalogVersion' => MedicationSafetyRuleCatalog::catalogVersion(),
                'overrideCode' => null,
                'overrideOption' => null,
                'overrideSummary' => MedicationSafetyRuleCatalog::buildOverrideSummary([], null, null),
            ];
            ClinicalOrderLifecycle::applyDraftEntryState($payload);
        } else {
            if (blank($payload['clinical_indication'] ?? null)) {
                throw ValidationException::withMessages([
                    'clinicalIndication' => [
                        'Clinical indication is required before this pharmacy order can become active.',
                    ],
                ]);
            }

            $safetyReview = $this->medicationSafetyReviewGate->reviewOrFail(
                patientId: $patientId,
                context: [
                    'approved_medicine_catalog_item_id' => $payload['approved_medicine_catalog_item_id'] ?? null,
                    'medication_code' => $payload['medication_code'] ?? null,
                    'medication_name' => $payload['medication_name'] ?? null,
                    'dosage_instruction' => $payload['dosage_instruction'] ?? null,
                    'clinical_indication' => $payload['clinical_indication'] ?? null,
                    'quantity_prescribed' => $payload['quantity_prescribed'] ?? null,
                    'appointment_id' => $payload['appointment_id'] ?? null,
                    'admission_id' => $payload['admission_id'] ?? null,
                    'formulary_decision_status' => $payload['formulary_decision_status'] ?? null,
                ],
                safetyAcknowledged: $safetyAcknowledged,
                safetyOverrideCode: $safetyOverrideCode,
                safetyOverrideReason: $safetyOverrideReason,
            );
            ClinicalOrderLifecycle::applyActiveEntryState($payload, $actorId);
        }

        unset($payload['safety_acknowledged'], $payload['safety_override_code'], $payload['safety_override_reason']);

        $createdOrder = $this->pharmacyOrderRepository->create($payload);

        if (! blank($payload['clinical_order_session_id'] ?? null)) {
            $this->orderSessionManager->incrementItemCount((string) $payload['clinical_order_session_id']);
        }

        $this->auditLogRepository->write(
            pharmacyOrderId: $createdOrder['id'],
            action: 'pharmacy-order.created',
            actorId: $actorId,
            changes: [
                'after' => $this->extractTrackedFields($createdOrder),
            ],
            metadata: [
                'medication_safety_review' => [
                    'severity' => $safetyReview['severity'],
                    'blockers' => $safetyReview['blockers'],
                    'warnings' => $safetyReview['warnings'],
                    'rule_codes' => $safetyReview['ruleCodes'],
                    'rules' => $safetyReview['rules'],
                    'rule_groups' => $safetyReview['ruleGroups'],
                    'rule_catalog_version' => $safetyReview['ruleCatalogVersion'],
                    'suggested_actions' => $safetyReview['suggestedActions'],
                    'acknowledged' => $safetyAcknowledged,
                    'override_code' => $safetyReview['overrideCode'],
                    'override_option' => $safetyReview['overrideOption'],
                    'override_reason' => $safetyOverrideReason !== '' ? $safetyOverrideReason : null,
                    'override_summary' => $safetyReview['overrideSummary'],
                ],
            ],
        );

        return $createdOrder;
    }

    private function generateOrderNumber(): string
    {
        for ($attempt = 1; $attempt <= 10; $attempt++) {
            $candidate = 'RX'.now()->format('Ymd').strtoupper(Str::random(6));

            if (! $this->pharmacyOrderRepository->existsByOrderNumber($candidate)) {
                return $candidate;
            }
        }

        throw new RuntimeException('Unable to generate unique pharmacy order number.');
    }

    /**
     * @return array<string, mixed>
     */
    private function extractTrackedFields(array $order): array
    {
        $tracked = [
            'order_number',
            'tenant_id',
            'facility_id',
            'patient_id',
            'admission_id',
            'appointment_id',
            'clinical_order_session_id',
            'replaces_order_id',
            'add_on_to_order_id',
            'ordered_by_user_id',
            'ordered_at',
            'approved_medicine_catalog_item_id',
            'medication_code',
            'medication_name',
            'dosage_instruction',
            'clinical_indication',
            'quantity_prescribed',
            'quantity_dispensed',
            'dispensing_notes',
            'dispensed_at',
            'formulary_decision_status',
            'formulary_decision_reason',
            'substitution_allowed',
            'substitution_made',
            'substituted_medication_code',
            'substituted_medication_name',
            'substitution_reason',
            'reconciliation_status',
            'reconciliation_note',
            'status',
            'entry_state',
            'signed_at',
            'signed_by_user_id',
            'status_reason',
            'lifecycle_reason_code',
            'entered_in_error_at',
            'entered_in_error_by_user_id',
            'lifecycle_locked_at',
        ];

        $result = [];
        foreach ($tracked as $field) {
            $result[$field] = $order[$field] ?? null;
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function applyCatalogManagedApprovedMedicineSelection(array &$payload): array
    {
        $catalogItemId = isset($payload['approved_medicine_catalog_item_id'])
            ? trim((string) ($payload['approved_medicine_catalog_item_id'] ?? ''))
            : '';
        $medicationCode = isset($payload['medication_code'])
            ? trim((string) ($payload['medication_code'] ?? ''))
            : '';

        $catalogItem = null;
        if ($catalogItemId !== '') {
            $catalogItem = $this->approvedMedicineCatalogLookupService->findActiveById($catalogItemId);
        } elseif ($medicationCode !== '') {
            $catalogItem = $this->approvedMedicineCatalogLookupService->findActiveByCode($medicationCode);
        }

        if ($catalogItem === null) {
            throw new PharmacyOrderApprovedMedicineCatalogItemNotEligibleException(
                'Selected approved medicine is not available in the active clinical catalog.'
            );
        }

        $resolvedCatalogItemId = trim((string) ($catalogItem['id'] ?? ''));
        $resolvedMedicationCode = trim((string) ($catalogItem['code'] ?? ''));
        $resolvedMedicationName = trim((string) ($catalogItem['name'] ?? ''));

        if ($resolvedCatalogItemId === '') {
            throw new PharmacyOrderApprovedMedicineCatalogItemNotEligibleException(
                'Selected approved medicine catalog entry is missing required identifier.'
            );
        }

        if ($resolvedMedicationCode === '' || $resolvedMedicationName === '') {
            throw new PharmacyOrderApprovedMedicineCatalogItemNotEligibleException(
                'Selected approved medicine catalog entry is missing required code or name.'
            );
        }

        if (strlen($resolvedMedicationCode) > 100) {
            throw new PharmacyOrderApprovedMedicineCatalogItemNotEligibleException(
                'Selected approved medicine code exceeds the supported pharmacy order length.'
            );
        }

        if (strlen($resolvedMedicationName) > 255) {
            throw new PharmacyOrderApprovedMedicineCatalogItemNotEligibleException(
                'Selected approved medicine name exceeds the supported pharmacy order length.'
            );
        }

        $payload['approved_medicine_catalog_item_id'] = $resolvedCatalogItemId;
        $payload['medication_code'] = $resolvedMedicationCode;
        $payload['medication_name'] = $resolvedMedicationName;

        return $catalogItem;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function resolveClinicalOrderSessionId(array $payload, ?int $actorId): string
    {
        $session = $this->orderSessionManager->ensureSession(
            module: 'pharmacy',
            requestedSessionId: isset($payload['clinical_order_session_id'])
                ? (string) $payload['clinical_order_session_id']
                : null,
            context: [
                'tenant_id' => $payload['tenant_id'] ?? null,
                'facility_id' => $payload['facility_id'] ?? null,
                'patient_id' => $payload['patient_id'] ?? null,
                'appointment_id' => $payload['appointment_id'] ?? null,
                'admission_id' => $payload['admission_id'] ?? null,
                'ordered_by_user_id' => $payload['ordered_by_user_id'] ?? $actorId,
                'submitted_at' => now(),
            ],
        );

        return (string) ($session['id'] ?? '');
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function applyLifecycleLinkage(array &$payload): void
    {
        $replacesOrderId = trim((string) ($payload['replaces_order_id'] ?? ''));
        $addOnToOrderId = trim((string) ($payload['add_on_to_order_id'] ?? ''));

        ClinicalOrderLifecycle::assertNoConflictingLinkage($replacesOrderId, $addOnToOrderId);

        if ($replacesOrderId !== '') {
            $sourceOrder = $this->pharmacyOrderRepository->findById($replacesOrderId);
            ClinicalOrderLifecycle::assertReplacementSource(
                $sourceOrder,
                $payload,
                'replacesOrderId',
                'pharmacy order',
            );
            $payload['replaces_order_id'] = $replacesOrderId;
        } else {
            $payload['replaces_order_id'] = null;
        }

        if ($addOnToOrderId !== '') {
            $sourceOrder = $this->pharmacyOrderRepository->findById($addOnToOrderId);
            ClinicalOrderLifecycle::assertAddOnSource(
                $sourceOrder,
                $payload,
                'addOnToOrderId',
                'pharmacy order',
            );
            $payload['add_on_to_order_id'] = $addOnToOrderId;
        } else {
            $payload['add_on_to_order_id'] = null;
        }
    }
}
