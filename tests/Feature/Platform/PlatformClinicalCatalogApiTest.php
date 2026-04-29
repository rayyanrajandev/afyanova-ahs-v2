<?php

use App\Models\User;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemAuditLogModel;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutMiddleware(ValidateCsrfToken::class);
});

function clinicalCatalogPayload(array $overrides = []): array
{
    return array_merge([
        'code' => 'LAB-CBC-001',
        'name' => 'Complete Blood Count',
        'category' => 'hematology',
        'unit' => 'panel',
        'description' => 'Standard hematology profile.',
        'metadata' => [
            'sampleType' => 'blood',
        ],
    ], $overrides);
}

function makeClinicalCatalogActor(array $permissions = []): User
{
    $user = User::factory()->create();
    foreach ($permissions as $permission) {
        $user->givePermissionTo($permission);
    }

    return $user;
}

function createLabCatalogItem(User $user, array $payload = []): array
{
    return test()->actingAs($user)
        ->postJson('/api/v1/platform/admin/clinical-catalogs/lab-tests', clinicalCatalogPayload($payload))
        ->assertCreated()
        ->json('data');
}

function createTheatreCatalogItem(User $user, array $payload = []): array
{
    return test()->actingAs($user)
        ->postJson('/api/v1/platform/admin/clinical-catalogs/theatre-procedures', clinicalCatalogPayload($payload))
        ->assertCreated()
        ->json('data');
}

function createBillingServiceCatalogRow(array $overrides = []): array
{
    $row = array_merge([
        'id' => (string) Str::uuid(),
        'tenant_id' => null,
        'facility_id' => null,
        'clinical_catalog_item_id' => null,
        'service_code' => 'LAB-CBC-TARIFF-001',
        'tariff_version' => 1,
        'service_name' => 'CBC Price',
        'service_type' => 'laboratory',
        'department_id' => null,
        'department' => 'Laboratory',
        'unit' => 'test',
        'base_price' => '15000.00',
        'currency_code' => 'TZS',
        'tax_rate_percent' => '0.00',
        'is_taxable' => false,
        'effective_from' => now()->subDay(),
        'effective_to' => null,
        'description' => 'Clinical catalog linkage test tariff',
        'metadata' => null,
        'status' => 'active',
        'status_reason' => null,
        'supersedes_billing_service_catalog_item_id' => null,
        'created_at' => now(),
        'updated_at' => now(),
    ], $overrides);

    DB::table('billing_service_catalog_items')->insert($row);

    return $row;
}

it('requires authentication for clinical catalog item creation', function (): void {
    $this->postJson('/api/v1/platform/admin/clinical-catalogs/lab-tests', clinicalCatalogPayload())
        ->assertUnauthorized();
});

it('forbids clinical catalog list without read permission', function (): void {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/api/v1/platform/admin/clinical-catalogs/lab-tests')
        ->assertForbidden();
});

it('creates clinical catalog item with normalized code and active status', function (): void {
    $user = makeClinicalCatalogActor(['platform.clinical-catalog.manage-lab-tests']);

    $this->actingAs($user)
        ->postJson('/api/v1/platform/admin/clinical-catalogs/lab-tests', clinicalCatalogPayload([
            'code' => 'lab-cbc-001',
        ]))
        ->assertCreated()
        ->assertJsonPath('data.catalogType', 'lab_test')
        ->assertJsonPath('data.code', 'LAB-CBC-001')
        ->assertJsonPath('data.status', 'active');
});

