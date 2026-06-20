# Medicine Units, Pricing, And Inventory Conversion Fix Plan

Date: 2026-06-20

## Purpose

This plan fixes medicine pricing, inventory management, and unit conversion so the system can safely support medicines sold or dispensed as tablets, capsules, doses, blisters, bottles, sachets, vials, ampoules, packs, boxes, ml, and custom facility-defined units.

The final design must guarantee:

- Every medicine has one smallest stock/base unit.
- Inventory stock is always stored, reserved, received, issued, counted, transferred, and reported in base units.
- Each medicine can have many sellable/dispensable units.
- Each sellable unit has a conversion quantity to the base unit.
- Each sellable unit can have its own purchase, retail, insurance, and wholesale price.
- Billing, pharmacy dispensing, POS, procurement receiving, stock issue, stock count, and reports use one shared conversion service.

## Current Implementation Gaps

The project currently has useful foundations, but multi-unit medicine support is incomplete.

Observed foundations:

- `inventory_items.unit` stores a stock unit.
- `inventory_items.current_stock` stores stock as a decimal.
- `inventory_items.dispensing_unit` and `inventory_items.conversion_factor` exist.
- `inventory_unit_conversions` table exists.
- `inventory_batches` supports batch number, expiry date, quantity, warehouse, unit cost, and status.
- `InventoryBatchStockService` uses transactions, row locking, FEFO allocation, negative-stock prevention, and batch-aware stock issue/receipt.
- Pharmacy dispense deducts inventory when an order is partially/finally dispensed.
- POS OTC sale deducts inventory.
- Billing service catalog has `base_price`, `price_unit`, and `units_per_pack`.
- Insurance payer contract overrides exist for service-code pricing.

Critical gaps:

- `inventory_unit_conversions` is not wired into stock receipt, issue, pharmacy dispense, POS sale, billing, or frontend unit selection.
- `dispensing_unit` and `conversion_factor` are descriptive only in practice.
- Billing catalog has one `base_price` per service code, not a normalized price per medicine selling unit.
- POS OTC sale sends only quantity and unit price, not selected unit.
- Pharmacy dispense rejects dispensing in a different unit than prescribed.
- Stock receipt and issue write raw quantities directly to `current_stock`.
- Base stock unit can be changed after transactions.
- Barcode is item-level and indexed, but not safely modeled per selling unit.
- Wholesale pricing is missing.
- Insurance pricing is service-code based, not medicine-unit based.

## Target Domain Model

### Base Concepts

Use these terms consistently:

- `base_unit`: The smallest stock unit for an inventory item, for example tablet, capsule, ml, vial, ampoule, sachet.
- `selling_unit`: A unit users can sell, prescribe, dispense, receive, or bill, for example tablet, blister, bottle, pack, box.
- `base_quantity`: How many base units equal one selling unit.
  - 1 tablet = 1 tablet.
  - 1 blister = 10 tablets.
  - 1 box = 100 tablets.
  - 1 bottle = 100 ml.
- `stock_quantity_base`: Quantity stored in base units.
- `unit_price`: Price for one selling unit, not one base unit unless the selling unit is the base unit.

### Required Invariant

All stock math must use this formula:

```text
base_quantity_delta = requested_quantity * selected_unit.base_quantity
```

Examples:

- Sell 2 blisters of amoxicillin where blister = 10 capsules: deduct 20 capsules.
- Receive 5 boxes of paracetamol where box = 100 tablets: add 500 tablets.
- Sell 1 bottle of syrup where bottle = 100 ml: deduct 100 ml.

## Database Plan

### Phase 1: Add Medicine Unit Tables

Create `inventory_item_units`.

Suggested migration:

