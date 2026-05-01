<?php

namespace App\Http\Middleware;

use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\Platform\Application\Support\CredentialLinkDeliveryPolicy;
use App\Support\Auth\EffectivePermissionNameResolver;
use App\Support\Branding\SystemBrandingManager;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        /** @var SystemBrandingManager $brandingManager */
        $brandingManager = app(SystemBrandingManager::class);

        return [
            ...parent::share($request),
            'name' => $brandingManager->systemName(),
            'branding' => fn (): array => $brandingManager->publicBranding(),
            'auth' => [
                'user' => $request->user(),
                'permissions' => fn (): array => $this->permissionNames($request),
                'isFacilitySuperAdmin' => fn (): bool => $this->isFacilitySuperAdmin($request),
                'isPlatformSuperAdmin' => fn (): bool => $this->isPlatformSuperAdmin($request),
            ],
            'platform' => [
                'scope' => fn (): ?array => $this->platformScope($request),
                'featureFlags' => fn (): array => $this->platformFeatureFlags(),
                'mail' => fn (): array => $this->platformMail(),
                'uploadLimits' => fn (): array => $this->platformUploadLimits(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }

    /**
     * @return array<int, string>
     */
    private function permissionNames(Request $request): array
    {
        $user = $request->user();
        if ($user === null || ! method_exists($user, 'permissionNames')) {
            return [];
        }

        /** @var EffectivePermissionNameResolver $resolver */
        $resolver = app(EffectivePermissionNameResolver::class);

        return $resolver->resolve($user, $user->permissionNames());
    }

    private function isFacilitySuperAdmin(Request $request): bool
    {
        $user = $request->user();
        if ($user === null || ! method_exists($user, 'isFacilitySuperAdminAccess')) {
            return false;
        }

        return (bool) $user->isFacilitySuperAdminAccess();
    }

    private function isPlatformSuperAdmin(Request $request): bool
    {
        $user = $request->user();
        if ($user === null || ! method_exists($user, 'isPlatformSuperAdminAccess')) {
            return false;
        }

        return (bool) $user->isPlatformSuperAdminAccess();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function platformScope(Request $request): ?array
    {
        if ($request->user() === null) {
            return null;
        }

        /** @var CurrentPlatformScopeContextInterface $scopeContext */
        $scopeContext = app(CurrentPlatformScopeContextInterface::class);

        return $scopeContext->toArray();
    }

    /**
     * @return array<string, bool>
     */
    private function platformFeatureFlags(): array
    {
        /** @var FeatureFlagResolverInterface $featureFlagResolver */
        $featureFlagResolver = app(FeatureFlagResolverInterface::class);

        return [
            'multiTenantIsolation' => $featureFlagResolver->isEnabled('platform.multi_tenant_isolation'),
            'multiFacilityScoping' => $featureFlagResolver->isEnabled('platform.multi_facility_scoping'),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function platformMail(): array
    {
        $defaultMailer = (string) config('mail.default', 'log');
        /** @var SystemBrandingManager $brandingManager */
        $brandingManager = app(SystemBrandingManager::class);
        /** @var CredentialLinkDeliveryPolicy $credentialLinkDeliveryPolicy */
        $credentialLinkDeliveryPolicy = app(CredentialLinkDeliveryPolicy::class);

        return [
            'defaultMailer' => $defaultMailer,
            'fromName' => $brandingManager->mailFromName(),
            'fromAddress' => $brandingManager->mailFromAddress(),
            'replyToAddress' => $brandingManager->mailReplyToAddress(),
            'deliversExternally' => $credentialLinkDeliveryPolicy->deliversExternally(),
            'supportsCredentialLinkPreview' => $credentialLinkDeliveryPolicy->shouldReturnLocalPreview(),
            'warning' => $credentialLinkDeliveryPolicy->warning(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function platformUploadLimits(): array
    {
        $uploadMaxBytes = $this->parseIniSizeToBytes((string) ini_get('upload_max_filesize'));
        $postMaxBytes = $this->parseIniSizeToBytes((string) ini_get('post_max_size'));

        $effectiveMaxBytes = match (true) {
            $uploadMaxBytes > 0 && $postMaxBytes > 0 => min($uploadMaxBytes, $postMaxBytes),
            $uploadMaxBytes > 0 => $uploadMaxBytes,
            $postMaxBytes > 0 => $postMaxBytes,
            default => 20 * 1024 * 1024,
        };

        return [
            'documentMaxBytes' => $effectiveMaxBytes,
            'documentMaxLabel' => $this->formatBytesLabel($effectiveMaxBytes),
        ];
    }

    private function parseIniSizeToBytes(string $value): int
    {
        $normalized = strtolower(trim($value));
        if ($normalized === '') {
            return 0;
        }

        $unit = substr($normalized, -1);
        $number = (float) $normalized;

        return match ($unit) {
            'g' => (int) round($number * 1024 * 1024 * 1024),
            'm' => (int) round($number * 1024 * 1024),
            'k' => (int) round($number * 1024),
            default => (int) round((float) $normalized),
        };
    }

    private function formatBytesLabel(int $bytes): string
    {
        if ($bytes >= 1024 * 1024 * 1024) {
            return rtrim(rtrim(number_format($bytes / (1024 * 1024 * 1024), 1, '.', ''), '0'), '.').'GB';
        }

        if ($bytes >= 1024 * 1024) {
            return rtrim(rtrim(number_format($bytes / (1024 * 1024), 1, '.', ''), '0'), '.').'MB';
        }

        if ($bytes >= 1024) {
            return rtrim(rtrim(number_format($bytes / 1024, 1, '.', ''), '0'), '.').'KB';
        }

        return $bytes.' bytes';
    }
}