it('returns billing link summary when clinical item references an active billing price', function (): void {
    $user = makeClinicalCatalogActor(['platform.clinical-catalog.manage-lab-tests']);
    $billingRow = createBillingServiceCatalogRow([
        'service_code' => 'LAB-CBC-001',
        'service_name' => 'Complete Blood Count Price',
        'base_price' => '18000.00',
    ]);

    $this->actingAs($user)
        ->postJson('/api/v1/platform/admin/clinical-catalogs/lab-tests', clinicalCatalogPayload([
            'billingServiceCode' => 'lab-cbc-001',
        ]))
        ->assertCreated()
        ->assertJsonPath('data.billingServiceCode', 'LAB-CBC-001')
        ->assertJsonPath('data.billingLinkStatus', 'linked')
        ->assertJsonPath('data.billingLink.status', 'linked')
        ->assertJsonPath('data.billingLink.serviceCode', 'LAB-CBC-001')
        ->assertJsonPath('data.billingLink.item.id', $billingRow['id'])
        ->assertJsonPath('data.billingLink.item.serviceName', 'Complete Blood Count Price')
        ->assertJsonPath('data.billingLink.item.basePrice', '18000.00')
        ->assertJsonPath('data.billingLink.item.currencyCode', 'TZS');
});

it('rejects duplicate clinical catalog code in the same scope and type', function (): void {
    $user = makeClinicalCatalogActor(['platform.clinical-catalog.manage-lab-tests']);
    createLabCatalogItem($user);

    $this->actingAs($user)
        ->postJson('/api/v1/platform/admin/clinical-catalogs/lab-tests', clinicalCatalogPayload())
        ->assertStatus(422)
        ->assertJsonValidationErrors(['code']);
});

it('lists and filters clinical catalog items', function (): void {
    $user = makeClinicalCatalogActor([
        'platform.clinical-catalog.read',
        'platform.clinical-catalog.manage-lab-tests',
    ]);

    createLabCatalogItem($user, [
        'code' => 'LAB-CBC-002',
        'name' => 'CBC Follow-up',
        'category' => 'hematology',
    ]);
    createLabCatalogItem($user, [
        'code' => 'LAB-GLU-001',
        'name' => 'Blood Glucose',
        'category' => 'chemistry',
        'billingServiceCode' => 'LAB-GLU-001',
    ]);
    createBillingServiceCatalogRow([
        'service_code' => 'LAB-GLU-001',
        'service_name' => 'Blood Glucose Price',
        'base_price' => '9000.00',
    ]);

    $this->actingAs($user)
        ->getJson('/api/v1/platform/admin/clinical-catalogs/lab-tests?q=glucose&category=chemistry')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.code', 'LAB-GLU-001')
        ->assertJsonPath('data.0.billingLinkStatus', 'linked')
        ->assertJsonPath('data.0.billingLink.item.serviceName', 'Blood Glucose Price');
});

it('returns clinical catalog status counts', function (): void {
    $user = makeClinicalCatalogActor([
        'platform.clinical-catalog.read',
        'platform.clinical-catalog.manage-lab-tests',
    ]);

    $active = createLabCatalogItem($user, ['code' => 'LAB-HBA1C-001', 'name' => 'HbA1c']);
    createLabCatalogItem($user, ['code' => 'LAB-TSH-001', 'name' => 'TSH']);

    $this->actingAs($user)
        ->patchJson('/api/v1/platform/admin/clinical-catalogs/lab-tests/'.$active['id'].'/status', [
            'status' => 'inactive',
            'reason' => 'Temporarily suspended',
        ])
        ->assertOk();

    $this->actingAs($user)
        ->getJson('/api/v1/platform/admin/clinical-catalogs/lab-tests/status-counts')
        ->assertOk()
        ->assertJsonPath('data.active', 1)
        ->assertJsonPath('data.inactive', 1)
        ->assertJsonPath('data.retired', 0)
        ->assertJsonPath('data.total', 2);
});

