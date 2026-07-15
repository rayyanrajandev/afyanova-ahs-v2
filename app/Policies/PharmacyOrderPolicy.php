<?php

namespace App\Policies;

use App\Models\User;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Pharmacy\Infrastructure\Models\PharmacyOrderModel;

class PharmacyOrderPolicy
{
    public function prescribe(User $user, PatientModel $patient): bool
    {
        return true;
    }

    public function dispense(User $user, PharmacyOrderModel $order): bool
    {
        return true;
    }

    public function cancelDispense(User $user, PharmacyOrderModel $order): bool
    {
        return true;
    }
}