```php
Schema::create('inventory_item_units', function (Blueprint $table): void {
    $table->uuid('id')->primary();
    $table->uuid('tenant_id')->nullable();
    $table->uuid('facility_id')->nullable();
    $table->uuid('item_id');
    $table->string('unit_name', 50);
    $table->string('unit_code', 50)->nullable();
    $table->decimal('base_quantity', 14, 6);
    $table->boolean('is_base_unit')->default(false);
    $table->boolean('is_default_sales_unit')->default(false);
    $table->boolean('is_default_purchase_unit')->default(false);
    $table->boolean('is_active')->default(true);
    $table->string('barcode', 100)->nullable();
    $table->json('metadata')->nullable();
    $table->timestamps();

    $table->unique(['item_id', 'unit_name'], 'inv_item_units_item_unit_unique');
    $table->unique(['item_id', 'barcode'], 'inv_item_units_item_barcode_unique');
    $table->index(['tenant_id', 'facility_id']);
    $table->index(['item_id', 'is_active']);
    $table->index(['barcode']);

    $table->foreign('tenant_id')->references('id')->on('tenants')->nullOnDelete();
    $table->foreign('facility_id')->references('id')->on('facilities')->nullOnDelete();
    $table->foreign('item_id')->references('id')->on('inventory_items')->cascadeOnDelete();
});
```

Rules:

- `base_quantity` must be greater than 0.
- Exactly one active base unit per item.
- The base unit row must have `base_quantity = 1`.
- Unit names must be case-normalized before save.
- Custom units are allowed.

### Phase 2: Add Medicine Unit Prices

Create `inventory_item_unit_prices`.

Suggested migration:

```php
Schema::create('inventory_item_unit_prices', function (Blueprint $table): void {
    $table->uuid('id')->primary();
    $table->uuid('tenant_id')->nullable();
    $table->uuid('facility_id')->nullable();
    $table->uuid('item_id');
    $table->uuid('inventory_item_unit_id');
    $table->string('price_type', 40); // purchase, retail, wholesale, insurance, contract
    $table->uuid('billing_payer_contract_id')->nullable();
    $table->decimal('price', 14, 2);
    $table->char('currency_code', 3)->default('TZS');
    $table->timestamp('effective_from')->nullable();
    $table->timestamp('effective_to')->nullable();
    $table->boolean('is_active')->default(true);
    $table->json('metadata')->nullable();
    $table->timestamps();

    $table->index(['item_id', 'price_type', 'is_active']);
    $table->index(['inventory_item_unit_id', 'price_type', 'is_active']);
    $table->index(['billing_payer_contract_id']);

    $table->foreign('tenant_id')->references('id')->on('tenants')->nullOnDelete();
    $table->foreign('facility_id')->references('id')->on('facilities')->nullOnDelete();
    $table->foreign('item_id')->references('id')->on('inventory_items')->cascadeOnDelete();
    $table->foreign('inventory_item_unit_id')->references('id')->on('inventory_item_units')->cascadeOnDelete();
    $table->foreign('billing_payer_contract_id')->references('id')->on('billing_payer_contracts')->nullOnDelete();
});
```

Supported `price_type` values:

- `purchase`
- `retail`
- `wholesale`
- `insurance`
- `contract`

Rules:

- Price must be non-negative.
- Active price windows must not overlap for the same item, unit, price type, payer contract, and currency.
- Insurance/contract prices may inherit from payer-contract overrides, but medicine unit price must remain resolvable from one pricing service.

### Phase 3: Add Unit Snapshot Columns To Ledger Tables

Inventory movements must preserve what the user entered and what the system converted.

Add columns to `inventory_stock_movements`:

- `requested_quantity decimal(14, 6) nullable`
- `requested_unit string(50) nullable`
- `requested_unit_id uuid nullable`
- `base_unit string(50) nullable`
- `base_quantity decimal(14, 6) nullable`
- `conversion_factor decimal(14, 6) nullable`

Keep existing `quantity` and `quantity_delta` as base-unit values for backward compatibility.

Add the same snapshot fields to:

- `inventory_batches` if receipt unit details need batch-level traceability.
- `pos_sale_lines` metadata or columns.
- `pharmacy_orders` dispense metadata or columns.
- `billing_invoices.line_items` JSON.

Minimum line-item snapshot:

```json
{
  "inventoryItemId": "...",
  "inventoryItemUnitId": "...",
  "requestedQuantity": 2,
  "requestedUnit": "blister",
  "baseQuantity": 20,
  "baseUnit": "tablet",
  "conversionFactor": 10,
  "unitPrice": 2500,
  "priceType": "retail"
}
```

### Phase 4: Migration Backfill

Backfill every existing inventory item:

