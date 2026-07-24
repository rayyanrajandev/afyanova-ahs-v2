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
            'enabled' => true,
            'owner' => 'billing',
            'stage' => 'rollout',
            'description' => 'PricingEngine_Migration_Plan.md Phase 5 rollout: master gate, now on -- resolve charge-capture prices via chargeable_item_id (price_book_entries) instead of string-matched service_code. Shadow-diff comparison logging (pricing_engine_shadow_diffs) runs unconditionally regardless of this flag, for both pre- and post-cutover verification. A domain only actually serves the new resolver price when this flag AND that domain\'s own pricing.engine.v2.<domain> flag are both enabled -- this is the master kill-switch, domain flags are the granular rollout control.',
        ],
        'pricing.engine.v2.laboratory' => [
            'enabled' => true,
            'owner' => 'billing',
            'stage' => 'rollout',
            'description' => 'PricingEngine_Migration_Plan.md Phase 5 rollout: Laboratory cutover live as of 2026-07-24 (first domain -- confirmed clean by shadow-diff simulation same day). Requires pricing.engine.v2 also enabled. Laboratory order charge-capture candidates are priced via ChargeResolver/price_book_entries instead of string-matched service_code.',
        ],
        'pricing.engine.v2.radiology' => [
            'enabled' => true,
            'owner' => 'billing',
            'stage' => 'rollout',
            'description' => 'PricingEngine_Migration_Plan.md Phase 5 rollout: Radiology cutover live as of 2026-07-24. Required its own data-fix first (migration 2026_07_24_000013): all 15 radiology tariffs were unlinked from the clinical catalog, discovered by shadow-diff simulation same day. Requires pricing.engine.v2 also enabled. Radiology order charge-capture candidates are priced via ChargeResolver/price_book_entries instead of string-matched service_code.',
        ],
        'pricing.engine.v2.pharmacy' => [
            'enabled' => true,
            'owner' => 'billing',
            'stage' => 'rollout',
            'description' => 'PricingEngine_Migration_Plan.md Phase 5 rollout: Pharmacy cutover live as of 2026-07-24. Uses charge_model=per_unit (quantity_dispensed drives billed quantity, unlike the flat-quantity order kinds). No real pharmacy order/tariff data exists in this dev DB -- verified via test fixtures and one synthetic live check only. Requires pricing.engine.v2 also enabled. InventoryClinicalLinkGuard (PricingEngine_Technical_Design.md §6) validates inventory_items.clinical_catalog_item_id, not chargeable_items/price_book_entries -- confirmed unaffected by this flag, since chargeable_items reuses clinical_catalog_item_id as its own id for formulary items. Re-pointing that guard to reference chargeable_items directly remains a separate, non-blocking future refactor.',
        ],
        'pricing.engine.v2.clinical_procedure' => [
            'enabled' => true,
            'owner' => 'billing',
            'stage' => 'rollout',
            'description' => 'PricingEngine_Migration_Plan.md Phase 5 rollout: Clinical Procedure cutover live as of 2026-07-24. charge_model=flat, same shape as Laboratory/Radiology. No real clinical_procedure_orders or tariffs exist in this dev DB -- verified via test fixtures and one synthetic live check only, not real usage; there is nothing yet for this flag to actually affect here. Requires pricing.engine.v2 also enabled.',
        ],
        'pricing.engine.v2.theatre' => [
            'enabled' => true,
            'owner' => 'billing',
            'stage' => 'rollout',
            'description' => 'PricingEngine_Migration_Plan.md Phase 5 rollout: Theatre cutover live as of 2026-07-24. charge_model=flat, same shape as Laboratory/Radiology. No real theatre_procedures or tariffs exist in this dev DB -- verified via test fixtures and one synthetic live check only, not real usage; there is nothing yet for this flag to actually affect here. Requires pricing.engine.v2 also enabled.',
        ],
        'pricing.engine.v2.consultation' => [
            'enabled' => true,
            'owner' => 'billing',
            'stage' => 'rollout',
            'description' => 'PricingEngine_Migration_Plan.md Phase 5 rollout: Consultation cutover live as of 2026-07-24 (both existing consultation_mappings rows -- CO/General OPD, AMO/General OPD -- confirmed linked to a chargeable item before flip). Unlike the other five domains, this only ever upgrades the explicit ConsultationMappingModel path (tier+department -> chargeable_item_id, backfilled via pricing:backfill-consultation-chargeable-items) in BOTH AutoCaptureConsultationFeeUseCase (the live, auto-firing invoice-creation path triggered on appointment status change) and ListBillingChargeCaptureCandidatesUseCase::consultationCandidates() (the manual review screen, which never checked the mapping before this). The string-match fallback for tier/department combinations with no explicit mapping is intentionally left unchanged. Requires pricing.engine.v2 also enabled.',
        ],
        'pricing.engine.v2.bed_day' => [
            'enabled' => true,
            'owner' => 'billing',
            'stage' => 'rollout',
            'description' => 'PricingEngine_Migration_Plan.md Phase 5 rollout: Bed-day cutover live as of 2026-07-24 -- the last domain, net-new capability rather than a migration (beds have no pre-existing catalog FK or string-match tariff data at all). Coverage at flip time was 0 of 25 active ward-beds assigned a chargeable_item_id (including the 1 bed with an active admission), so this flag is a safe no-op today: every bed-day candidate keeps the existing BED-{WARD}/BED-DAY string-match fallback until a facility admin actually assigns a chargeable item to a bed via the ward/bed admin screen (chargeableItemId picker shipped in Phase 4) -- at that point it upgrades automatically, no further flag work needed. No real bed pricing data existed in the dev DB as of 2026-07-24 -- verified via test fixtures and one synthetic live check (a real, non-test bed + admission, resolved correctly via ChargeResolver) only, not real usage. Service-point billing was NOT built here: no billing mechanism for service-points exists in any form today (confirmed during the earlier architecture audit), so there is nothing to migrate -- inventing one from scratch would be new product scope, not a Phase 3 cutover. Requires pricing.engine.v2 also enabled.',
        ],
    ],
];
