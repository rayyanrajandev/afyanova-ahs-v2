<?php

namespace App\Modules\Pharmacy\Application\UseCases;

use App\Modules\Pharmacy\Application\Support\MedicationSafetyReviewGate;
use App\Modules\Pharmacy\Domain\Repositories\PharmacyOrderAuditLogRepositoryInterface;
use App\Modules\Pharmacy\Domain\Repositories\PharmacyOrderRepositoryInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Support\ClinicalOrders\ClinicalOrderLifecycle;
use Illuminate\Validation\ValidationException;

class SignPharmacyOrderUseCase
{
    public function __construct(
        private readonly PharmacyOrderRepositoryInterface $pharmacyOrderRepository,
        private readonly PharmacyOrderAuditLogRepositoryInterface $auditLogRepository,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
        private readonly MedicationSafetyReviewGate $medicationSafetyReviewGate,
    ) {}

    public function execute(
        string $id,
        ?int $actorId = null,
        bool $safetyAcknowledged = false,
        ?string $safetyOverrideCode = null,
        ?string $safetyOverrideReason = null,
    ): ?array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $existing = $this->pharmacyOrderRepository->findById($id);
        if (! $existing) {
            return null;
        }

        if (! ClinicalOrderLifecycle::isDraft($existing)) {
            throw ValidationException::withMessages([
                'order' => ['This pharmacy order is already signed.'],
            ]);
        }

        if (blank($existing['clinical_indication'] ?? null)) {
            throw ValidationException::withMessages([
                'clinicalIndication' => [
                    'Clinical indication is required before this pharmacy order can be signed.',
                ],
            ]);
        }

        $safetyReview = $this->medicationSafetyReviewGate->reviewOrFail(
            patientId: (string) ($existing['patient_id'] ?? ''),
            context: [
                'approved_medicine_catalog_item_id' => $existing['approved_medicine_catalog_item_id'] ?? null,
                'medication_code' => $existing['medication_code'] ?? null,
                'medication_name' => $existing['medication_name'] ?? null,
                'dosage_instruction' => $existing['dosage_instruction'] ?? null,
                'clinical_indication' => $existing['clinical_indication'] ?? null,
                'quantity_prescribed' => $existing['quantity_prescribed'] ?? null,
                'appointment_id' => $existing['appointment_id'] ?? null,
                'admission_id' => $existing['admission_id'] ?? null,
                'exclude_order_id' => $id,
            ],
            safetyAcknowledged: $safetyAcknowledged,
            safetyOverrideCode: $safetyOverrideCode,
            safetyOverrideReason: $safetyOverrideReason,
        );

        $payload = [];
        ClinicalOrderLifecycle::applyActiveEntryState($payload, $actorId);

        $updated = $this->pharmacyOrderRepository->update($id, $payload);
        if (! $updated) {
            return null;
        }

        $this->auditLogRepository->write(
            pharmacyOrderId: $id,
            action: 'pharmacy-order.signed',
            actorId: $actorId,
            changes: [
                'entry_state' => [
                    'before' => $existing['entry_state'] ?? null,
                    'after' => $updated['entry_state'] ?? null,
                ],
                'signed_at' => [
                    'before' => $existing['signed_at'] ?? null,
                    'after' => $updated['signed_at'] ?? null,
                ],
                'signed_by_user_id' => [
                    'before' => $existing['signed_by_user_id'] ?? null,
                    'after' => $updated['signed_by_user_id'] ?? null,
                ],
                'lifecycle_locked_at' => [
                    'before' => $existing['lifecycle_locked_at'] ?? null,
                    'after' => $updated['lifecycle_locked_at'] ?? null,
                ],
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
                    'override_reason' => blank($safetyOverrideReason) ? null : trim((string) $safetyOverrideReason),
                    'override_summary' => $safetyReview['overrideSummary'],
                ],
            ],
        );

        return $updated;
    }
}
