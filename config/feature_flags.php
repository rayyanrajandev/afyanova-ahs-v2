<?php

return [
    'flags' => [
        'platform.country_profile.enforced' => [
            'enabled' => true,
            'owner' => 'platform',
            'stage' => 'beta',
            'description' => 'Use country profile config to drive regional behavior.',
        ],
        'platform.feature_flags.api' => [
            'enabled' => true,
            'owner' => 'platform',
            'stage' => 'beta',
            'description' => 'Expose effective feature flags to authenticated clients.',
        ],
        'platform.multi_facility_scoping' => [
            'enabled' => false,
            'owner' => 'platform',
            'stage' => 'planned',
            'description' => 'Enforce facility scope filters on all domain reads/writes.',
        ],
        'platform.multi_tenant_isolation' => [
            'enabled' => false,
            'owner' => 'platform',
            'stage' => 'planned',
            'description' => 'Enable tenant isolation primitives and middleware enforcement.',
        ],
        'platform.localization.swahili' => [
            'enabled' => true,
            'owner' => 'platform',
            'stage' => 'beta',
            'description' => 'Enable Swahili language pack support in critical workflows.',
        ],
        'billing.multi_currency' => [
            'enabled' => true,
            'owner' => 'billing',
            'stage' => 'beta',
            'description' => 'Allow billing workflows to process configured multiple currencies.',
        ],
        'laboratory.loinc_required' => [
            'enabled' => false,
            'owner' => 'laboratory',
            'stage' => 'planned',
            'description' => 'Require LOINC code validation for laboratory orders in enabled profiles.',
        ],
        'clinical.walk_ins.routing_summary_on_patient_list' => [
            'enabled' => true,
            'owner' => 'clinical',
            'stage' => 'beta',
            'description' => 'When enabled, patient index includes active walk-in (service request) summaries for anyone with patients.read—not only service.requests readers.',
        ],
        'pricing.engine.v2' => [
            'enabled' => false,
            'owner' => 'billing',
            'stage' => 'planned',
            'description' => 'PricingEngine_Migration_Plan.md Phase 2/3 master gate: resolve charge-capture prices via chargeable_item_id (price_book_entries) instead of string-matched service_code. Shadow-diff comparison logging (pricing_engine_shadow_diffs) runs unconditionally regardless of this flag, for both pre- and post-cutover verification. A domain only actually serves the new resolver price when this flag AND that domain\'s own pricing.engine.v2.<domain> flag are both enabled -- this is the master kill-switch, domain flags are the granular rollout control.',
        ],
        'pricing.engine.v2.laboratory' => [
            'enabled' => false,
            'owner' => 'billing',
            'stage' => 'planned',
            'description' => 'PricingEngine_Migration_Plan.md Phase 3, Laboratory cutover (first domain -- confirmed clean by shadow-diff simulation on 2026-07-24). Requires pricing.engine.v2 also enabled. When both are on, laboratory order charge-capture candidates are priced via ChargeResolver/price_book_entries instead of string-matched service_code.',
        ],
        'pricing.engine.v2.radiology' => [
            'enabled' => false,
            'owner' => 'billing',
            'stage' => 'planned',
            'description' => 'PricingEngine_Migration_Plan.md Phase 3, Radiology cutover. Required its own data-fix first (migration 2026_07_24_000013): all 15 radiology tariffs were unlinked from the clinical catalog, discovered by shadow-diff simulation on 2026-07-24. Requires pricing.engine.v2 also enabled. When both are on, radiology order charge-capture candidates are priced via ChargeResolver/price_book_entries instead of string-matched service_code.',
        ],
        'pricing.engine.v2.pharmacy' => [
            'enabled' => false,
            'owner' => 'billing',
            'stage' => 'planned',
            'description' => 'PricingEngine_Migration_Plan.md Phase 3, Pharmacy cutover. Uses charge_model=per_unit (quantity_dispensed drives billed quantity, unlike the flat-quantity order kinds). No real pharmacy order/tariff data existed in the dev DB to shadow-diff against as of 2026-07-24 -- verified via test fixtures and one synthetic live check only, not real usage. Requires pricing.engine.v2 also enabled. Also flagged: InventoryClinicalLinkGuard re-pointing to chargeable_items (PricingEngine_Technical_Design.md §6) has NOT been done yet -- this flag only covers charge-capture pricing, not the inventory link validation.',
        ],
        'pricing.engine.v2.clinical_procedure' => [
            'enabled' => false,
            'owner' => 'billing',
            'stage' => 'planned',
            'description' => 'PricingEngine_Migration_Plan.md Phase 3, Clinical Procedure cutover. charge_model=flat, same shape as Laboratory/Radiology. No real clinical_procedure_orders or tariffs existed in the dev DB as of 2026-07-24 -- verified via test fixtures and one synthetic live check only, not real usage. Requires pricing.engine.v2 also enabled.',
        ],
        'pricing.engine.v2.theatre' => [
            'enabled' => false,
            'owner' => 'billing',
            'stage' => 'planned',
            'description' => 'PricingEngine_Migration_Plan.md Phase 3, Theatre cutover. charge_model=flat, same shape as Laboratory/Radiology. No real theatre_procedures or tariffs existed in the dev DB as of 2026-07-24 -- verified via test fixtures and one synthetic live check only, not real usage. Requires pricing.engine.v2 also enabled.',
        ],
        'pricing.engine.v2.consultation' => [
            'enabled' => false,
            'owner' => 'billing',
            'stage' => 'planned',
            'description' => 'PricingEngine_Migration_Plan.md Phase 3, Consultation cutover. Unlike the other five domains, this only ever upgrades the explicit ConsultationMappingModel path (tier+department -> chargeable_item_id, backfilled via pricing:backfill-consultation-chargeable-items) in BOTH AutoCaptureConsultationFeeUseCase (the live, auto-firing invoice-creation path triggered on appointment status change) and ListBillingChargeCaptureCandidatesUseCase::consultationCandidates() (the manual review screen, which never checked the mapping before this). The string-match fallback for tier/department combinations with no explicit mapping is intentionally left unchanged. Requires pricing.engine.v2 also enabled.',
        ],
        'pricing.engine.v2.bed_day' => [
            'enabled' => false,
            'owner' => 'billing',
            'stage' => 'planned',
            'description' => 'PricingEngine_Migration_Plan.md Phase 3, Bed-day cutover -- the last domain, net-new capability rather than a migration (beds have no pre-existing catalog FK or string-match tariff data at all). Only upgrades a bed-day candidate\'s price when facility_resources.chargeable_item_id has actually been assigned to that admission\'s bed (via the ward/bed admin screen -- FacilityResourceModel exposes the column as of 2026-07-24, previously present on the table since Phase 1 but never exposed on the model, a real gap caught while building this). Unassigned beds keep the existing BED-{WARD}/BED-DAY string-match fallback unchanged. No real bed pricing data existed in the dev DB as of 2026-07-24 -- verified via test fixtures and one synthetic live check only, not real usage. Service-point billing was NOT built here: no billing mechanism for service-points exists in any form today (confirmed during the earlier architecture audit), so there is nothing to migrate -- inventing one from scratch would be new product scope, not a Phase 3 cutover. Requires pricing.engine.v2 also enabled.',
        ],
    ],
];
