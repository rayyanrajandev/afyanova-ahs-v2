<?php

namespace App\Modules\Reception;

use App\Modules\Reception\Application\Listeners\LogShadowEmergencyTriageCaseCreation;
use App\Modules\Reception\Domain\Events\AppointmentCheckedIn;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class ReceptionServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Event::listen(AppointmentCheckedIn::class, LogShadowEmergencyTriageCaseCreation::class);
    }
}