1. Create one base-unit row using `inventory_items.unit`.
2. Set `base_quantity = 1`.
3. Set `is_base_unit = true`.
4. If `dispensing_unit` differs from `unit` and `conversion_factor` exists, create an additional unit row.
5. If `billing_service_catalog_items.price_unit` and `units_per_pack` exist for linked pharmacy items, create matching unit rows where possible.
6. Add retail price rows from relevant billing catalog pharmacy items.
7. Preserve legacy fields for one release, but mark them deprecated.

Backfill command:

```bash
php artisan inventory:backfill-item-units --dry-run
php artisan inventory:backfill-item-units
```

The command must output:

- Items scanned.
- Base units created.
- Selling units created.
- Price rows created.
- Items skipped.
- Ambiguous matches.

## Backend Architecture Plan

### New Models

Add:

- `app/Modules/InventoryProcurement/Infrastructure/Models/InventoryItemUnitModel.php`
- `app/Modules/InventoryProcurement/Infrastructure/Models/InventoryItemUnitPriceModel.php`

Relationships:

- `InventoryItemModel::units()`
- `InventoryItemModel::activeUnits()`
- `InventoryItemModel::unitPrices()`
- `InventoryItemUnitModel::item()`
- `InventoryItemUnitModel::prices()`

### New Services

Add `InventoryUnitConversionService`.

Required methods:

```php
public function resolveUnit(string $itemId, ?string $unitId, ?string $unitName): InventoryItemUnitModel;

public function toBaseQuantity(string $itemId, float $quantity, ?string $unitId, ?string $unitName): array;

public function assertBaseUnitImmutable(InventoryItemModel $item, ?string $requestedUnit): void;

public function listSellableUnits(string $itemId): array;
```

`toBaseQuantity()` must return:

```php
[
    'requested_quantity' => 2.0,
    'requested_unit' => 'blister',
    'requested_unit_id' => '...',
    'base_unit' => 'tablet',
    'base_quantity' => 20.0,
    'conversion_factor' => 10.0,
]
```

Add `InventoryItemUnitPricingService`.

Required methods:

```php
public function resolvePrice(
    string $itemId,
    string $unitId,
    string $priceType,
    string $currencyCode,
    ?string $payerContractId = null,
    mixed $effectiveAt = null,
): array;

public function listPricesForItem(string $itemId): array;
```

### Modify Inventory Stock Service

File:

- `app/Modules/InventoryProcurement/Application/Services/InventoryBatchStockService.php`

Required changes:

- Accept `requested_quantity`, `requested_unit`, and `requested_unit_id` in `receive`, `receiveMovement`, `issue`, `issueExactBatch`, and reconciliation where applicable.
- Convert to base quantity before stock math.
- Store base-unit values in `quantity`, `quantity_delta`, `stock_before`, and `stock_after`.
- Store requested unit snapshot in new columns and metadata.
- Do not let callers pass already-converted quantities without an explicit flag. Prefer one conversion gateway.

Acceptance:

- Receiving 5 boxes of 100 tablets increases `current_stock` by 500.
- Selling 2 blisters of 10 tablets decreases `current_stock` by 20.
- Ledger shows both requested units and base quantities.

### Modify Procurement Receive

Files:

- `ReceiveInventoryProcurementRequestUseCase`
- `InventoryProcurementController`
- `ReceiveInventoryProcurementRequestRequest`
- `resources/js/pages/inventory-procurement/...`

Required changes:

- Procurement receiving must capture received quantity and received unit.
- Default received unit to the purchase/default unit when available.
- Convert received quantity to base units before posting stock.
- Capture purchase unit cost per selected unit.

### Modify Manual Stock Movement

Files:

- `StoreInventoryStockMovementRequest`
- `CreateInventoryStockMovementUseCase`
- Inventory movement frontend sheets

Required changes:

- Add fields:
  - `quantity`
  - `unitId`
  - `unit`
- Validate selected unit belongs to the item.
- Convert before issue/receive.

### Modify Pharmacy Dispense

Files:

- `UpdatePharmacyOrderStatusUseCase`
- `StorePharmacyOrderRequest`
- `UpdatePharmacyOrderStatusRequest`
- `PharmacyOrderController`
- `resources/js/pages/pharmacy-orders/Index.vue`

Required changes:

- Allow prescribed unit and dispensed unit to differ only if a valid conversion exists.
- Convert dispensed quantity to base quantity before stock issue.
- Store prescribed unit, dispensed unit, conversion factor, and base quantity snapshots.
- Show available stock in both base unit and selected dispense unit.
- Do not reject a different dispensed unit when conversion exists.

