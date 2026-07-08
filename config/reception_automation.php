<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Mode C — skeleton EmergencyTriageCase creation
    |--------------------------------------------------------------------------
    |
    | Phase 5 of reports/patient-arrival-checkin-modernization-plan.md.
    | Mode A (manual, default) requires a human to create every
    | EmergencyTriageCase. Mode B (shadow) only logs what Mode C would do —
    | see App\Modules\Reception\Application\Listeners\
    | LogShadowEmergencyTriageCaseCreation, always active regardless of this
    | flag. Mode C actually creates a skeleton (no clinical fields) case on
    | emergency-mode check-in.
    |
    | Deliberately disabled by default: when to enable this is a
    | clinical-workflow decision (does auto-creating a WAITING case change
    | what a triage nurse sees the moment they open their queue, in a way
    | that needs sign-off from whoever owns that workflow?), not an
    | engineering default — see the plan's §5 risk register. Building the
    | capability now and deciding when to flip it on later are separate
    | steps; this flag is that separation.
    |
    */
    'mode_c_skeleton_emergency_triage_case' => [
        'enabled' => (bool) env('RECEPTION_MODE_C_SKELETON_TRIAGE_CASE_ENABLED', false),
    ],

];
