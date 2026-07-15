<?php

namespace App\Policies;

use App\Models\User;
use App\Modules\MedicalRecord\Infrastructure\Models\MedicalRecordModel;

class MedicalRecordPolicy
{
    public function updateDraft(User $user, MedicalRecordModel $record): bool
    {
        return true;
    }
}
