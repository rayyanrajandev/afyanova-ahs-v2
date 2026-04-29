<?php

namespace App\Http\Middleware;

use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnforceTenantIsolationWhenEnabled
{
    public function __construct(
        private readonly FeatureFlagResolverInterface $featureFlagResolver,
        private readonly CurrentPlatformScopeContextInterface $scopeContext,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->featureFlagResolver->isEnabled('platform.multi_tenant_isolation')) {
            return $next($request);
        }

        // Platform/auth endpoints must remain reachable to discover scope and session state.
        if ($request->routeIs('platform.*') || $request->routeIs('auth.me*')) {
            return $next($request);
        }

        if (! $this->scopeContext->hasTenant()) {
            $routeName = $request->route()?->getName();

            return new JsonResponse([
                'code' => 'TENANT_SCOPE_REQUIRED',
                'message' => 'Tenant scope is required when multi-tenant isolation is enabled.',
                'meta' => [
                    'flagName' => 'platform.multi_tenant_isolation',
                    'resolvedFrom' => $this->scopeContext->resolvedFrom(),
                    'routeName' => is_string($routeName) && $routeName !== '' ? $routeName : null,
                ],
            ], 403);
        }

        return $next($request);
    }
}