Replace current behavior:

```php
// Existing behavior rejects unit mismatch.
// New behavior resolves conversion and issues base quantity.
```

Acceptance:

- Prescription: 20 tablets. Dispense: 2 blisters. Conversion: 1 blister = 10 tablets. Stock issue: 20 tablets.
- Prescription: 100 ml. Dispense: 1 bottle. Conversion: 1 bottle = 100 ml. Stock issue: 100 ml.

### Modify POS OTC Sale

Files:

- `CreatePharmacyOtcSaleUseCase`
- `ListPharmacyOtcCatalogUseCase`
- `PharmacyOtcCatalogSupport`
- `PosController`
- `resources/js/pages/pos/Index.vue`

Required changes:

- Catalog API must return active selling units and prices.
- Frontend must let cashier choose unit.
- POS basket item must include:
  - `inventoryItemId`
  - `unitId`
  - `unit`
  - `quantity`
  - `unitPrice`
- Backend must not trust manual unit price unless user has an override permission.
- Backend must resolve price server-side from `InventoryItemUnitPricingService`.
- Backend must convert selected quantity to base quantity before stock issue.

Acceptance:

- Cashier selects 1 box at TZS 10,000, stock deducts 100 tablets.
- Cashier selects 1 tablet at TZS 150, stock deducts 1 tablet.
- If stock has 50 tablets, selling 1 box of 100 tablets is blocked.

### Modify Billing Service Catalog

Current fields `price_unit` and `units_per_pack` are not enough.

Recommended approach:

- Keep service catalog for non-stock services.
- For pharmacy/medicine billing, link billing catalog to inventory item unit prices.
- Add optional references:
  - `inventory_item_id`
  - `inventory_item_unit_id`
  - `inventory_item_unit_price_id`

Files:

- `CreateBillingServiceCatalogItemUseCase`
- `UpdateBillingServiceCatalogItemUseCase`
- `BillingServiceCatalogItemResponseTransformer`
- `StoreBillingServiceCatalogItemRequest`
- `UpdateBillingServiceCatalogItemRequest`
- `resources/js/pages/billing-service-catalog/Index.vue`

Required changes:

- For `service_type = pharmacy`, require either a clinical formulary link or inventory item link.
- Allow selecting an inventory item unit.
- Display price by unit.
- Deprecate `units_per_pack` once `inventory_item_units.base_quantity` is active.
- Do not use `base_price` as the only medicine price when medicine unit pricing exists.

### Modify Billing Invoice Auto Pricing

Files:

- `BillingInvoiceLineItemAutoPricingResolver`
- `CreateBillingInvoiceUseCase`
- Billing invoice frontend components

Required changes:

- If line item references a medicine inventory item/unit, resolve price through `InventoryItemUnitPricingService`.
- If payer contract exists, resolve `insurance` or `contract` price first, then fallback to retail.
- Include unit snapshot in line item JSON.
- Billing invoice creation should not automatically deduct stock unless the workflow explicitly represents a sale/dispense. Stock should be deducted by POS sale or pharmacy dispense, not duplicate billing.

Acceptance:

- Insurance patient receives price from payer contract medicine unit price.
- Self-pay patient receives retail price.
- Wholesale customer receives wholesale price if POS/customer type supports it.

## API Design Plan

### Inventory Item Units

Add endpoints:

```http
GET    /api/v1/inventory-procurement/items/{item}/units
POST   /api/v1/inventory-procurement/items/{item}/units
PATCH  /api/v1/inventory-procurement/items/{item}/units/{unit}
DELETE /api/v1/inventory-procurement/items/{item}/units/{unit}
```

Delete rules:

- Cannot delete base unit.
- Cannot delete a unit referenced by stock movements, POS lines, pharmacy orders, billing invoice lines, or price rows.
- Use inactive status instead of delete for historical units.

### Unit Prices

Add endpoints:

```http
GET    /api/v1/inventory-procurement/items/{item}/unit-prices
POST   /api/v1/inventory-procurement/items/{item}/unit-prices
PATCH  /api/v1/inventory-procurement/items/{item}/unit-prices/{price}
DELETE /api/v1/inventory-procurement/items/{item}/unit-prices/{price}
```

### POS OTC Catalog

Update response:

