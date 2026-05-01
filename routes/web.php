<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;
use App\Modules\Billing\Presentation\Http\Controllers\BillingInvoiceDocumentController;
use App\Modules\ClaimsInsurance\Presentation\Http\Controllers\ClaimsInsuranceDocumentController;
use App\Modules\InventoryProcurement\Presentation\Http\Controllers\InventoryWarehouseTransferDocumentController;
use App\Modules\InpatientWard\Presentation\Http\Controllers\InpatientWardDischargeChecklistDocumentController;
use App\Modules\MedicalRecord\Presentation\Http\Controllers\MedicalRecordDocumentController;
use App\Modules\Platform\Presentation\Http\Controllers\PlatformBrandingController;
use App\Modules\Pos\Presentation\Http\Controllers\PosRegisterSessionDocumentController;
use App\Modules\Pos\Presentation\Http\Controllers\PosSaleDocumentController;
use App\Support\Branding\SystemBrandingManager;

Route::get('branding/logo', [PlatformBrandingController::class, 'logo'])->name('branding.logo');
Route::get('branding/icon', [PlatformBrandingController::class, 'icon'])->name('branding.icon');

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::get('dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

// Role-based dashboards
Route::get('dashboard/registration-clerk', function () {
    return Inertia::render('dashboard/RegistrationClerk');
})->middleware(['auth', 'verified', 'can:patients.create'])->name('dashboard.registration-clerk');

Route::get('dashboard/nurse', function () {
    return Inertia::render('dashboard/Nurse');
})->middleware(['auth', 'verified', 'can:inpatient.ward.read'])->name('dashboard.nurse');

Route::get('patients', function () {
    return Inertia::render('patients/Index');
})->middleware(['auth', 'verified', 'can:patients.read', 'facility.entitlement:patients.search'])->name('patients.page');

Route::get('patients/{id}/chart', function (string $id) {
    return Inertia::render('patients/chart/Show', [
        'patientId' => $id,
    ]);
})->middleware(['auth', 'verified', 'can:patients.read', 'facility.entitlement:patients.search'])->name('patients.chart.page');

Route::get('appointments', function () {
    return Inertia::render('appointments/Index');
})->middleware(['auth', 'verified', 'can:appointments.read', 'facility.entitlement:appointments.scheduling'])->name('appointments.page');

Route::get('admissions', function () {
    return Inertia::render('admissions/Index');
})->middleware(['auth', 'verified', 'can:admissions.read', 'facility.entitlement:admissions.management'])->name('admissions.page');

Route::get('medical-records', function () {
    return Inertia::render('medical-records/Index');
})->middleware(['auth', 'verified', 'can:medical.records.read', 'facility.entitlement:medical_records.core'])->name('medical-records.page');

Route::get('medical-records/{id}/print', [MedicalRecordDocumentController::class, 'show'])
    ->middleware(['auth', 'verified', 'can:medical.records.read', 'facility.entitlement:medical_records.core'])
    ->name('medical-records.print.page');

Route::get('medical-records/{id}/pdf', [MedicalRecordDocumentController::class, 'downloadPdf'])
    ->middleware(['auth', 'verified', 'can:medical.records.read', 'facility.entitlement:medical_records.core'])
    ->name('medical-records.pdf.download');

Route::get('laboratory-orders', function () {
    return Inertia::render('laboratory-orders/Index');
})->middleware(['auth', 'verified', 'can:laboratory.orders.read', 'facility.entitlement:laboratory.orders'])->name('laboratory-orders.page');

Route::get('pharmacy-orders', function () {
    return Inertia::render('pharmacy-orders/Index');
})->middleware(['auth', 'verified', 'can:pharmacy.orders.read', 'facility.entitlement:pharmacy.orders'])->name('pharmacy-orders.page');

Route::get('billing-invoices', function () {
    return Inertia::render('billing-invoices/Index');
})->middleware(['auth', 'verified', 'can:billing.invoices.read', 'facility.entitlement:billing.invoices'])->name('billing-invoices.page');

Route::get('billing-cash', function () {
    return Inertia::render('billing-cash/Index');
})->middleware(['auth', 'verified', 'can:billing.cash-accounts.read', 'facility.entitlement:billing.cash_accounts'])->name('billing-cash.page');

Route::get('billing-payment-plans', function () {
    return Inertia::render('billing-payment-plans/Index');
})->middleware(['auth', 'verified', 'can:billing.invoices.read', 'facility.entitlement:billing.payment_plans'])->name('billing-payment-plans.page');

Route::get('pos', function () {
    return Inertia::render('pos/Index');
})->middleware(['auth', 'verified', 'can:pos.registers.read', 'facility.entitlement:pos.registers_sessions'])->name('pos.page');

Route::get('pos/sales/{id}/print', [PosSaleDocumentController::class, 'show'])
    ->middleware(['auth', 'verified', 'can:pos.sales.read', 'facility.entitlement:pos.sales'])
    ->name('pos.sales.print.page');

Route::get('pos/sales/{id}/pdf', [PosSaleDocumentController::class, 'downloadPdf'])
    ->middleware(['auth', 'verified', 'can:pos.sales.read', 'facility.entitlement:pos.sales'])
    ->name('pos.sales.pdf.download');

Route::get('pos/sessions/{id}/report', [PosRegisterSessionDocumentController::class, 'show'])
    ->middleware(['auth', 'verified', 'can:pos.sessions.read', 'facility.entitlement:pos.registers_sessions'])
    ->name('pos.sessions.report.page');

Route::get('pos/sessions/{id}/report.pdf', [PosRegisterSessionDocumentController::class, 'downloadPdf'])
    ->middleware(['auth', 'verified', 'can:pos.sessions.read', 'facility.entitlement:pos.registers_sessions'])
    ->name('pos.sessions.report.pdf.download');

Route::get('billing-refunds', function () {
    return Inertia::render('billing-refunds/Index');
})->middleware(['auth', 'verified', 'can:billing.refunds.read', 'facility.entitlement:billing.discounts_refunds'])->name('billing-refunds.page');

Route::get('billing-discounts', function () {
    return Inertia::render('billing-discounts/Index');
})->middleware(['auth', 'verified', 'can:billing.discounts.read', 'facility.entitlement:billing.discounts_refunds'])->name('billing-discounts.page');

Route::get('billing-financial-reports', function () {
    return Inertia::render('billing-financial-reports/Index');
})->middleware(['auth', 'verified', 'can:billing.financial-controls.read', 'facility.entitlement:billing.financial_controls'])->name('billing-financial-reports.page');

Route::get('billing-corporate', function () {
    return Inertia::render('billing-corporate/Index');
})->middleware(['auth', 'verified', 'can:billing.payer-contracts.read', 'facility.entitlement:billing.payer_contracts'])->name('billing-corporate.page');

Route::get('billing-invoices/{id}/print', [BillingInvoiceDocumentController::class, 'show'])
    ->middleware(['auth', 'verified', 'can:billing.invoices.read', 'facility.entitlement:billing.invoices'])
    ->name('billing-invoices.print.page');

Route::get('billing-invoices/{id}/pdf', [BillingInvoiceDocumentController::class, 'downloadPdf'])
    ->middleware(['auth', 'verified', 'can:billing.invoices.read', 'facility.entitlement:billing.invoices'])
    ->name('billing-invoices.pdf.download');

Route::get('claims-insurance/{id}/print', [ClaimsInsuranceDocumentController::class, 'show'])
    ->middleware(['auth', 'verified', 'can:claims.insurance.read', 'facility.entitlement:claims.insurance'])
    ->name('claims-insurance.print.page');

Route::get('claims-insurance/{id}/pdf', [ClaimsInsuranceDocumentController::class, 'downloadPdf'])
    ->middleware(['auth', 'verified', 'can:claims.insurance.read', 'facility.entitlement:claims.insurance'])
    ->name('claims-insurance.pdf.download');

Route::get('billing-payer-contracts', function () {
    return Inertia::render('billing-payer-contracts/Index');
})->middleware(['auth', 'verified', 'can:billing.payer-contracts.read', 'facility.entitlement:billing.payer_contracts'])->name('billing-payer-contracts.page');

Route::get('billing-service-catalog', function () {
    return Inertia::render('billing-service-catalog/Index');
})->middleware(['auth', 'verified', 'can:billing.service-catalog.read', 'facility.entitlement:billing.service_catalog'])->name('billing-service-catalog.page');

Route::get('staff', function () {
    return Inertia::render('staff/Index');
})->middleware(['auth', 'verified', 'can:staff.read', 'facility.entitlement:staff.profiles'])->name('staff.page');

Route::get('staff-credentialing', function () {
    return Inertia::render('staff-credentialing/Index');
})->middleware(['auth', 'verified', 'can:staff.credentialing.read', 'facility.entitlement:staff.credentialing'])->name('staff-credentialing.page');

Route::get('staff-privileges', function () {
    return Inertia::render('staff-privileges/Index');
})->middleware(['auth', 'verified', 'can:staff.privileges.read', 'facility.entitlement:staff.privileges'])->name('staff-privileges.page');

Route::get('platform/admin/users', function () {
    return Inertia::render('platform/admin/users/Index');
})->middleware(['auth', 'verified', 'can:platform.users.read'])->name('platform-admin-users.page');

Route::get('platform/admin/user-approval-cases', function () {
    return Inertia::render('platform/admin/user-approval-cases/Index');
})->middleware(['auth', 'verified', 'can:platform.users.approval-cases.read'])->name('platform-admin-user-approval-cases.page');

Route::get('platform/admin/roles', function () {
    return Inertia::render('platform/admin/roles/Index');
})->middleware(['auth', 'verified', 'can:platform.rbac.manage-roles'])->name('platform-admin-roles.page');

Route::get('platform/admin/permissions', function () {
    return Inertia::render('platform/admin/roles/Index');
})->middleware(['auth', 'verified', 'can:platform.rbac.manage-roles'])->name('platform-admin-permissions.page');

Route::get('platform/admin/specialties', function () {
    return Inertia::render('platform/admin/specialties/Index');
})->middleware(['auth', 'verified', 'can:specialties.read'])->name('platform-admin-specialties.page');

Route::get('platform/admin/privilege-catalogs', function () {
    return Inertia::render('platform/admin/privilege-catalogs/Index');
})->middleware(['auth', 'verified', 'can:staff.privileges.read'])->name('platform-admin-privilege-catalogs.page');

Route::get('platform/admin/departments', function () {
    return Inertia::render('platform/admin/departments/Index');
})->middleware(['auth', 'verified', 'can:departments.read'])->name('platform-admin-departments.page');

Route::get('platform/admin/service-points', function () {
    return Inertia::render('platform/admin/service-points/Index');
})->middleware(['auth', 'verified', 'can:platform.resources.read'])->name('platform-admin-service-points.page');

Route::get('platform/admin/ward-beds', function () {
    return Inertia::render('platform/admin/ward-beds/Index');
})->middleware(['auth', 'verified', 'can:platform.resources.read'])->name('platform-admin-ward-beds.page');

Route::get('platform/admin/facility-rollouts', function () {
    return Inertia::render('platform/admin/facility-rollouts/Index');
})->middleware(['auth', 'verified', 'can:platform.multi-facility.read'])->name('platform-admin-facility-rollouts.page');

Route::get('platform/admin/facility-config', function () {
    return Inertia::render('platform/admin/facility-config/Index');
})->middleware(['auth', 'verified', 'can:platform.facilities.read'])->name('platform-admin-facility-config.page');

Route::get('platform/admin/service-plans', function () {
    return Inertia::render('platform/admin/service-plans/Index');
})->middleware(['auth', 'verified', 'can:platform.subscription-plans.read'])->name('platform-admin-service-plans.page');

Route::get('platform/admin/branding', function (SystemBrandingManager $brandingManager) {
    return Inertia::render('platform/admin/branding/Index', [
        'mailBranding' => $brandingManager->mailBranding(),
    ]);
})->middleware(['auth', 'verified', 'can:platform.settings.manage-branding'])->name('platform-admin-branding.page');

Route::get('platform/admin/clinical-catalogs', function () {
    return Inertia::render('platform/admin/clinical-catalogs/Index');
})->middleware(['auth', 'verified', 'can:platform.clinical-catalog.read'])->name('platform-admin-clinical-catalogs.page');

Route::get('radiology-orders', function () {
    return Inertia::render('radiology-orders/Index');
})->middleware(['auth', 'verified', 'can:radiology.orders.read', 'facility.entitlement:radiology.orders'])->name('radiology-orders.page');

Route::get('emergency-triage', function () {
    return Inertia::render('emergency-triage/Index');
})->middleware(['auth', 'verified', 'can:emergency.triage.read', 'facility.entitlement:emergency.triage'])->name('emergency-triage.page');

Route::get('inpatient-ward', function () {
    return Inertia::render('inpatient-ward/Index');
})->middleware(['auth', 'verified', 'can:inpatient.ward.read', 'facility.entitlement:inpatient.ward'])->name('inpatient-ward.page');

Route::get('inpatient-ward/discharge-checklists/{id}/print', [InpatientWardDischargeChecklistDocumentController::class, 'show'])
    ->middleware(['auth', 'verified', 'can:inpatient.ward.read', 'facility.entitlement:inpatient.care_plans'])
    ->name('inpatient-ward-discharge-checklists.print.page');

Route::get('inpatient-ward/discharge-checklists/{id}/pdf', [InpatientWardDischargeChecklistDocumentController::class, 'downloadPdf'])
    ->middleware(['auth', 'verified', 'can:inpatient.ward.read', 'facility.entitlement:inpatient.care_plans'])
    ->name('inpatient-ward-discharge-checklists.pdf.download');

Route::get('theatre-procedures', function () {
    return Inertia::render('theatre-procedures/Index');
})->middleware(['auth', 'verified', 'can:theatre.procedures.read', 'facility.entitlement:theatre.procedures'])->name('theatre-procedures.page');

Route::get('claims-insurance', function () {
    return Inertia::render('claims-insurance/Index');
})->middleware(['auth', 'verified', 'can:claims.insurance.read', 'facility.entitlement:claims.insurance'])->name('claims-insurance.page');

Route::get('inventory-procurement', function () {
    return Inertia::render('inventory-procurement/Index');
})->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.procurement'])->name('inventory-procurement.page');

Route::get('inventory-procurement/suppliers', function () {
    return Inertia::render('inventory-procurement/suppliers/Index');
})->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.suppliers'])->name('inventory-procurement-suppliers.page');

Route::get('inventory-procurement/warehouses', function () {
    return Inertia::render('inventory-procurement/warehouses/Index');
})->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.warehouses'])->name('inventory-procurement-warehouses.page');

Route::get('inventory-procurement/warehouse-transfers/{id}/pick-slip', [InventoryWarehouseTransferDocumentController::class, 'showPickSlip'])
    ->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.transfers'])
    ->name('inventory-procurement-warehouse-transfers.pick-slip.page');

Route::get('inventory-procurement/warehouse-transfers/{id}/pick-slip.pdf', [InventoryWarehouseTransferDocumentController::class, 'downloadPickSlipPdf'])
    ->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.transfers'])
    ->name('inventory-procurement-warehouse-transfers.pick-slip.pdf.download');

Route::get('inventory-procurement/warehouse-transfers/{id}/dispatch-note', [InventoryWarehouseTransferDocumentController::class, 'showDispatchNote'])
    ->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.transfers'])
    ->name('inventory-procurement-warehouse-transfers.dispatch-note.page');

Route::get('inventory-procurement/warehouse-transfers/{id}/dispatch-note.pdf', [InventoryWarehouseTransferDocumentController::class, 'downloadDispatchNotePdf'])
    ->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.transfers'])
    ->name('inventory-procurement-warehouse-transfers.dispatch-note.pdf.download');

Route::get('help/shortcuts', function () {
    return Inertia::render('help/Shortcuts');
})->middleware(['auth', 'verified'])->name('help.shortcuts');

Route::get('docs/opd-ui-sprint1-workflow-status', function () {
    $path = base_path('documents/00-governance/OPD_UI_SPRINT1_WORKFLOW_STATUS.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.opd-ui-sprint1-workflow-status');

Route::get('docs/project-restructure-plan', function () {
    $path = base_path('documents/00-governance/PROJECT_RESTRUCTURE_PLAN.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.project-restructure-plan');

Route::get('docs/controlled-breadth-first-plan', function () {
    $path = base_path('documents/00-governance/CONTROLLED_BREADTH_FIRST_PLAN_V1.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.controlled-breadth-first-plan');

Route::get('docs/radiology-v1-contract', function () {
    $path = base_path('documents/01-contracts/domain/RADIOLOGY_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.radiology-v1-contract');

Route::get('docs/emergency-triage-v1-contract', function () {
    $path = base_path('documents/01-contracts/domain/EMERGENCY_TRIAGE_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.emergency-triage-v1-contract');

Route::get('docs/inpatient-ward-operations-v1-contract', function () {
    $path = base_path('documents/01-contracts/domain/INPATIENT_WARD_OPERATIONS_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.inpatient-ward-operations-v1-contract');

Route::get('docs/theatre-procedure-workflow-v1-contract', function () {
    $path = base_path('documents/01-contracts/domain/THEATRE_PROCEDURE_WORKFLOW_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.theatre-procedure-workflow-v1-contract');

Route::get('docs/claims-insurance-adjudication-v1-contract', function () {
    $path = base_path('documents/01-contracts/domain/CLAIMS_INSURANCE_ADJUDICATION_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.claims-insurance-adjudication-v1-contract');

Route::get('docs/inventory-procurement-stores-v1-contract', function () {
    $path = base_path('documents/01-contracts/domain/INVENTORY_PROCUREMENT_STORES_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.inventory-procurement-stores-v1-contract');

Route::get('docs/supplier-management-v1-contract', function () {
    $path = base_path('documents/01-contracts/domain/SUPPLIER_MANAGEMENT_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.supplier-management-v1-contract');

Route::get('docs/warehouse-management-v1-contract', function () {
    $path = base_path('documents/01-contracts/domain/WAREHOUSE_MANAGEMENT_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.warehouse-management-v1-contract');

Route::get('docs/billing-payer-contract-auth-rules-v1-contract', function () {
    $path = base_path('documents/01-contracts/domain/BILLING_PAYER_CONTRACT_AUTH_RULES_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.billing-payer-contract-auth-rules-v1-contract');

Route::get('docs/billing-service-catalog-v1-contract', function () {
    $path = base_path('documents/01-contracts/domain/BILLING_SERVICE_CATALOG_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.billing-service-catalog-v1-contract');

Route::get('docs/clinical-catalog-governance-v1-contract', function () {
    $path = base_path('documents/01-contracts/domain/CLINICAL_CATALOG_GOVERNANCE_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.clinical-catalog-governance-v1-contract');

Route::get('docs/clinical-specialty-registry-v1-contract', function () {
    $path = base_path('documents/01-contracts/domain/CLINICAL_SPECIALTY_REGISTRY_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.clinical-specialty-registry-v1-contract');

Route::get('docs/department-management-v1-contract', function () {
    $path = base_path('documents/01-contracts/domain/DEPARTMENT_MANAGEMENT_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.department-management-v1-contract');

Route::get('docs/service-point-ward-resource-registry-v1-contract', function () {
    $path = base_path('documents/01-contracts/platform/SERVICE_POINT_WARD_RESOURCE_REGISTRY_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.service-point-ward-resource-registry-v1-contract');

Route::get('docs/platform-multi-facility-rollout-operations-v1-contract', function () {
    $path = base_path('documents/01-contracts/platform/PLATFORM_MULTI_FACILITY_ROLLOUT_OPERATIONS_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.platform-multi-facility-rollout-operations-v1-contract');

Route::get('docs/platform-facility-configuration-and-ownership-v1-contract', function () {
    $path = base_path('documents/01-contracts/platform/PLATFORM_FACILITY_CONFIGURATION_AND_OWNERSHIP_V1_CONTRACT.md');
    abort_unless(is_file($path), 404);

    return response()->file($path, [
        'Content-Type' => 'text/markdown; charset=UTF-8',
    ]);
})->middleware(['auth', 'verified'])->name('docs.platform-facility-configuration-and-ownership-v1-contract');

require __DIR__.'/settings.php';
