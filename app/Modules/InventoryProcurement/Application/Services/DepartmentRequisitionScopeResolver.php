<?php

namespace App\Modules\InventoryProcurement\Application\Services;

use App\Models\User;
use App\Modules\Department\Infrastructure\Models\DepartmentModel;
use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryItemCategory;
use App\Modules\Staff\Infrastructure\Models\StaffProfileModel;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\Platform\Infrastructure\Support\PlatformScopeQueryApplier;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

class DepartmentRequisitionScopeResolver
{
    private const CROSS_DEPARTMENT_PERMISSIONS = [
        'inventory.procurement.manage-items',
        'inventory.procurement.manage-warehouses',
        'inventory.procurement.update-request-status',
    ];

    public function __construct(
        private readonly PlatformScopeQueryApplier $platformScopeQueryApplier,
        private readonly FeatureFlagResolverInterface $featureFlagResolver,
    ) {}

    /**
     * @return array{
     *     canSelectAnyDepartment: bool,
     *     lockedDepartment: array{id:string,name:string,code:string|null}|null,
     *     staffDepartmentName: string|null
     * }
     */
    public function contextForUser(?User $user): array
    {
        $staffDepartmentName = $this->staffDepartmentName($user);
        $lockedDepartment = $this->departmentForStaffName($staffDepartmentName);

        return [
            'canSelectAnyDepartment' => $this->canSelectAnyDepartment($user),
            'lockedDepartment' => $lockedDepartment,
            'staffDepartmentName' => $staffDepartmentName,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{id:string,name:string,code:string|null}
     */
    public function resolveForStorePayload(array $payload, ?User $user): array
    {
        if ($this->canSelectAnyDepartment($user)) {
            $department = $this->departmentByIdOrName(
                $this->nullableString($payload['requesting_department_id'] ?? null),
                $this->nullableString($payload['requesting_department'] ?? null),
            );

            if ($department === null) {
                throw ValidationException::withMessages([
                    'requestingDepartmentId' => 'Select an active requesting department from the department registry.',
                ]);
            }

            return $department;
        }

        $staffDepartmentName = $this->staffDepartmentName($user);
        $department = $this->departmentForStaffName($staffDepartmentName);

        if ($department === null) {
            throw ValidationException::withMessages([
                'requestingDepartment' => 'Your staff profile is not linked to an active department registry entry. Ask an administrator to update your staff profile department.',
            ]);
        }

        return $department;
    }

    public function assertItemIsRequestableForDepartment(string $itemId, ?string $departmentId): void
    {
        if ($departmentId === null || trim($departmentId) === '') {
            return;
        }

        $allowedCategories = $this->allowedCategoriesForDepartmentId($departmentId);
        if ($allowedCategories === null) {
            return;
        }

        $isAllowed = \App\Modules\InventoryProcurement\Infrastructure\Models\InventoryItemModel::query()
            ->where('id', $itemId)
            ->whereIn('category', $allowedCategories)
            ->exists();

        if (! $isAllowed) {
            throw ValidationException::withMessages([
                'lines' => 'One or more requested items are not requestable by the selected department.',
            ]);
        }
    }

    public function applyItemScope(Builder $query, ?string $departmentId): void
    {
        if ($departmentId === null || trim($departmentId) === '') {
            return;
        }

        $allowedCategories = $this->allowedCategoriesForDepartmentId($departmentId);
        if ($allowedCategories === null) {
            return;
        }

        $query->whereIn('category', $allowedCategories);
    }

    /**
     * @return array<int, string>|null Null means unrestricted store/procurement scope.
     */
    public function allowedCategoriesForDepartmentId(?string $departmentId): ?array
    {
        $query = DepartmentModel::query()->where('status', 'active');
        $this->applyDepartmentScopeIfEnabled($query);

        $department = $departmentId
            ? $query->find($departmentId)
            : null;

        if ($department === null) {
            return null;
        }

        $profile = strtolower(trim(implode(' ', array_filter([
            (string) $department->code,
            (string) $department->name,
            (string) $department->service_type,
        ]))));

        if ($this->containsAny($profile, ['store', 'stores', 'procurement', 'supply', 'msd', 'warehouse'])) {
            return null;
        }

        if ($this->containsAny($profile, ['laboratory', 'lab', 'pathology'])) {
            return [
                InventoryItemCategory::LABORATORY->value,
                InventoryItemCategory::MEDICAL_CONSUMABLE->value,
                InventoryItemCategory::PPE->value,
            ];
        }

        if ($this->containsAny($profile, ['pharmacy', 'dispensary'])) {
            return [
                InventoryItemCategory::PHARMACEUTICAL->value,
                InventoryItemCategory::MEDICAL_CONSUMABLE->value,
                InventoryItemCategory::PPE->value,
            ];
        }

        if ($this->containsAny($profile, ['radiology', 'imaging', 'x-ray', 'xray', 'ultrasound'])) {
            return [
                InventoryItemCategory::RADIOLOGY->value,
                InventoryItemCategory::MEDICAL_CONSUMABLE->value,
                InventoryItemCategory::PPE->value,
            ];
        }

        if ($this->containsAny($profile, ['theatre', 'surgery', 'surgical', 'operating'])) {
            return [
                InventoryItemCategory::SURGICAL_INSTRUMENT->value,
                InventoryItemCategory::MEDICAL_CONSUMABLE->value,
                InventoryItemCategory::PPE->value,
                InventoryItemCategory::PHARMACEUTICAL->value,
            ];
        }

        if ($this->containsAny($profile, ['dental'])) {
            return [
                InventoryItemCategory::DENTAL->value,
                InventoryItemCategory::MEDICAL_CONSUMABLE->value,
                InventoryItemCategory::PPE->value,
            ];
        }

        if ($this->containsAny($profile, ['kitchen', 'nutrition', 'food'])) {
            return [
                InventoryItemCategory::FOOD_NUTRITION->value,
                InventoryItemCategory::CLEANING_SANITATION->value,
            ];
        }

        if ($this->containsAny($profile, ['cleaning', 'housekeeping', 'sanitation'])) {
            return [
                InventoryItemCategory::CLEANING_SANITATION->value,
                InventoryItemCategory::PPE->value,
            ];
        }

        if ($this->containsAny($profile, ['billing', 'finance', 'records', 'front desk', 'admin'])) {
            return [InventoryItemCategory::OFFICE_ADMIN->value];
        }

        return [
            InventoryItemCategory::MEDICAL_CONSUMABLE->value,
            InventoryItemCategory::PPE->value,
            InventoryItemCategory::LINEN_TEXTILE->value,
            InventoryItemCategory::PHARMACEUTICAL->value,
            InventoryItemCategory::MEDICAL_EQUIPMENT->value,
        ];
    }

    public function canSelectAnyDepartment(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        if ($user->isFacilitySuperAdminAccess()) {
            return true;
        }

        foreach (self::CROSS_DEPARTMENT_PERMISSIONS as $permission) {
            if ($user->can($permission)) {
                return true;
            }
        }

        return false;
    }

    private function staffDepartmentName(?User $user): ?string
    {
        if ($user === null) {
            return null;
        }

        $department = StaffProfileModel::query()
            ->where('user_id', (int) $user->id)
            ->where('status', 'active')
            ->value('department');

        return $this->nullableString($department);
    }

    /**
     * @return array{id:string,name:string,code:string|null}|null
     */
    private function departmentForStaffName(?string $departmentName): ?array
    {
        return $this->departmentByIdOrName(null, $departmentName);
    }

    /**
     * @return array{id:string,name:string,code:string|null}|null
     */
    private function departmentByIdOrName(?string $departmentId, ?string $departmentName): ?array
    {
        $query = DepartmentModel::query()->where('status', 'active');
        $this->applyDepartmentScopeIfEnabled($query);

        if ($departmentId !== null) {
            $department = (clone $query)->where('id', $departmentId)->first();
            if ($department !== null) {
                return $this->toDepartmentPayload($department);
            }
        }

        if ($departmentName === null) {
            return null;
        }

        $normalized = mb_strtolower($departmentName);
        $department = $query
            ->where(function (Builder $builder) use ($normalized): void {
                $builder
                    ->whereRaw('LOWER(TRIM(name)) = ?', [$normalized])
                    ->orWhereRaw('LOWER(TRIM(code)) = ?', [$normalized]);
            })
            ->first();

        return $department ? $this->toDepartmentPayload($department) : null;
    }

    /**
     * @return array{id:string,name:string,code:string|null}
     */
    private function toDepartmentPayload(DepartmentModel $department): array
    {
        return [
            'id' => (string) $department->id,
            'name' => (string) $department->name,
            'code' => $this->nullableString($department->code),
        ];
    }

    private function nullableString(mixed $value): ?string
    {
        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }

    /**
     * @param  array<int, string>  $needles
     */
    private function containsAny(string $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            if (str_contains($haystack, $needle)) {
                return true;
            }
        }

        return false;
    }

    private function applyDepartmentScopeIfEnabled(Builder $query): void
    {
        if (! $this->featureFlagResolver->isEnabled('platform.multi_facility_scoping')
            && ! $this->featureFlagResolver->isEnabled('platform.multi_tenant_isolation')) {
            return;
        }

        $this->platformScopeQueryApplier->apply($query);
    }
}