```json
{
  "id": "clinical-catalog-id",
  "inventoryItem": {
    "id": "inventory-item-id",
    "baseUnit": "tablet",
    "availableBaseQuantity": 250
  },
  "units": [
    {
      "id": "unit-id",
      "unit": "tablet",
      "baseQuantity": 1,
      "availableQuantity": 250,
      "retailPrice": 150,
      "wholesalePrice": 120,
      "barcode": "..."
    },
    {
      "id": "unit-id",
      "unit": "blister",
      "baseQuantity": 10,
      "availableQuantity": 25,
      "retailPrice": 1200,
      "barcode": "..."
    }
  ]
}
```

### Barcode Lookup

Update barcode lookup order:

1. Search `inventory_item_units.barcode`.
2. Fallback to `inventory_items.barcode`.
3. Return item, unit, price, and available quantity.

## Frontend Plan

### Inventory Master Data

Files:

- `resources/js/pages/inventory-procurement/workspace/WorkspaceInventoryOpsSheets.vue`
- `resources/js/pages/inventory-procurement/workspace/WorkspaceItemDetailsSheet.vue`
- `resources/js/pages/inventory-procurement/workspace/registerInventoryWorkspaceApi.ts`
- `resources/js/pages/inventory-procurement/workspace/inventoryWorkspaceApi.ts`

Required UX:

- Rename `Stock Unit` to `Base Stock Unit`.
- Show a unit management tab/table on item details.
- Add unit rows with:
  - unit name
  - base quantity
  - barcode
  - active status
  - default sales unit
  - default purchase unit
- Add price rows with:
  - unit
  - price type
  - price
  - currency
  - payer contract if applicable
  - effective dates
- Disable editing base unit after movements exist.

### POS OTC

File:

- `resources/js/pages/pos/Index.vue`

Required UX:

- Medicine card shows available base stock and available selling units.
- Cashier selects unit before adding to basket.
- Unit price auto-populates from backend.
- Manual price override requires permission and reason.
- Basket line shows:
  - quantity
  - unit
  - base quantity to deduct
  - price
  - line total
- Checkout sends `unitId`.

### Pharmacy Orders

File:

- `resources/js/pages/pharmacy-orders/Index.vue`

Required UX:

- Medicine selection loads available units.
- Prescribed unit defaults to default dispense/sales unit.
- Dispense dialog allows selecting a valid dispense unit.
- Show conversion preview:

```text
2 blisters = 20 tablets deducted
```

- Show insufficient stock in selected unit and base unit.

### Billing Catalog

File:

- `resources/js/pages/billing-service-catalog/Index.vue`

Required UX:

- For pharmacy services, allow selecting inventory item and unit.
- Show unit price rows instead of only `basePrice`.
- Keep `basePrice` for non-stock services.
- Warn if pharmacy catalog item has no inventory unit price.

## Data Integrity Rules

Implement validations:

- Duplicate unit names per item are blocked.
- Duplicate unit barcode per item is blocked.
- Base unit cannot be deleted.
- Base unit cannot be changed after any stock movement exists.
- Unit with historical usage cannot be deleted; it can only be deactivated.
- Unit conversion factor must be positive.
- Base unit conversion factor must be exactly 1.
- Only one base unit per item.
- Only one default sales unit per item.
- Only one default purchase unit per item.
- Active price windows cannot overlap.
- Stock issue cannot produce negative base stock.
- Batch quantity and item stock must stay balanced for tracked items.
- Expired/quarantined batches cannot be issued.
- POS price override requires permission and audit reason.
- Billing must not deduct stock if pharmacy/POS already deducted stock.

## Security Rules

Permissions to add:

- `inventory.procurement.manage-item-units`
- `inventory.procurement.manage-unit-prices`
- `inventory.procurement.override-unit-conversion`
- `pos.pharmacy-otc.override-price`
- `billing.service-catalog.link-inventory-units`

Audit:

- Audit every unit create/update/deactivate.
- Audit every unit price create/update/deactivate.
- Audit every manual price override.
- Audit every conversion snapshot on stock movement.

## Testing Plan

### Unit Tests

Add tests for:

- Conversion service converts tablet, blister, box, bottle, ml.
- Base unit returns same quantity.
- Unknown unit fails.
- Inactive unit fails.
- Base unit cannot be changed after transactions.
- Unit cannot be deleted when used.
- Price resolver chooses retail, wholesale, insurance, contract in correct priority.
- Price resolver respects effective dates.

