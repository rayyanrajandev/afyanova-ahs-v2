<?php

namespace App\Modules\Billing\Application\Support;

use App\Modules\Billing\Domain\Services\ChargeResolverInterface;
use App\Modules\Billing\Infrastructure\Models\ConsultationMappingModel;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;

/**
 * PricingEngine_Migration_Plan.md Phase 3, Consultation. A narrow,
 * single-purpose upgrade path shared by the two independent places
 * consultation fees get priced (AutoCaptureConsultationFeeUseCase and
 * ListBillingChargeCaptureCandidatesUseCase::consultationCandidates()):
 * "if an explicit ConsultationMappingModel row exists and has been
 * backfilled with a chargeable_item_id, and the cutover flags are on,
 * price it via the new engine instead." Returns null in every other case
 * -- no mapping, mapping not yet backfilled, or flags off -- meaning the
 * caller keeps doing exactly what it already does (its own base_price or
 * string-match fallback). This method only ever upgrades an existing
 * result; it never replaces the "no mapping found" fallback logic itself,
 * which stays where it already lived in each call site.
 */
class ConsultationPricingResolver
{
    public function __construct(
        private readonly ChargeResolverInterface $chargeResolver,
        private readonly FeatureFlagResolverInterface $featureFlagResolver,
    ) {}

    /**
     * @return array{chargeableItemId: string, unitPrice: float, quantity: float, lineTotal: float, currencyCode: string, pricingStatus: string}|null
     */
    public function resolveViaExplicitMapping(
        ?ConsultationMappingModel $mapping,
        string $tier,
        string $department,
        float $quantity,
        ?string $performedAt,
        ?string $tenantId,
        ?string $facilityId,
        string $currencyCode,
    ): ?array {
        if (! $this->isCutOver()) {
            return null;
        }

        $mapping ??= ConsultationMappingModel::query()
            ->where('clinician_tier', $tier)
            ->where('department', $department)
            ->first();

        if ($mapping === null || $mapping->chargeable_item_id === null) {
            return null;
        }

        return $this->chargeResolver->resolvePrice(
            chargeableItemId: $mapping->chargeable_item_id,
            quantityOrDuration: $quantity,
            asOfDate: $performedAt,
            tenantId: $tenantId,
            facilityId: $facilityId,
            payerContractId: null,
            currencyCode: $currencyCode,
        );
    }

    private function isCutOver(): bool
    {
        return $this->featureFlagResolver->isEnabled('pricing.engine.v2')
            && $this->featureFlagResolver->isEnabled('pricing.engine.v2.consultation');
    }
}
