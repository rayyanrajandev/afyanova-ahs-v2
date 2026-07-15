<?php

namespace App\Policies;

use App\Models\User;
use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;

class AppointmentPolicy
{
    public function reschedule(User $user, AppointmentModel $appointment): bool
    {
        return true;
    }

    public function cancel(User $user, AppointmentModel $appointment): bool
    {
        return true;
    }

    public function checkIn(User $user, AppointmentModel $appointment): bool
    {
        return true;
    }

    public function checkOut(User $user, AppointmentModel $appointment): bool
    {
        return true;
    }
}