### Feature Tests

Add tests in:

- `tests/Feature/InventoryProcurement`
- `tests/Feature/Pharmacy`
- `tests/Feature/Pos`
- `tests/Feature/Billing`

Scenarios:

1. Create medicine with base unit tablet.
2. Add units tablet, blister, box.
3. Add prices for tablet, blister, box.
4. Receive 5 boxes and assert stock increases by 500 tablets.
5. Sell 2 blisters in POS and assert stock decreases by 20 tablets.
6. Dispense 1 bottle syrup and assert stock decreases by 100 ml.
7. Attempt sale above converted stock and assert 422.
8. Insurance invoice resolves contract unit price.
9. Wholesale sale resolves wholesale unit price.
10. Attempt deleting used unit and assert blocked.
11. Attempt changing base unit after movement and assert blocked.
12. Barcode lookup returns unit-level barcode result.

### Frontend Verification

Run:

```bash
cmd /c npm run build
php artisan test --filter Inventory
php artisan test --filter Pharmacy
php artisan test --filter Pos
php artisan test --filter Billing
```

Manual browser checks:

- Inventory item unit management.
- Procurement receipt with purchase unit.
- POS OTC unit selection.
- Pharmacy dispense unit conversion preview.
- Billing catalog pharmacy item unit pricing.

## Rollout Plan

### Step 1: Add Schema And Backfill

- Add migrations.
- Add models.
- Add backfill command.
- Run dry-run backfill locally.
- Add tests for backfill.

### Step 2: Add Conversion And Pricing Services

- Add `InventoryUnitConversionService`.
- Add `InventoryItemUnitPricingService`.
- Test services thoroughly.

### Step 3: Wire Inventory Stock Movements

- Update stock service.
- Update procurement receipt.
- Update manual stock issue/receive.
- Update stock ledger response transformers.

### Step 4: Wire Pharmacy And POS

- Update pharmacy dispense.
- Update POS OTC catalog.
- Update POS checkout.
- Add frontend unit selectors.

### Step 5: Wire Billing

- Update billing service catalog for inventory unit links.
- Update invoice auto-pricing to use medicine unit prices.
- Preserve non-stock service pricing behavior.

### Step 6: Harden Integrity

- Add validation and delete/deactivate guards.
- Add base-unit immutability guard.
- Add barcode uniqueness and lookup behavior.

### Step 7: Remove Deprecated Fields Later

Do not immediately remove:

- `inventory_items.dispensing_unit`
- `inventory_items.conversion_factor`
- `billing_service_catalog_items.price_unit`
- `billing_service_catalog_items.units_per_pack`

Keep them for compatibility during migration. After all modules use `inventory_item_units`, create a cleanup migration or leave them read-only for legacy reporting.

## Acceptance Criteria

The fix is complete only when all are true:

- A medicine can have multiple active units.
- Each unit has a conversion quantity to base unit.
- Each unit can have retail, purchase, wholesale, and insurance/contract prices.
- Stock is always stored in base unit.
- Receipts convert selected purchase unit to base unit.
- POS sales convert selected selling unit to base unit.
- Pharmacy dispense converts selected dispense unit to base unit.
- Billing resolves correct unit price.
- Negative stock cannot occur.
- Base unit cannot be changed after transactions.
- Used units cannot be deleted.
- Barcode can resolve item-level or unit-level sales.
- Tests cover conversion, price resolution, stock movement, POS sale, pharmacy dispense, billing invoice, and integrity guards.

## Implementation Notes For Agents

- Do not bypass `InventoryBatchStockService`; improve it so every stock-changing workflow stays centralized.
- Do not calculate conversions independently in controllers or Vue components. The backend service is the source of truth.
- Frontend can display conversion previews, but backend must recompute and validate.
- Preserve transaction boundaries and row locking.
- Preserve existing tenant/facility scoping.
- Preserve FEFO batch allocation.
- Prefer deactivation over deletion for historical records.
- Keep existing billing behavior for labs, radiology, consultations, and procedures.
- Use explicit `inventory_item_id` links where possible; avoid matching medicines by name/code once unit support is added.
- Add audit logs before considering the implementation complete.
