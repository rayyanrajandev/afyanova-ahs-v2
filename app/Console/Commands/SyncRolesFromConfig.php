<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SyncRolesFromConfig extends Command
{
    protected $signature = 'roles:sync';

    protected $description = 'Create or update all roles from config/roles.php for every facility';

    public function handle(): int
    {
        $roles = config('roles');

        if (empty($roles)) {
            $this->error('No roles defined in config/roles.php.');

            return self::FAILURE;
        }

        $facilities = DB::table('facilities')->get();
        $tenants = DB::table('tenants')->get();

        if ($facilities->isEmpty()) {
            $this->warn('No facilities found. Creating roles without facility scoping...');

            return $this->syncRolesForFacility(null, $roles);
        }

        foreach ($facilities as $facility) {
            $tenantId = $facility->tenant_id ?? $tenants->first()?->id;

            $this->syncRolesForFacility($facility, $roles, $tenantId);
        }

        $this->info('All roles synced from config/roles.php.');

        return self::SUCCESS;
    }

    /**
     * @param  object|null  $facility
     * @param  array<string, array<string, mixed>>  $roles
     */
    private function syncRolesForFacility(?object $facility, array $roles, ?string $tenantId = null): void
    {
        $facilityId = $facility?->id;
        $facilityName = $facility?->name ?? 'global';

        foreach ($roles as $roleKey => $roleDef) {
            $code = $roleDef['code'] ?? null;
            if ($code === null) {
                continue;
            }

            $perms = $roleDef['permissions'] ?? [];
            unset($roleDef['permissions']);

            $departmentId = null;
            if (($roleDef['scope_type'] ?? null) === 'own_department' && $facilityId !== null) {
                $departmentId = $this->resolveDepartmentId($facilityId, $roleKey);
            }

            $attributes = [
                'tenant_id' => $tenantId,
                'facility_id' => $facilityId,
                'department_id' => $departmentId,
                'code' => $code,
            ];

            $existing = DB::table('roles')->where($attributes)->first();

            if ($existing) {
                DB::table('roles')->where($attributes)->update([
                    'name' => $roleDef['name'],
                    'description' => $roleDef['description'] ?? null,
                    'access_level' => $roleDef['access_level'] ?? null,
                    'scope_type' => $roleDef['scope_type'] ?? null,
                    'is_system' => $roleDef['is_system'] ?? false,
                    'status' => 'active',
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('roles')->insert(array_merge($attributes, [
                    'id' => Str::orderedUuid()->toString(),
                    'name' => $roleDef['name'],
                    'description' => $roleDef['description'] ?? null,
                    'access_level' => $roleDef['access_level'] ?? null,
                    'scope_type' => $roleDef['scope_type'] ?? null,
                    'is_system' => $roleDef['is_system'] ?? false,
                    'status' => 'active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));
            }

            if (empty($perms)) {
                continue;
            }

            $roleId = DB::table('roles')->where($attributes)->value('id');
            if (! $roleId) {
                continue;
            }

            $permIds = DB::table('permissions')
                ->whereIn('name', $perms)
                ->pluck('id');

            DB::table('permission_role')
                ->where('role_id', $roleId)
                ->whereNotIn('permission_id', $permIds)
                ->delete();

            foreach ($permIds as $permId) {
                DB::table('permission_role')->updateOrInsert(
                    ['permission_id' => $permId, 'role_id' => $roleId],
                );
            }
        }

        $this->line("Synced roles for facility: {$facilityName}");
    }

    private function resolveDepartmentId(string $facilityId, string $roleKey): ?string
    {
        $departmentMap = [
            'lab-technologist' => 'Laboratory',
            'lab-supervisor' => 'Laboratory',
            'lab-manager' => 'Laboratory',
            'dispenser' => 'Pharmacy',
            'pharmacist' => 'Pharmacy',
            'radiographer' => 'Radiology',
            'radiographer-senior' => 'Radiology',
            'storekeeper' => 'Store',
            'senior-storekeeper' => 'Store',
            'procurement-officer' => 'Store',
            'theatre-nurse' => 'Theatre',
            'theatre-nurse-in-charge' => 'Theatre',
            'theatre-manager' => 'Theatre',
        ];

        $deptName = $departmentMap[$roleKey] ?? null;
        if ($deptName === null) {
            return null;
        }

        return DB::table('departments')
            ->where('facility_id', $facilityId)
            ->where('name', 'LIKE', "%{$deptName}%")
            ->value('id');
    }
}
