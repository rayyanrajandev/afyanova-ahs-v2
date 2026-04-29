<?php

namespace App\Modules\Platform\Application\UseCases;

use App\Modules\Platform\Application\Exceptions\DuplicateFacilityCodeException;
use App\Modules\Platform\Domain\Repositories\FacilityConfigurationAuditLogRepositoryInterface;
use App\Modules\Platform\Domain\Repositories\FacilityConfigurationRepositoryInterface;
use App\Modules\Platform\Domain\Repositories\TenantRepositoryInterface;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class CreateFacilityConfigurationUseCase
{
    public function __construct(
        private readonly FacilityConfigurationRepositoryInterface $facilityConfigurationRepository,
        private readonly FacilityConfigurationAuditLogRepositoryInterface $auditLogRepository,
        private readonly TenantRepositoryInterface $tenantRepository,
    ) {}

    public function execute(array $payload, ?int $actorId = null): array
    {
        return DB::transaction(function () use ($payload, $actorId): array {
            $tenantCode = $this->normalizeCode((string) ($payload['tenant_code'] ?? ''));
            $facilityCode = $this->normalizeCode((string) ($payload['facility_code'] ?? ''));
            $tenant = $this->tenantRepository->findByCode($tenantCode);

            if ($tenant === null) {
                $tenant = $this->tenantRepository->create([
                    'code' => $tenantCode,
                    'name' => trim((string) ($payload['tenant_name'] ?? '')),
                    'country_code' => $this->normalizeCountryCode((string) ($payload['tenant_country_code'] ?? '')),
                    'allowed_country_codes' => $this->normalizeCountryCodes($payload['tenant_allowed_country_codes'] ?? null) ?: null,
                    'status' => 'active',
                ]);
            } else {
                $tenantUpdatePayload = [];
                if (array_key_exists('tenant_allowed_country_codes', $payload)) {
                    $tenantUpdatePayload['allowed_country_codes'] = $this->normalizeCountryCodes($payload['tenant_allowed_country_codes']) ?: null;
                }

                if ($tenantUpdatePayload !== []) {
                    $tenant = $this->tenantRepository->updateById((string) $tenant['id'], $tenantUpdatePayload) ?? $tenant;
                }
            }

            $tenantId = trim((string) ($tenant['id'] ?? ''));
            if ($tenantId === '') {
                throw new InvalidArgumentException('Tenant could not be resolved for facility creation.');
            }

            if ($this->facilityConfigurationRepository->existsCodeInTenant($tenantId, $facilityCode)) {
                throw new DuplicateFacilityCodeException('Facility code already exists in this organization.');
            }

            $facility = $this->facilityConfigurationRepository->create([
                'tenant_id' => $tenantId,
                'code' => $facilityCode,
                'name' => trim((string) ($payload['facility_name'] ?? '')),
                'facility_type' => $this->nullableTrimmedValue($payload['facility_type'] ?? null),
                'facility_tier' => $this->nullableTrimmedValue($payload['facility_tier'] ?? null),
                'timezone' => $this->nullableTrimmedValue($payload['timezone'] ?? null),
                'status' => 'active',
                'administrative_owner_user_id' => $payload['facility_admin_user_id'] ?? null,
            ]);

            $facilityId = (string) ($facility['id'] ?? '');
            $facilityAdminUserId = isset($payload['facility_admin_user_id'])
                ? (int) $payload['facility_admin_user_id']
                : null;

            if ($facilityAdminUserId !== null && $facilityAdminUserId > 0) {
                DB::table('facility_user')->updateOrInsert(
                    [
                        'facility_id' => $facilityId,
                        'user_id' => $facilityAdminUserId,
                    ],
                    [
                        'role' => 'super_admin',
                        'is_primary' => true,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ],
                );
            }

            $this->auditLogRepository->write(
                facilityId: $facilityId,
                action: 'platform.facilities.created',
                actorId: $actorId,
                changes: [
                    'tenant' => [
                        'id' => $tenantId,
                        'code' => $tenant['code'] ?? $tenantCode,
                        'name' => $tenant['name'] ?? null,
                    ],
                    'facility' => [
                        'code' => $facility['code'] ?? $facilityCode,
                        'name' => $facility['name'] ?? null,
                        'facility_type' => $facility['facility_type'] ?? null,
                        'timezone' => $facility['timezone'] ?? null,
                    ],
                    'facility_admin_user_id' => $facilityAdminUserId,
                ],
            );

            return $this->facilityConfigurationRepository->findById($facilityId) ?? $facility;
        });
    }

    private function normalizeCode(string $value): string
    {
        return strtoupper(trim($value));
    }

    private function normalizeCountryCode(string $value): string
    {
        return strtoupper(trim($value));
    }

    private function nullableTrimmedValue(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim((string) $value);

        return $normalized === '' ? null : $normalized;
    }

    /**
     * @return array<int, string>
     */
    private function normalizeCountryCodes(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map(function (mixed $countryCode): ?string {
            if (! is_string($countryCode)) {
                return null;
            }

            $normalized = strtoupper(trim($countryCode));

            return $normalized !== '' ? $normalized : null;
        }, $value))));
    }
}
