<?php

namespace App\Http\Middleware;

use App\Support\Auth\DepartmentScopedPermissionResolver;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Inventory Access Control Middleware
 * Phase 1: Department-Level RBAC Implementation
 *
 * Usage:
 * Route::post('/requisitions', [RequisitionController::class, 'store'])
 *     ->middleware('inventory.access:inventory.create-requisition-own-department');
 *
 * Route::put('/requisitions/{id}', [RequisitionController::class, 'update'])
 *     ->middleware('inventory.access:inventory.approve-requisition-own-department,inventory.manage-warehouse-own-department');
 */
class InventoryAccessMiddleware
{
    /**
     * @param DepartmentScopedPermissionResolver $permissionResolver
     */
    public function __construct(
        private DepartmentScopedPermissionResolver $permissionResolver
    ) {}

    /**
     * Handle the request
     *
     * @param Request $request
     * @param Closure $next
     * @param string ...$permissions
     * @return Response
     */
    public function handle(
        Request $request,
        Closure $next,
        ...$permissions
    ): Response {
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        // Extract department from request if provided
        $department = null;
        if ($request->has('department_id')) {
            $departmentModel = \App\Modules\Department\Infrastructure\Models\DepartmentModel::find(
                $request->input('department_id')
            );
            $department = $departmentModel;
        } elseif ($request->route('department_id')) {
            $departmentModel = \App\Modules\Department\Infrastructure\Models\DepartmentModel::find(
                $request->route('department_id')
            );
            $department = $departmentModel;
        }

        // Check if user has all required permissions
        foreach ($permissions as $permission) {
            if (!$this->permissionResolver->hasPermissionInDepartment(
                $user,
                $permission,
                $department
            )) {
                return response()->json(
                    [
                        'error' => 'Unauthorized',
                        'message' => "Missing permission: {$permission}",
                    ],
                    403
                );
            }
        }

        return $next($request);
    }
}
