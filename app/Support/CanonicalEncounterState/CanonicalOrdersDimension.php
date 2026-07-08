<?php

namespace App\Support\CanonicalEncounterState;

/**
 * "O" dimension from the canonical mapping layer
 * (reports/encounter-state-machine-design/00-canonical-encounter-state-machine.md §3.3).
 *
 * EXCEPTION is deliberately kept distinct from RESULTED, unlike the legacy
 * GetEncounterCloseReadinessUseCase, which currently folds a pharmacy
 * `reconciliation_exception` into its terminal/non-pending bucket (see
 * clinical-note-audit/15-critical-system-integrity-review.md, finding C-11).
 * UNKNOWN is a fail-closed read-failure outcome, not a clinical value.
 */
enum CanonicalOrdersDimension: string
{
    case NONE = 'NONE';
    case PENDING = 'PENDING';
    case RESULTED = 'RESULTED';
    case EXCEPTION = 'EXCEPTION';
    case UNKNOWN = 'UNKNOWN';
}
