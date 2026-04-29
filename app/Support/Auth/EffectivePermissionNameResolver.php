<?php

namespace App\Support\Auth;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Support\Facades\Gate;

final class EffectivePermissionNameResolver
{
    /**
     * @var array<int, string>
     */
    private const RESOLVED_ABILITIES = [
        'appointments.record-triage',
        'appointments.start-consultation',
        'appointments.manage-provider-session',
    ];

    /**
     * @param array<int, string> $permissionNames
     * @return array<int, string>
     */
    public function resolve(mixed $user, array $permissionNames): array
    {
        $normalized = array_values(array_unique(array_filter(array_map(
            static fn (mixed $permission): string => is_string($permission) ? trim($permission) : '',
            $permissionNames,
        ))));

        if (! $user instanceof Authenticatable) {
            sort($normalized);

            return $normalized;
        }

        $gate = Gate::forUser($user);
        foreach (self::RESOLVED_ABILITIES as $ability) {
            if ($gate->allows($ability)) {
                $normalized[] = $ability;
            }
        }

        $normalized = array_values(array_unique(array_filter($normalized)));
        sort($normalized);

        return $normalized;
    }
}
