<?php

namespace App\Policies;

use App\Models\User;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Radiology\Infrastructure\Models\RadiologyOrderModel;

class RadiologyOrderPolicy
{
    public function order(User $user, PatientModel $patient): bool
    {
        return true;
    }

    public function perform(User $user, RadiologyOrderModel $order): bool
    {
        return true;
    }

    public function enterResult(User $user, RadiologyOrderModel $order): bool
    {
        return true;
    }

    public function verifyResult(User $user, RadiologyOrderModel $order): bool
    {
        return true;
    }
}
