<?php

namespace App\Modules\PatientFlow;

use App\Modules\Laboratory\Domain\Events\LaboratoryOrderCompleted;
use App\Modules\PatientFlow\Application\Listeners\LogOrderCompletionForOrderingClinician;
use App\Modules\Pharmacy\Domain\Events\PharmacyOrderDispensed;
use App\Modules\Radiology\Domain\Events\RadiologyOrderCompleted;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class PatientFlowServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Mode A (shadow log, always active) of
        // reports/queue-based-workflow-modernization-plan.md §3.3 — one
        // listener, three events, one method per event since the three
        // Domain\Events classes share no common interface to dispatch on.
        Event::listen(
            LaboratoryOrderCompleted::class,
            [LogOrderCompletionForOrderingClinician::class, 'handleLaboratoryOrderCompleted'],
        );
        Event::listen(
            PharmacyOrderDispensed::class,
            [LogOrderCompletionForOrderingClinician::class, 'handlePharmacyOrderDispensed'],
        );
        Event::listen(
            RadiologyOrderCompleted::class,
            [LogOrderCompletionForOrderingClinician::class, 'handleRadiologyOrderCompleted'],
        );
    }
}
