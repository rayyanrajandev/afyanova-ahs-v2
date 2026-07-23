<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasActiveRole
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null && ! $user->isPlatformSuperAdminAccess()) {
            if ($user->email_verified_at === null) {
                return $next($request);
            }

            $hasActiveRole = $user->roles()
                ->active()
                ->exists();

            if (! $hasActiveRole) {
                return $request->expectsJson()
                    ? response()->json(['message' => 'User has no active roles assigned.'], 403)
                    : redirect()->guest(route('pending-setup'));
            }
        }

        return $next($request);
    }
}
