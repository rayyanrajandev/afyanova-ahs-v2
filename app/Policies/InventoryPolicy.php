<?php

namespace App\Policies;

use App\Models\User;
use App\Modules\InventoryProcurement\Infrastructure\Models\InventoryDepartmentRequisitionModel;

class InventoryPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        if ($user->hasPermissionTo('inventory.admin-manage-access')) {
            return true;
        }

        return null;
    }

    public function createRequisition(User $user, string $targetDepartmentId): bool
    {
        if (! $user->hasPermissionTo('inventory.create-requisition-own-department')) {
            return false;
        }

        $userDeptId = $user->staffProfile?->department_id;

        if ($targetDepartmentId !== $userDeptId) {
            return $user->hasPermissionTo('inventory.create-requisition-cross-department');
        }

        return true;
    }

    public function approveRequisition(User $user, InventoryDepartmentRequisitionModel $requisition): bool
    {
        if ($requisition->requested_by_user_id === $user->id) {
            return false;
        }

        if (! $user->hasPermissionTo('inventory.approve-requisition-own-department')) {
            return false;
        }

        if ($this->hasControlledSubstances($requisition)) {
            return $user->hasPermissionTo('inventory.approve-requisition-controlled-substance');
        }

        return true;
    }

    public function viewRequisition(User $user, InventoryDepartmentRequisitionModel $requisition): bool
    {
        if ($user->hasPermissionTo('inventory.view-requisition-department')) {
            $userDeptId = $user->staffProfile?->department_id;
            if ($requisition->requesting_department_id === $userDeptId) {
                return true;
            }
        }

        if ($user->hasPermissionTo('inventory.view-requisition-own')) {
            return $requisition->requested_by_user_id === $user->id
                || $requisition->requesting_department_id === $user->staffProfile?->department_id;
        }

        return false;
    }

    private function hasControlledSubstances(InventoryDepartmentRequisitionModel $requisition): bool
    {
        return $requisition->lines()
            ->whereHas('item', function ($q): void {
                $q->where('is_controlled_substance', true);
            })
            ->exists();
    }
}
