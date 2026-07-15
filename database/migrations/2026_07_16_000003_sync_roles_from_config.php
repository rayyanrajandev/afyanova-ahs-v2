<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $roles = config('roles');

        if (empty($roles)) {
            return;
        }

        foreach ($roles as $roleDef) {
            $perms = $roleDef['permissions'] ?? [];
            unset($roleDef['permissions']);

            $roleDef['updated_at'] = now();

            $existing = DB::table('roles')->where('code', $roleDef['code'])->first();

            if ($existing) {
                DB::table('roles')->where('code', $roleDef['code'])->update(array_merge($roleDef, [
                    'created_at' => $existing->created_at,
                ]));
            } else {
                $roleDef['created_at'] = now();
                DB::table('roles')->insert($roleDef);
            }

            $roleId = DB::table('roles')->where('code', $roleDef['code'])->value('id');
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
    }

    public function down(): void
    {
        // Cannot reliably reverse — roles should be re-seeded
    }
};
