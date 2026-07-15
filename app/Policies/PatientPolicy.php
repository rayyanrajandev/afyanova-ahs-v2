<?php

namespace App\Policies;

use App\Models\User;
use App\Modules\Patient\Infrastructure\Models\PatientModel;

class PatientPolicy
{
    public function view(User $user, PatientModel $patient): bool
    {
        return true;
    }

    public function updateDemographics(User $user, PatientModel $patient): bool
    {
        return true;
    }

    public function manageAllergies(User $user, PatientModel $patient): bool
    {
        return true;
    }

    public function manageMedications(User $user, PatientModel $patient): bool
    {
        return true;
    }

    public function recordVitals(User $user, PatientModel $patient): bool
    {
        return true;
    }
}
