<?php

namespace App\Modules\Pharmacy\Application\UseCases;

use App\Modules\Pharmacy\Application\Exceptions\PharmacyOrderApprovedMedicineCatalogItemNotEligibleException;
use App\Modules\Pharmacy\Application\Support\ApprovedMedicineGovernance;
use App\Modules\Pharmacy\Domain\Repositories\PharmacyOrderAuditLogRepositoryInterface;
use App\Modules\Pharmacy\Domain\Repositories\PharmacyOrderRepositoryInterface;
use App\Modules\Pharmacy\Domain\Services\ApprovedMedicineCatalogLookupServiceInterface;
use App\Modules\Platform\Domain\Services\TenantIsolationWriteGuardInterface;
use App\Support\ClinicalOrders\ClinicalOrderLifecycle;

class UpdatePharmacyOrderUseCase
{
    public function __construct(
        private readonly PharmacyOrderRepositoryInterface $pharmacyOrderRepository,
        private readonly PharmacyOrderAuditLogRepositoryInterface $auditLogRepository,
        private readonly ApprovedMedicineCatalogLookupServiceInterface $approvedMedicineCatalogLookupService,
        private readonly TenantIsolationWriteGuardInterface $tenantIsolationWriteGuard,
    ) {}

    public function execute(string $id, array $payload, ?int $actorId = null): ?array
    {
        $this->tenantIsolationWriteGuard->assertTenantScopeForWrite();

        $existing = $this->pharmacyOrderRepository->findById($id);
        if (! $existing) {
            return null;
        }

        ClinicalOrderLifecycle::assertDraftEditable($existing, 'pharmacy order');

        $working = $existing;
        foreach ($payload as $field => $value) {
            $working[$field] = $value;
        }

        $catalogSelectionChanged = array_key_exists('approved_medicine_catalog_item_id', $payload)
            || array_key_exists('medication_code', $payload);

        if ($catalogSelectionChanged) {
            $selectedCatalogItem = $this->applyCatalogManagedApprovedMedicineSelection($working, $payload);
            foreach (ApprovedMedicineGovernance::draftPolicyDefaults($selectedCatalogItem) as $field => $value) {
                $working[$field] = $value;
            }
        }

        if (array_key_exists('quantity_prescribed', $working)) {
            $working['quantity_prescribed'] = round((float) $working['quantity_prescribed'], 2);
        }

        $updatePayload = [];
        foreach ([
            'ordered_at',
            'dosage_instruction',
            'clinical_indication',
            'quantity_prescribed',
            'dispensing_notes',
        ] as $field) {
            if (array_key_exists($field, $payload)) {
                $updatePayload[$field] = $working[$field];
            }
        }

        if ($catalogSelectionChanged) {
            foreach ([
                'approved_medicine_catalog_item_id',
                'medication_code',
                'medication_name',
                'formulary_decision_status',
                'formulary_decision_reason',
                'formulary_reviewed_at',
                'formulary_reviewed_by_user_id',
                'substitution_allowed',
                'substitution_made',
                'substituted_medication_code',
                'substituted_medication_name',
                'substitution_reason',
                'substitution_approved_at',
                'substitution_approved_by_user_id',
            ] as $field) {
                $updatePayload[$field] = $working[$field] ?? null;
            }
        }

        $updated = $this->pharmacyOrderRepository->update($id, $updatePayload);
        if (! $updated) {
            return null;
        }

        $this->auditLogRepository->write(
            pharmacyOrderId: $id,
            action: 'pharmacy-order.updated',
            actorId: $actorId,
            changes: $this->collectChanges($existing, $updated, array_keys($updatePayload)),
        );

        return $updated;
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<string, mixed> $incomingPayload
     */
    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $incomingPayload
     * @return array<string, mixed>
     */
    private function applyCatalogManagedApprovedMedicineSelection(array &$payload, array $incomingPayload): array
    {
        $catalogItemId = array_key_exists('approved_medicine_catalog_item_id', $incomingPayload)
            ? trim((string) ($incomingPayload['approved_medicine_catalog_item_id'] ?? ''))
            : '';
        $medicationCode = array_key_exists('medication_code', $incomingPayload)
            ? trim((string) ($incomingPayload['medication_code'] ?? ''))
            : '';

        if ($catalogItemId === '' && $medicationCode === '') {
            $catalogItemId = trim((string) ($payload['approved_medicine_catalog_item_id'] ?? ''));
            $medicationCode = trim((string) ($payload['medication_code'] ?? ''));
        }

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
     * @param array<string, mixed> $before
     * @param array<string, mixed> $after
     * @param array<int, string> $fields
     * @return array<string, array<string, mixed>>
     */
    private function collectChanges(array $before, array $after, array $fields): array
    {
        $changes = [];

        foreach ($fields as $field) {
            $changes[$field] = [
                'before' => $before[$field] ?? null,
                'after' => $after[$field] ?? null,
            ];
        }

        return $changes;
    }
}