it('updates clinical catalog item fields', function (): void {
    $user = makeClinicalCatalogActor(['platform.clinical-catalog.manage-lab-tests']);
    $created = createLabCatalogItem($user);

    $this->actingAs($user)
        ->patchJson('/api/v1/platform/admin/clinical-catalogs/lab-tests/'.$created['id'], [
            'name' => 'Complete Blood Count Extended',
            'unit' => 'test',
            'metadata' => ['sampleType' => 'venous blood'],
        ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Complete Blood Count Extended')
        ->assertJsonPath('data.unit', 'test')
        ->assertJsonPath('data.metadata.sampleType', 'venous blood');
});

it('shows pending price status when billing service code has no matching tariff yet', function (): void {
    $user = makeClinicalCatalogActor([
        'platform.clinical-catalog.read',
        'platform.clinical-catalog.manage-lab-tests',
    ]);
    $created = createLabCatalogItem($user, [
        'code' => 'LAB-ESR-001',
        'name' => 'ESR',
        'billingServiceCode' => 'LAB-ESR-001',
    ]);

    $this->actingAs($user)
        ->getJson('/api/v1/platform/admin/clinical-catalogs/lab-tests/'.$created['id'])
        ->assertOk()
        ->assertJsonPath('data.billingServiceCode', 'LAB-ESR-001')
        ->assertJsonPath('data.billingLinkStatus', 'pending_price')
        ->assertJsonPath('data.billingLink.status', 'pending_price')
        ->assertJsonPath('data.billingLink.serviceCode', 'LAB-ESR-001')
        ->assertJsonPath('data.billingLink.item', null);
});

it('requires reason when retiring clinical catalog item', function (): void {
    $user = makeClinicalCatalogActor(['platform.clinical-catalog.manage-lab-tests']);
    $created = createLabCatalogItem($user);

    $this->actingAs($user)
        ->patchJson('/api/v1/platform/admin/clinical-catalogs/lab-tests/'.$created['id'].'/status', [
            'status' => 'retired',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['reason']);
});

it('updates clinical catalog status', function (): void {
    $user = makeClinicalCatalogActor(['platform.clinical-catalog.manage-lab-tests']);
    $created = createLabCatalogItem($user);

    $this->actingAs($user)
        ->patchJson('/api/v1/platform/admin/clinical-catalogs/lab-tests/'.$created['id'].'/status', [
            'status' => 'retired',
            'reason' => 'Replaced by newer assay panel',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'retired')
        ->assertJsonPath('data.statusReason', 'Replaced by newer assay panel');
});

it('lists clinical catalog audit logs when authorized', function (): void {
    $user = makeClinicalCatalogActor([
        'platform.clinical-catalog.manage-lab-tests',
        'platform.clinical-catalog.view-audit-logs',
    ]);
    $created = createLabCatalogItem($user);

    $this->actingAs($user)
        ->getJson('/api/v1/platform/admin/clinical-catalogs/lab-tests/'.$created['id'].'/audit-logs')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.action', 'platform.clinical-catalog-item.created');
});

it('exports clinical catalog audit logs as csv', function (): void {
    $user = makeClinicalCatalogActor([
        'platform.clinical-catalog.manage-lab-tests',
        'platform.clinical-catalog.view-audit-logs',
    ]);
    $created = createLabCatalogItem($user);

    $response = $this->actingAs($user)
        ->get('/api/v1/platform/admin/clinical-catalogs/lab-tests/'.$created['id'].'/audit-logs/export');

    $response->assertOk();
    $response->assertHeader('X-Audit-CSV-Schema-Version', 'audit-log-csv.v1');
    expect($response->streamedContent())->toContain('platform.clinical-catalog-item.created');
});

it('forbids clinical catalog audit logs without permission', function (): void {
    $user = makeClinicalCatalogActor(['platform.clinical-catalog.manage-lab-tests']);
    $created = createLabCatalogItem($user);

    $this->actingAs($user)
        ->getJson('/api/v1/platform/admin/clinical-catalogs/lab-tests/'.$created['id'].'/audit-logs')
        ->assertForbidden();
});

it('enforces type-specific routing for catalog item reads', function (): void {
    $user = makeClinicalCatalogActor([
        'platform.clinical-catalog.read',
        'platform.clinical-catalog.manage-lab-tests',
    ]);
    $created = createLabCatalogItem($user);

    $this->actingAs($user)
        ->getJson('/api/v1/platform/admin/clinical-catalogs/radiology-procedures/'.$created['id'])
        ->assertNotFound();
});

it('creates theatre procedure catalog item with dedicated catalog type', function (): void {
    $user = makeClinicalCatalogActor(['platform.clinical-catalog.manage-theatre-procedures']);

    $this->actingAs($user)
        ->postJson('/api/v1/platform/admin/clinical-catalogs/theatre-procedures', clinicalCatalogPayload([
            'code' => 'THR-HRN-001',
            'name' => 'Hernia Repair',
            'category' => 'general_surgery',
            'unit' => 'procedure',
            'metadata' => [
                'specialty' => 'general_surgery',
                'anesthesiaType' => 'general',
            ],
        ]))
        ->assertCreated()
        ->assertJsonPath('data.catalogType', 'theatre_procedure')
        ->assertJsonPath('data.code', 'THR-HRN-001')
        ->assertJsonPath('data.name', 'Hernia Repair');
});

it('lists theatre procedure catalog items with theatre permission', function (): void {
    $user = makeClinicalCatalogActor([
        'platform.clinical-catalog.read',
        'platform.clinical-catalog.manage-theatre-procedures',
    ]);

    createTheatreCatalogItem($user, [
        'code' => 'THR-APP-010',
        'name' => 'Appendectomy',
        'category' => 'general_surgery',
    ]);

    $this->actingAs($user)
        ->getJson('/api/v1/platform/admin/clinical-catalogs/theatre-procedures?q=append&category=general_surgery')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.code', 'THR-APP-010');
});

it('enforces type-specific manage permissions', function (): void {
    $user = makeClinicalCatalogActor(['platform.clinical-catalog.manage-radiology-procedures']);

    $this->actingAs($user)
        ->postJson('/api/v1/platform/admin/clinical-catalogs/lab-tests', clinicalCatalogPayload())
        ->assertForbidden();
});

it('does not allow radiology permission to manage theatre procedure catalog items', function (): void {
    $user = makeClinicalCatalogActor(['platform.clinical-catalog.manage-radiology-procedures']);

    $this->actingAs($user)
        ->postJson('/api/v1/platform/admin/clinical-catalogs/theatre-procedures', clinicalCatalogPayload([
            'code' => 'THR-CHL-004',
            'name' => 'Laparoscopic Cholecystectomy',
        ]))
        ->assertForbidden();
});

it('writes clinical catalog status transition parity metadata in audit logs', function (): void {
    $user = makeClinicalCatalogActor([
        'platform.clinical-catalog.manage-lab-tests',
        'platform.clinical-catalog.view-audit-logs',
    ]);
    $created = createLabCatalogItem($user, [
        'code' => 'LAB-PARITY-001',
        'name' => 'Parity Check Test',
    ]);

    $this->actingAs($user)
        ->patchJson('/api/v1/platform/admin/clinical-catalogs/lab-tests/'.$created['id'].'/status', [
            'status' => 'inactive',
            'reason' => 'Temporary suspension',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'inactive');

    $statusAudit = ClinicalCatalogItemAuditLogModel::query()
        ->where('platform_clinical_catalog_item_id', $created['id'])
        ->where('action', 'platform.clinical-catalog-item.status.updated')
        ->latest('created_at')
        ->first();

    expect($statusAudit)->not->toBeNull();
    expect($statusAudit?->metadata ?? [])->toMatchArray([
        'catalogType' => 'lab_test',
        'transition' => [
            'from' => 'active',
            'to' => 'inactive',
        ],
        'reason_required' => true,
        'reason_provided' => true,
    ]);

    $auditResponse = $this->actingAs($user)
        ->getJson('/api/v1/platform/admin/clinical-catalogs/lab-tests/'.$created['id'].'/audit-logs?perPage=10')
        ->assertOk()
        ->assertJsonPath('meta.total', 2);

    expect(collect($auditResponse->json('data'))->pluck('action')->all())
        ->toContain('platform.clinical-catalog-item.status.updated');
});

it('rejects clinical catalog detail update when status fields are provided', function (): void {
    $user = makeClinicalCatalogActor(['platform.clinical-catalog.manage-lab-tests']);
    $created = createLabCatalogItem($user, [
        'code' => 'LAB-GUARD-001',
        'name' => 'Guardrail Test',
    ]);

    $this->actingAs($user)
        ->patchJson('/api/v1/platform/admin/clinical-catalogs/lab-tests/'.$created['id'], [
            'name' => 'Guardrail Test Updated',
            'status' => 'inactive',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['status']);
});
