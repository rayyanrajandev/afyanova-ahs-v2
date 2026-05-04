<?php

namespace App\Modules\Billing\Application\Support;

use App\Modules\Appointment\Application\Support\ConsultationReviewPolicyResolver;
use App\Modules\Billing\Domain\Repositories\BillingServiceCatalogItemRepositoryInterface;
use App\Modules\Billing\Domain\Services\AppointmentLookupServiceInterface;

/**
 * Applies a review consultation discount to billing invoice line items when
 * the linked appointment is classified as REVIEW.
 *
 * Only line items that resolve to a service catalog item with
 * service_type = config('consultation_policy.consultation_service_type')
 * are eligible for the discount. All other charges (labs, drugs, etc.) are unaffected.
 *
 * The discount is expressed as a reduction in subtotalAmount and recorded in
 * pricing_context.consultationReviewDiscount for full auditability.
 */
class ConsultationReviewDiscountApplier
{
    public function __construct(
        private readonly AppointmentLookupServiceInterface $appointmentLookupService,
        private readonly BillingServiceCatalogItemRepositoryInterface $serviceCatalogRepository,
        private readonly ConsultationReviewPolicyResolver $policyResolver,
    ) {}

    /**
     * Inspect the invoice payload and, if the linked appointment is REVIEW,
     * apply a percentage discount to consultation line items.
     *
     * Returns the (possibly modified) payload with updated amounts and
     * pricing_context populated with consultationReviewDiscount metadata.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function apply(array $payload): array
    {
        $appointmentId = isset($payload['appointment_id']) ? (string) $payload['appointment_id'] : null;
        if ($appointmentId === null || $appointmentId === '') {
            return $payload;
        }

        $appointment = $this->appointmentLookupService->findById($appointmentId);
        if ($appointment === null) {
            return $payload;
        }

        $consultationType = strtolower(trim((string) ($appointment['consultation_type'] ?? 'new')));
        if ($consultationType !== 'review') {
            return $this->tagNotApplicable($payload, 'Consultation type is NEW; no review discount applies.');
        }

        $facilityId = isset($payload['facility_id']) ? (string) $payload['facility_id'] : null;
        $policy     = $this->policyResolver->resolve($facilityId);

        if ((bool) ($policy['review_fee_is_free'] ?? false)) {
            return $this->applyDiscount($payload, policy: $policy, discountPercent: 100.0, isFree: true, appointment: $appointment);
        }

        $discountPercent = (float) ($policy['review_fee_percentage'] ?? 0.0);
        if ($discountPercent <= 0.0) {
            return $this->tagNotApplicable($payload, 'Review fee percentage is 0; no discount applied.');
        }

        return $this->applyDiscount($payload, policy: $policy, discountPercent: $discountPercent, isFree: false, appointment: $appointment);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $policy
     * @param  array<string, mixed>  $appointment
     * @return array<string, mixed>
     */
    private function applyDiscount(array $payload, array $policy, float $discountPercent, bool $isFree, array $appointment): array
    {
        $consultationServiceType = (string) config('consultation_policy.consultation_service_type', 'consultation');
        $currencyCode = strtoupper(trim((string) ($payload['currency_code'] ?? 'TZS')));
        $lineItems = is_array($payload['line_items'] ?? null) ? $payload['line_items'] : [];

        $reviewDiscountAmount = 0.0;
        $affectedLineCount = 0;
        $affectedServiceCodes = [];

        foreach ($lineItems as &$lineItem) {
            $serviceCode = strtoupper(trim((string) ($lineItem['serviceCode'] ?? ($lineItem['service_code'] ?? ''))));
            if ($serviceCode === '') {
                continue;
            }

            // Only discount line items that resolve to a consultation catalog item.
            $catalogItem = $this->serviceCatalogRepository->findActivePricingByServiceCode(
                serviceCode: $serviceCode,
                currencyCode: $currencyCode,
                asOfDateTime: isset($payload['invoice_date']) ? (string) $payload['invoice_date'] : null,
            );

            if (! $catalogItem) {
                continue;
            }

            if (strtolower(trim((string) ($catalogItem['service_type'] ?? ''))) !== $consultationServiceType) {
                continue;
            }

            $lineTotal = (float) ($lineItem['total'] ?? ($lineItem['unit_price'] ?? 0) * ($lineItem['quantity'] ?? 1));
            $lineDiscount = round($lineTotal * ($discountPercent / 100.0), 2);

            $lineItem['review_discount_amount'] = $lineDiscount;
            $lineItem['review_discount_percent'] = $discountPercent;

            $reviewDiscountAmount += $lineDiscount;
            $affectedLineCount++;
            $affectedServiceCodes[] = $serviceCode;
        }
        unset($lineItem);

        if ($affectedLineCount === 0) {
            return $this->tagNotApplicable(
                $payload,
                'No consultation service line items found to discount.',
            );
        }

        // Update subtotal and recalculate totals
        $existingDiscount = (float) ($payload['discount_amount'] ?? 0);
        $newDiscount      = round($existingDiscount + $reviewDiscountAmount, 2);
        $subtotal         = (float) ($payload['subtotal_amount'] ?? 0);
        $taxAmount        = (float) ($payload['tax_amount'] ?? 0);
        $paidAmount       = (float) ($payload['paid_amount'] ?? 0);
        $newTotal         = max(0.0, round($subtotal - $newDiscount + $taxAmount, 2));
        $newBalance       = max(0.0, round($newTotal - $paidAmount, 2));

        $payload['line_items']      = $lineItems;
        $payload['discount_amount'] = $newDiscount;
        $payload['total_amount']    = $newTotal;
        $payload['balance_amount']  = $newBalance;

        $existingContext = is_array($payload['pricing_context'] ?? null) ? $payload['pricing_context'] : [];
        $payload['pricing_context'] = array_merge($existingContext, [
            'consultationReviewDiscount' => [
                'applied'                   => true,
                'consultationType'          => 'review',
                'priorAppointmentId'        => $appointment['prior_completed_appointment_id'] ?? null,
                'discountPercent'           => $discountPercent,
                'isFreeFollowUp'            => $isFree,
                'reviewDiscountAmount'      => $reviewDiscountAmount,
                'affectedLineCount'         => $affectedLineCount,
                'affectedServiceCodes'      => $affectedServiceCodes,
                'followUpDays'              => $policy['follow_up_days'] ?? null,
                'appliedAt'                 => now()->toISOString(),
            ],
        ]);

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function tagNotApplicable(array $payload, string $reason): array
    {
        $existingContext = is_array($payload['pricing_context'] ?? null) ? $payload['pricing_context'] : [];
        $payload['pricing_context'] = array_merge($existingContext, [
            'consultationReviewDiscount' => [
                'applied' => false,
                'reason'  => $reason,
            ],
        ]);

        return $payload;
    }
}
