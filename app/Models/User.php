<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Notifications\UserCredentialLinkNotification;
use App\Modules\Platform\Infrastructure\Models\RoleModel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;
use Laravel\Fortify\TwoFactorAuthenticatable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'tenant_id',
        'name',
        'email',
        'password',
        'status',
        'status_reason',
        'deactivated_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'deactivated_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsToMany<Permission, $this>
     */
    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class);
    }

    /**
     * @return BelongsToMany<RoleModel, $this>
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(
            related: RoleModel::class,
            table: 'role_user',
            foreignPivotKey: 'user_id',
            relatedPivotKey: 'role_id',
        );
    }

    public function hasPermissionTo(string $permission): bool
    {
        if ($this->isFacilitySuperAdmin()) {
            return true;
        }

        if ($this->relationLoaded('permissions') && $this->permissions->contains('name', $permission)) {
            return true;
        }

        if ($this->permissions()
            ->where('name', $permission)
            ->exists()) {
            return true;
        }

        $hasRolePermission = false;
        try {
            return $this->roles()
                ->whereHas('permissions', fn ($query) => $query->where('name', $permission))
                ->exists();
        } catch (QueryException) {
            return false;
        }
    }

    public function givePermissionTo(string $permission): void
    {
        $permissionModel = Permission::query()->firstOrCreate([
            'name' => $permission,
        ]);

        $this->permissions()->syncWithoutDetaching([$permissionModel->id]);
        $this->unsetRelation('permissions');
    }

    /**
     * @return array<int, string>
     */
    public function permissionNames(): array
    {
        if ($this->isFacilitySuperAdmin()) {
            return Permission::query()
                ->orderBy('name')
                ->pluck('name')
                ->all();
        }

        $directPermissionNames = $this->permissions()
            ->pluck('name')
            ->all();

        try {
            $rolePermissionNames = Permission::query()
                ->select('permissions.name')
                ->join('permission_role', 'permissions.id', '=', 'permission_role.permission_id')
                ->join('role_user', 'permission_role.role_id', '=', 'role_user.role_id')
                ->where('role_user.user_id', $this->id)
                ->pluck('permissions.name')
                ->all();
        } catch (QueryException) {
            $rolePermissionNames = [];
        }

        $allPermissionNames = array_values(array_unique(array_merge($directPermissionNames, $rolePermissionNames)));
        sort($allPermissionNames);

        return $allPermissionNames;
    }

    public function isFacilitySuperAdminAccess(): bool
    {
        return $this->isFacilitySuperAdmin();
    }

    private function isFacilitySuperAdmin(): bool
    {
        try {
            return DB::table('facility_user')
                ->where('user_id', $this->id)
                ->where('is_active', true)
                ->where('role', 'super_admin')
                ->exists();
        } catch (QueryException) {
            return false;
        }
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new UserCredentialLinkNotification($token));
    }
}


