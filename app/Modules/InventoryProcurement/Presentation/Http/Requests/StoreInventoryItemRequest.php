<?php

namespace App\Modules\InventoryProcurement\Presentation\Http\Requests;

use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryItemCategory;
use App\Modules\InventoryProcurement\Domain\ValueObjects\InventoryVenClassification;
use App\Modules\Platform\Domain\Services\FeatureFlagResolverInterface;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogItemStatus;
use App\Modules\Platform\Domain\ValueObjects\ClinicalCatalogType;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Support\PlatformScopeQueryApplier;
use App\Support\CatalogGovernance\CatalogPlacementAuditor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreInventoryItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'itemCode' => ['required', 'string', 'max:60'],
            'msdCode' => ['nullable', 'string', 'max:60'],
            'nhifCode' => ['nullable', 'string', 'max:60'],
            'barcode' => ['nullable', 'string', 'max:100'],
            'codes' => ['nullable', 'array'],
            'codes.LOCAL' => ['nullable', 'string', 'max:120'],
            'codes.LOINC' => ['nullable', 'string', 'max:120'],
            'codes.SNOMED_CT' => ['nullable', 'string', 'max:120'],
            'codes.GS1_GTIN' => ['nullable', 'string', 'max:120'],
            'codes.NHIF' => ['nullable', 'string', 'max:120'],
            'codes.MSD' => ['nullable', 'string', 'max:120'],
            'codes.CPT' => ['nullable', 'string', 'max:120'],
            'codes.ICD' => ['nullable', 'string', 'max:120'],
            'clinicalCatalogItemId' => ['nullable', 'uuid'],
            'itemName' => ['required', 'string', 'max:180'],
            'genericName' => ['nullable', 'string', 'max:180'],
            'dosageForm' => ['nullable', 'string', 'max:60'],
            'strength' => ['nullable', 'string', 'max:60'],
            'category' => ['required', 'string', 'max:120', Rule::in(InventoryItemCategory::values())],
            'subcategory' => ['nullable', 'string', 'max:120'],
            'venClassification' => ['nullable', Rule::in(InventoryVenClassification::values())],
            'abcClassification' => ['nullable', Rule::in(['A', 'B', 'C'])],
            'unit' => ['required', 'string', 'max:40'],
            'dispensingUnit' => ['nullable', 'string', 'max:40'],
            'conversionFactor' => ['nullable', 'numeric', 'gt:0'],
            'binLocation' => ['nullable', 'string', 'max:60'],
            'manufacturer' => ['nullable', 'string', 'max:180'],
            'storageConditions' => ['nullable', 'string', 'max:60'],
            'requiresColdChain' => ['nullable', 'boolean'],
            'isControlledSubstance' => ['nullable', 'boolean'],
            'controlledSubstanceSchedule' => ['nullable', 'string', 'max:20', 'required_if:isControlledSubstance,true'],
            'reorderLevel' => ['nullable', 'numeric', 'min:0'],
            'maxStockLevel' => ['nullable', 'numeric', 'min:0'],
            'defaultWarehouseId' => ['nullable', 'uuid'],
            'defaultSupplierId' => ['nullable', 'uuid'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $category = $this->resolvedCategory();
            if (! $category instanceof InventoryItemCategory) {
                return;
            }

            $storageConditions = trim((string) $this->input('storageConditions', ''));
            $requiresColdChain = $this->boolean('requiresColdChain');
            $isControlledSubstance = $this->boolean('isControlledSubstance');
            $schedule = trim((string) $this->input('controlledSubstanceSchedule', ''));
            $clinicalCatalogItemId = trim((string) $this->input('clinicalCatalogItemId', ''));

            if (app(CatalogPlacementAuditor::class)->looksLikeClinicalTest($this->all())) {
                $validator->errors()->add('itemName', 'This looks like a clinical test/procedure. Create CBC, urinalysis, blood culture, and similar services in Clinical Care Catalogs, not Inventory Items.');
            }

            if ($category === InventoryItemCategory::PHARMACEUTICAL && $clinicalCatalogItemId === '') {
                $validator->errors()->add('clinicalCatalogItemId', 'Select the approved medicine from Clinical Care Catalogs before creating pharmaceutical stock.');
            }

            if ($category !== InventoryItemCategory::PHARMACEUTICAL && $clinicalCatalogItemId !== '') {
                $validator->errors()->add('clinicalCatalogItemId', 'Clinical catalog linking is only valid for pharmaceutical inventory. Laboratory reagents and supplies must be created as inventory supply items, not lab tests.');
            }

            if ($clinicalCatalogItemId !== '' && ! $this->clinicalCatalogItemIsUsable($clinicalCatalogItemId)) {
                $validator->errors()->add('clinicalCatalogItemId', 'The selected clinical medicine is not active or is outside the current facility scope.');
            }

            if ($category->requiresColdChain() && ! $requiresColdChain) {
                $validator->errors()->add('requiresColdChain', 'Cold chain must remain enabled for this category.');
            }

            if (($category->requiresExpiryTracking() || $requiresColdChain) && $storageConditions === '') {
                $validator->errors()->add('storageConditions', 'Storage conditions are required for expiry-sensitive or cold-chain inventory.');
            }

            if (! $category->isControlledSubstanceEligible() && $isControlledSubstance) {
                $validator->errors()->add('isControlledSubstance', 'Controlled substance handling is only available for pharmaceutical items.');
            }

            if (! $category->isControlledSubstanceEligible() && $schedule !== '') {
                $validator->errors()->add('controlledSubstanceSchedule', 'Controlled substance schedules are only available for pharmaceutical items.');
            }
        });
    }

    private function resolvedCategory(): ?InventoryItemCategory
    {
        $value = $this->input('category');

        return is_string($value) ? InventoryItemCategory::tryFrom($value) : null;
    }

    private function clinicalCatalogItemIsUsable(string $clinicalCatalogItemId): bool
    {
        $query = ClinicalCatalogItemModel::query()
            ->whereKey($clinicalCatalogItemId)
            ->where('catalog_type', ClinicalCatalogType::FORMULARY_ITEM->value)
            ->where('status', ClinicalCatalogItemStatus::ACTIVE->value);

        if ($this->isPlatformScopingEnabled()) {
            app(PlatformScopeQueryApplier::class)->apply($query);
        }

        return $query->exists();
    }

    private function isPlatformScopingEnabled(): bool
    {
        $featureFlagResolver = app(FeatureFlagResolverInterface::class);

        return $featureFlagResolver->isEnabled('platform.multi_facility_scoping')
            || $featureFlagResolver->isEnabled('platform.multi_tenant_isolation');
    }
}
