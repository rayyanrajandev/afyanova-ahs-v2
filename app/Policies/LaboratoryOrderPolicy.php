<?php

namespace App\Policies;

use App\Models\User;
use App\Modules\Laboratory\Infrastructure\Models\LaboratoryOrderModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;

class LaboratoryOrderPolicy
{
    public function order(User $user, PatientModel $patient): bool
    {
        return true;
    }

    public function collectSample(User $user, LaboratoryOrderModel $order): bool
    {
        return true;
    }

    public function performTest(User $user, LaboratoryOrderModel $order): bool
    {
        return true;
    }

    public function enterResult(User $user, LaboratoryOrderModel $order): bool
    {
        return true;
    }

    public function verifyResult(User $user, LaboratoryOrderModel $order): bool
    {
        return true;
    }

    public function releaseResult(User $user, LaboratoryOrderModel $order): bool
    {
        return true;
    }

    public function rejectSample(User $user, LaboratoryOrderModel $order): bool
    {
        return true;
    }
}
