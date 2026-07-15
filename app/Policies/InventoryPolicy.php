<?php

namespace App\Policies;

use App\Models\User;
use App\Modules\InventoryProcurement\Infrastructure\Models\InventoryDepartmentRequisitionModel;

class InventoryPolicy
{
    public function createRequisition(User $user, string $targetDepartmentId): bool
    {
        return true;
    }

    public function approveRequisition(User $user, InventoryDepartmentRequisitionModel $requisition): bool
    {
        return true;
    }

    public function viewRequisition(User $user, InventoryDepartmentRequisitionModel $requisition): bool
    {
        return true;
    }
}
