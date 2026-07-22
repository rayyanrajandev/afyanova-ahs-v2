<?php

use App\Modules\Billing\Presentation\Http\Controllers\BillingInvoiceDocumentController;
use App\Modules\Billing\Presentation\Http\Controllers\BillingPaymentReceiptDocumentController;
use App\Modules\ClaimsInsurance\Presentation\Http\Controllers\ClaimsInsuranceDocumentController;
use App\Modules\InpatientWard\Presentation\Http\Controllers\InpatientWardDischargeChecklistDocumentController;
use App\Modules\InventoryProcurement\Presentation\Http\Controllers\InventoryProcurementDocumentController;
use App\Modules\InventoryProcurement\Presentation\Http\Controllers\InventoryWarehouseTransferDocumentController;
use App\Modules\Encounter\Application\UseCases\ResolveEncounterForAppointmentUseCase;
use App\Modules\Encounter\Presentation\Http\Controllers\EncounterDocumentController;
use App\Modules\MedicalRecord\Application\Exceptions\AppointmentNotEligibleForMedicalRecordException;
use App\Modules\MedicalRecord\Presentation\Http\Controllers\MedicalRecordDocumentController;
use App\Modules\Platform\Application\UseCases\GetDashboardContextUseCase;
use App\Modules\Platform\Presentation\Http\Controllers\PlatformBrandingController;
use App\Modules\Pos\Presentation\Http\Controllers\PosRegisterSessionDocumentController;
use App\Modules\Pos\Presentation\Http\Controllers\PosSaleDocumentController;
use App\Support\Branding\SystemBrandingManager;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('branding/logo', [PlatformBrandingController::class, 'logo'])->name('branding.logo');
Route::get('branding/icon', [PlatformBrandingController::class, 'icon'])->name('branding.icon');

Route::get('auth/csrf-token', function (Request $request) {
    $request->session()->regenerateToken();

    return response()->json([
        'token' => csrf_token(),
    ]);
})->middleware('throttle:30,1')->name('auth.csrf-token.web');

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::get('pending-setup', function () {
    return Inertia::render('errors/PendingSetup');
})->middleware(['auth'])->name('pending-setup');

Route::middleware(['user.has-role'])->group(function () {

Route::get('dashboard', function (GetDashboardContextUseCase $dashboardContext) {
    return Inertia::render('Dashboard', [
        'dashboardContext' => $dashboardContext->execute(request()->user()),
    ]);
})->middleware(['auth', 'verified'])->name('dashboard');

// Cut over to the rebuilt page (Phase 6 of
// reports/patients-index-modernization-plan.md). The old page remains
// reachable at patients/legacy for rollback — same precedent
// patients/{id}/chart/legacy established during the Patient Chart rebuild.
Route::get('patients', function () {
    return Inertia::render('patients/IndexV2');
})->middleware(['auth', 'verified', 'can:patients.read', 'facility.entitlement:patients.search'])->name('patients.page');

Route::get('patients/v2', function () {
    return Inertia::render('patients/IndexV2');
})->middleware(['auth', 'verified', 'can:patients.read', 'facility.entitlement:patients.search'])->name('patients.page.v2');

// Rollback path — the pre-cutover page, unchanged.
Route::get('patients/legacy', function () {
    return Inertia::render('patients/Index');
})->middleware(['auth', 'verified', 'can:patients.read', 'facility.entitlement:patients.search'])->name('patients.page.legacy');

// Cut over to the rebuilt page (reports/patient-chart-rebuild-plan.md).
// The old page remains reachable at patients/{id}/chart/legacy for rollback.
Route::get('patients/{id}/chart', function (string $id) {
    return Inertia::render('patients/chart/ShowV2', [
        'patientId' => $id,
    ]);
})->middleware(['auth', 'verified', 'can:patients.read', 'facility.entitlement:patients.search'])->name('patients.chart.page');

Route::get('patients/{id}/chart/v2', function (string $id) {
    return Inertia::render('patients/chart/ShowV2', [
        'patientId' => $id,
    ]);
})->middleware(['auth', 'verified', 'can:patients.read', 'facility.entitlement:patients.search'])->name('patients.chart.v2');

// Rollback path — the pre-cutover page, unchanged.
Route::get('patients/{id}/chart/legacy', function (string $id) {
    return Inertia::render('patients/chart/Show', [
        'patientId' => $id,
    ]);
})->middleware(['auth', 'verified', 'can:patients.read', 'facility.entitlement:patients.search'])->name('patients.chart.legacy');

// Phase 6 (cutover) of reports/appointments-scheduling-workspace-
// modernization-plan.md — same precedent patients.page's own cutover
// established: swap the live route to the rebuilt page, keep the old page
// reachable at appointments/legacy for rollback. Phase 4 (Clinician Queue)
// and Phase 5 (Referrals) are not built yet — this cutover is scoped to
// what IndexV2.vue actually covers today (scheduling: list/create/edit/
// reschedule/cancel/no-show), matching §2.1's responsibility table; the
// operational actions the legacy page also has (triage, consultation,
// referrals) already live on their own pages (triage/Queue.vue, and a
// future clinician/Queue.vue), not this one.
Route::get('appointments', function () {
    return Inertia::render('appointments/IndexV2');
})->middleware(['auth', 'verified', 'can:appointments.read', 'facility.entitlement:appointments.scheduling'])->name('appointments.page');

Route::get('appointments/v2', function () {
    return Inertia::render('appointments/IndexV2');
})->middleware(['auth', 'verified', 'can:appointments.read', 'facility.entitlement:appointments.scheduling'])->name('appointments.page.v2');

// Rollback path — the pre-cutover page, unchanged.
Route::get('appointments/legacy', function () {
    return Inertia::render('appointments/Index');
})->middleware(['auth', 'verified', 'can:appointments.read', 'facility.entitlement:appointments.scheduling'])->name('appointments.page.legacy');

// Phase 6 (slice 1) of reports/patient-arrival-checkin-modernization-plan.md:
// a new, standalone page — no predecessor to replace, so no V2/legacy-fallback
// route pair, matching encounters/List.vue's precedent.
Route::get('reception/queue', function () {
    return Inertia::render('reception/Queue');
})->middleware(['auth', 'verified', 'can:appointments.read', 'facility.entitlement:appointments.scheduling'])->name('reception.queue');

// Phase 4 of reports/queue-based-workflow-modernization-plan.md: a new,
// standalone page, same reasoning as reception/queue above — no existing
// page shows the visit journey across Lab/Pharmacy/Radiology to replace.
Route::get('patient-flow/board', function () {
    return Inertia::render('patient-flow/Board');
})->middleware(['auth', 'verified', 'can:appointments.read', 'facility.entitlement:appointments.scheduling'])->name('patient-flow.board');

// Phase 3 (corrected) of reports/appointments-scheduling-workspace-
// modernization-plan.md: a new, standalone, nurse-scoped page — deliberately
// separate from reception/queue, whose own route this is not a variant of.
// Triage recording is clinical work, not front-desk work; see the plan's
// Phase 3 correction note for why an earlier version put it on
// reception/Queue.vue instead and was reverted.
Route::get('triage/queue', function () {
    return Inertia::render('triage/Queue');
})->middleware(['auth', 'verified', 'can:appointments.read', 'facility.entitlement:appointments.scheduling'])->name('triage.queue');

// Phase 4 of reports/appointments-scheduling-workspace-modernization-plan.md:
// a new, standalone, clinician-scoped page — same reasoning as
// triage/Queue.vue's own split from reception/Queue.vue. Consultation
// takeover and provider workflow (hold, send back to triage, complete) are
// clinician work, not front-desk work.
Route::get('clinician/queue', function () {
    return Inertia::render('clinician/Queue');
})->middleware(['auth', 'verified', 'can:appointments.read', 'facility.entitlement:appointments.scheduling'])->name('clinician.queue');

// Admission V2 + real bed assignment plan, Phase 5 (cutover): swap the
// live route to the rebuilt page. AdmF of the Admission V2 full-parity plan
// reached full parity with the legacy page (ADT timeline, audit logs,
// discharge readiness, payer contract picker, bed-board click-through) and
// deleted it outright — same "no legacy patches, ever" standing directive
// applied to Emergency's P0e.
Route::get('admissions', function () {
    return Inertia::render('admissions/IndexV2');
})->middleware([
    'auth',
    'verified',
    'can:admissions.read',
    // Scheduling-tier OR full admissions SKU (aligns with API admissions list + dashboard KPIs).
    'facility.entitlement.any:admissions.management,appointments.scheduling',
])->name('admissions.page');

Route::get('admissions/v2', function () {
    return Inertia::render('admissions/IndexV2');
})->middleware([
    'auth',
    'verified',
    'can:admissions.read',
    'facility.entitlement.any:admissions.management,appointments.scheduling',
])->name('admissions.page.v2');

// Encounter-centric visit list (there was no dormant equivalent to reuse —
// medical-records/Index.vue is record-centric, one row per note). Cut over
// to always-on now that it's browser-verified; there's no prior page here
// to preserve as a rollback route.
Route::get('encounters', function () {
    return Inertia::render('encounters/List');
})->middleware(['auth', 'verified', 'can:medical.records.read', 'facility.entitlement:medical_records.core'])->name('encounters.list');

// Cut over to the rebuilt workspace (reports/clinical-notes-frontend-rebuild-plan.md).
// The pre-cutover page (encounters/Show.vue + encounters/Workspace.vue) reached
// full parity and was deleted outright — no /legacy rollback route kept, per
// the standing "no legacy patches, ever" directive applied throughout this
// session (same treatment as emergency-triage/Index.vue, admissions/Index.vue,
// platform/admin/ward-beds/Index.vue).
Route::get('encounters/{encounterId}', function (string $encounterId) {
    return Inertia::render('encounters/WorkspaceV2', [
        'encounterId' => $encounterId,
    ]);
})->middleware(['auth', 'verified', 'can:medical.records.read', 'can:medical.records.create', 'facility.entitlement:medical_records.core'])->name('encounters.show');

/**
 * Resolves (or creates, via ResolveEncounterForAppointmentUseCase's
 * findOrCreateForVisit) the encounter for an appointment, then redirects to
 * the canonical encounters/{encounterId} route above — WorkspaceV2 only ever
 * accepts an already-resolved encounterId, so this route's whole job is the
 * resolve step, not rendering anything itself. Previously rendered the
 * legacy encounters/Show page directly (never cut over); that was a real
 * bug, not a deliberate scope decision — every caller of
 * encounterWorkspaceLegacyAppointmentHref() (clinician/Queue.vue,
 * appointments/Index.vue, medical-records/Index.vue + IndexV2.vue,
 * Dashboard.vue) was silently landing on the pre-cutover workspace with no
 * way to reach WorkspaceV2 via an appointment id.
 *
 * redirect('/encounters/{id}'), not redirect()->route('encounters.show', ...)
 * — routes/api.php registers its own JSON `encounters/{id}` route under the
 * same `encounters.show` name (different param name, `id` not
 * `encounterId`), and Laravel resolves route-name lookups against whichever
 * definition wins the collision, not necessarily this web route. A raw path
 * sidesteps the collision entirely; renaming either route is a separate,
 * wider-blast-radius fix not needed for this bug.
 */
Route::get('encounters/by-appointment/{appointmentId}', function (
    string $appointmentId,
    ResolveEncounterForAppointmentUseCase $useCase,
) {
    try {
        $result = $useCase->execute($appointmentId, request()->user()?->id);
    } catch (AppointmentNotEligibleForMedicalRecordException $exception) {
        abort(422, $exception->getMessage());
    }

    abort_if($result === null, 404, 'Appointment not found.');

    return redirect('/encounters/'.$result['encounter']['id']);
})->middleware(['auth', 'verified', 'can:medical.records.read', 'can:medical.records.create', 'facility.entitlement:medical_records.core'])->name('encounters.by-appointment');

Route::get('encounters/{encounterId}/v2', function (string $encounterId) {
    return Inertia::render('encounters/WorkspaceV2', [
        'encounterId' => $encounterId,
    ]);
})->middleware(['auth', 'verified', 'can:medical.records.read', 'can:medical.records.create', 'facility.entitlement:medical_records.core'])->name('encounters.workspace-v2');

// Cut over to the rebuilt registry (reports/medical-records-index-rebuild-plan.md).
// The old page remains reachable at medical-records/legacy for rollback.
Route::get('medical-records', function () {
    return Inertia::render('medical-records/IndexV2');
})->middleware(['auth', 'verified', 'can:medical.records.read', 'facility.entitlement:medical_records.core'])->name('medical-records.page');

Route::get('medical-records/v2', function () {
    return Inertia::render('medical-records/IndexV2');
})->middleware(['auth', 'verified', 'can:medical.records.read', 'facility.entitlement:medical_records.core'])->name('medical-records.page-v2');

// Rollback path — the pre-cutover page, unchanged.
Route::get('medical-records/legacy', function () {
    return Inertia::render('medical-records/Index');
})->middleware(['auth', 'verified', 'can:medical.records.read', 'facility.entitlement:medical_records.core'])->name('medical-records.page-legacy');

Route::get('medical-records/{id}/print', [MedicalRecordDocumentController::class, 'show'])
    ->middleware(['auth', 'verified', 'can:medical.records.read', 'facility.entitlement:medical_records.core'])
    ->name('medical-records.print.page');

Route::get('medical-records/{id}/pdf', [MedicalRecordDocumentController::class, 'downloadPdf'])
    ->middleware(['auth', 'verified', 'can:medical.records.read', 'facility.entitlement:medical_records.core'])
    ->name('medical-records.pdf.download');

Route::get('encounters/{id}/print', [EncounterDocumentController::class, 'show'])
    ->middleware(['auth', 'verified', 'can:medical.records.read', 'facility.entitlement:medical_records.core'])
    ->name('encounters.print.page');

Route::get('encounters/{id}/pdf', [EncounterDocumentController::class, 'downloadPdf'])
    ->middleware(['auth', 'verified', 'can:medical.records.read', 'facility.entitlement:medical_records.core'])
    ->name('encounters.pdf.download');

// Legacy page deleted — order creation, reorder/add-on, and safety-override
// parity all shipped in V2 (reports/order-creation-v2-modernization-plan.md).
// /legacy kept as an alias to V2, not removed outright: several other pages
// (encounter workflow, patient chart, theatre) still link to it with
// reorderOfId/addOnToOrderId/includeTabNew params V2 doesn't read yet —
// rewiring those is a separate, deliberately deferred pass. This alias just
// keeps those existing links from 404ing in the meantime.
Route::get('laboratory-orders', function () {
    return Inertia::render('laboratory-orders/IndexV2');
})->middleware(['auth', 'verified', 'can:laboratory.orders.read', 'facility.entitlement:laboratory.orders'])->name('laboratory-orders.page');

Route::get('laboratory-orders/v2', function () {
    return Inertia::render('laboratory-orders/IndexV2');
})->middleware(['auth', 'verified', 'can:laboratory.orders.read', 'facility.entitlement:laboratory.orders'])->name('laboratory-orders.page.v2');

Route::get('laboratory-orders/legacy', function () {
    return Inertia::render('laboratory-orders/IndexV2');
})->middleware(['auth', 'verified', 'can:laboratory.orders.read', 'facility.entitlement:laboratory.orders'])->name('laboratory-orders.page.legacy');

// Legacy page deleted — order creation, reorder/add-on, and safety-override
// parity all shipped in V2 (reports/order-creation-v2-modernization-plan.md).
// /legacy kept as an alias to V2, not removed outright — see laboratory-orders'
// route block above for why (other pages still link to it with params V2
// doesn't read yet; a separate, deliberately deferred pass).
Route::get('pharmacy-orders', function () {
    return Inertia::render('pharmacy-orders/IndexV2');
})->middleware(['auth', 'verified', 'can:pharmacy.orders.read', 'facility.entitlement:pharmacy.orders'])->name('pharmacy-orders.page');

Route::get('pharmacy-orders/v2', function () {
    return Inertia::render('pharmacy-orders/IndexV2');
})->middleware(['auth', 'verified', 'can:pharmacy.orders.read', 'facility.entitlement:pharmacy.orders'])->name('pharmacy-orders.page.v2');

Route::get('pharmacy-orders/legacy', function () {
    return Inertia::render('pharmacy-orders/IndexV2');
})->middleware(['auth', 'verified', 'can:pharmacy.orders.read', 'facility.entitlement:pharmacy.orders'])->name('pharmacy-orders.page.legacy');

Route::get('walk-in-service-requests', function () {
    return Inertia::render('walk-in-service-requests/Index');
})->middleware(['auth', 'verified', 'can:service.requests.read', 'facility.entitlement:clinical.walk_in_queue'])->name('walk-in-service-requests.page');

// Patient flow redesign B3: a new, standalone page over ServiceRequestModel
// — per-department Direct Service queue management (hard department
// enforcement server-side, see ServiceRequestDepartmentScopeResolver). Not
// a route swap: /walk-in-service-requests keeps rendering the legacy page,
// now marked (Legacy) and un-nav-linked, same "URL-only rollback path" as
// /patients/legacy, /appointments/legacy, /emergency-triage.
Route::get('direct-service/queue', function () {
    return Inertia::render('directService/Queue');
})->middleware(['auth', 'verified', 'can:service.requests.read', 'facility.entitlement:clinical.walk_in_queue'])->name('direct-service.queue');

// Billing invoice queue — rebuilt Cashier Queue (V2 pages architecture:
// TanStack Query composables, URL-synced filters, sticky search bar).
Route::get('billing', function () {
    return Inertia::render('billing/List');
})->middleware(['auth', 'verified', 'can:billing.invoices.read', 'facility.entitlement:billing.invoices'])->name('billing.page');

// Billing Patient Workspace — analogue of the Encounter module's
// List → Workspace flow. A single patient's billing activity
// (invoices, payments, charges, insurance) in one place.
Route::get('billing/{patientId}', function (string $patientId) {
    return Inertia::render('billing/workspace/Workspace', ['patientId' => $patientId]);
})->middleware(['auth', 'verified', 'can:billing.invoices.read', 'facility.entitlement:billing.invoices'])->name('billing.workspace.page');

// Cut over to the rebuilt Cash Payments page (V2 pages architecture, full
// charge/payment/convert-to-invoice/void/refund workflow). The old page
// remains reachable at billing-cash/legacy for rollback.
Route::get('billing-cash', function () {
    return Inertia::render('billing/CashV2');
})->middleware(['auth', 'verified', 'can:billing.cash-accounts.read', 'facility.entitlement:billing.cash_accounts'])->name('billing-cash.page');

// Rollback path — the pre-cutover page, unchanged.
Route::get('billing-cash/legacy', function () {
    return Inertia::render('billing/Cash');
})->middleware(['auth', 'verified', 'can:billing.cash-accounts.read', 'facility.entitlement:billing.cash_accounts'])->name('billing-cash.page.legacy');

Route::get('billing-payment-plans', function () {
    return Inertia::render('billing/PaymentPlans');
})->middleware(['auth', 'verified', 'can:billing.invoices.read', 'facility.entitlement:billing.payment_plans'])->name('billing-payment-plans.page');

Route::get('pos', function () {
    return Inertia::render('pos/Index');
})->middleware(['auth', 'verified', 'can:pos.registers.read', 'facility.entitlement:pos.registers_sessions'])->name('pos.page');

Route::get('pos/cafeteria', function () {
    return Inertia::render('pos/cafeteria/Index');
})->middleware(['auth', 'verified', 'can:pos.cafeteria.read', 'facility.entitlement:pos.cafeteria'])->name('pos.cafeteria.page');

Route::get('pos/frontdesk-quick', function () {
    return Inertia::render('pos/frontdesk-quick/Index');
})->middleware(['auth', 'verified', 'can:pos.frontdesk-quick.read', 'facility.entitlement:pos.registers_sessions'])->name('pos.frontdesk-quick.page');

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
    return Inertia::render('billing/Refunds');
})->middleware(['auth', 'verified', 'can:billing.refunds.read', 'facility.entitlement:billing.discounts_refunds'])->name('billing-refunds.page');

Route::get('billing-discounts', function () {
    return Inertia::render('billing/Discounts');
})->middleware(['auth', 'verified', 'can:billing.discounts.read', 'facility.entitlement:billing.discounts_refunds'])->name('billing-discounts.page');

Route::get('billing-adjustments', function () {
    return Inertia::render('billing/Adjustments');
})->middleware(['auth', 'verified', 'can:billing.invoices.read', 'facility.entitlement:billing.invoices'])->name('billing-adjustments.page');

Route::get('billing-write-offs', function () {
    return Inertia::render('billing/WriteOffs');
})->middleware(['auth', 'verified', 'can:billing.invoices.read', 'facility.entitlement:billing.invoices'])->name('billing-write-offs.page');

Route::get('billing-aging-report', function () {
    return Inertia::render('billing/AgingReport');
})->middleware(['auth', 'verified', 'can:billing.financial-controls.read', 'facility.entitlement:billing.financial_controls'])->name('billing-aging-report.page');

Route::get('billing-daily-close', function () {
    return Inertia::render('billing/DailyClose');
})->middleware(['auth', 'verified', 'can:billing.financial-controls.read', 'facility.entitlement:billing.financial_controls'])->name('billing-daily-close.page');

Route::get('billing-financial-reports', function () {
    return Inertia::render('billing/FinancialReports');
})->middleware(['auth', 'verified', 'can:billing.financial-controls.read', 'facility.entitlement:billing.financial_controls'])->name('billing-financial-reports.page');

Route::get('billing-corporate', function () {
    return Inertia::render('billing/Corporate');
})->middleware(['auth', 'verified', 'can:billing.payer-contracts.read', 'facility.entitlement:billing.payer_contracts'])->name('billing-corporate.page');

Route::get('billing/{id}/print', [BillingInvoiceDocumentController::class, 'show'])
    ->middleware(['auth', 'verified', 'can:billing.invoices.read', 'facility.entitlement:billing.invoices'])
    ->name('billing.print.page');

Route::get('billing/{id}/pdf', [BillingInvoiceDocumentController::class, 'downloadPdf'])
    ->middleware(['auth', 'verified', 'can:billing.invoices.read', 'facility.entitlement:billing.invoices'])
    ->name('billing.pdf.download');

Route::get('billing/{invoiceId}/payments/{paymentId}/receipt', [BillingPaymentReceiptDocumentController::class, 'show'])
    ->middleware(['auth', 'verified', 'can:billing.payments.view-history', 'facility.entitlement:billing.invoices'])
    ->name('billing.payment-receipt.page');

Route::get('billing/{invoiceId}/payments/{paymentId}/receipt/pdf', [BillingPaymentReceiptDocumentController::class, 'downloadPdf'])
    ->middleware(['auth', 'verified', 'can:billing.payments.view-history', 'facility.entitlement:billing.invoices'])
    ->name('billing.payment-receipt.pdf.download');

Route::get('claims-insurance/{id}/print', [ClaimsInsuranceDocumentController::class, 'show'])
    ->middleware(['auth', 'verified', 'can:claims.insurance.read', 'facility.entitlement:claims.insurance'])
    ->name('claims-insurance.print.page');

Route::get('claims-insurance/{id}/pdf', [ClaimsInsuranceDocumentController::class, 'downloadPdf'])
    ->middleware(['auth', 'verified', 'can:claims.insurance.read', 'facility.entitlement:claims.insurance'])
    ->name('claims-insurance.pdf.download');

Route::get('billing-payer-contracts', function () {
    return Inertia::render('billing/PayerContracts');
})->middleware(['auth', 'verified', 'can:billing.payer-contracts.read', 'facility.entitlement:billing.payer_contracts'])->name('billing-payer-contracts.page');

Route::get('billing-service-catalog', function () {
    return Inertia::render('billing/ServiceCatalogV2');
})->middleware(['auth', 'verified', 'can:billing.service-catalog.read', 'facility.entitlement:billing.service_catalog'])->name('billing-service-catalog.page');

Route::get('billing-service-catalog/{id}/prices', function (string $id) {
    return Inertia::render('billing/ServicePriceWorkspaceV2', [
        'itemId' => $id,
    ]);
})->middleware(['auth', 'verified', 'can:billing.service-catalog.read', 'facility.entitlement:billing.service_catalog'])->name('billing-service-catalog.prices.page');

Route::get('billing-consultation-mappings', function () {
    return Inertia::render('billing/ConsultationMappings');
})->middleware(['auth', 'verified', 'can:billing.consultation-mappings.read', 'facility.entitlement:billing.service_catalog'])->name('billing-consultation-mappings.page');

Route::get('staff', function () {
    return Inertia::render('staff/Index');
})->middleware(['auth', 'verified', 'can:staff.read', 'facility.entitlement:staff.profiles'])->name('staff.page');

Route::get('staff-attendance', function () {
    return Inertia::render('staff-attendance/Index');
})->middleware(['auth', 'verified', 'can:staff.attendance.read'])->name('staff-attendance.page');

Route::get('staff-credentialing', function () {
    return Inertia::render('staff-credentialing/Index');
})->middleware(['auth', 'verified', 'can:staff.credentialing.read', 'facility.entitlement:staff.credentialing'])->name('staff-credentialing.page');

Route::get('staff-privileges', function () {
    return Inertia::render('staff-privileges/Index');
})->middleware(['auth', 'verified', 'can:staff.privileges.read', 'facility.entitlement:staff.privileges'])->name('staff-privileges.page');

// Cut over to the rebuilt page (V2 architecture, matching patients/admissions) —
// legacy Index.vue reached full parity and was deleted outright, no /legacy
// rollback route kept, per the standing "no legacy patches, ever" directive.
Route::get('platform/admin/users', function () {
    return Inertia::render('platform/admin/users/IndexV2');
})->middleware(['auth', 'verified', 'can:platform.users.read'])->name('platform-admin-users.page');

Route::get('platform/admin/users/v2', function () {
    return Inertia::render('platform/admin/users/IndexV2');
})->middleware(['auth', 'verified', 'can:platform.users.read'])->name('platform-admin-users.page.v2');

Route::get('platform/admin/user-approval-cases', function () {
    return Inertia::render('platform/admin/user-approval-cases/Index');
})->middleware(['auth', 'verified', 'can:platform.users.approval-cases.read'])->name('platform-admin-user-approval-cases.page');

Route::get('platform/admin/roles', function () {
    return Inertia::render('platform/admin/roles/Index');
})->middleware(['auth', 'verified', 'can:platform.rbac.read'])->name('platform-admin-roles.page');

Route::get('platform/admin/permissions', function () {
    return Inertia::render('platform/admin/roles/Index');
})->middleware(['auth', 'verified', 'can:platform.rbac.read'])->name('platform-admin-permissions.page');

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

// Ward/bed registry V2 redesign — cutover, no /legacy alias kept, per the
// standing "no legacy patches, ever" directive already applied to
// emergency-triage and admissions this session.
Route::get('platform/admin/ward-beds', function () {
    return Inertia::render('platform/admin/ward-beds/IndexV2');
})->middleware(['auth', 'verified', 'can:platform.resources.read'])->name('platform-admin-ward-beds.page');

Route::get('platform/admin/facility-rollouts', function () {
    return Inertia::render('platform/admin/facility-rollouts/Index');
})->middleware(['auth', 'verified', 'can:platform.multi-facility.read'])->name('platform-admin-facility-rollouts.page');

Route::get('platform/admin/facility-config', function () {
    abort_unless(Gate::any([
        'platform.facilities.read',
        'platform.resources.read',
        'platform.clinical-catalog.read',
        'departments.read',
        'specialties.read',
        'billing.service-catalog.read',
        'platform.subscription-plans.read',
        'platform.multi-facility.read',
        'platform.users.read',
        'platform.settings.manage-branding',
    ]), 403);

    return Inertia::render('platform/admin/facility-config/Index');
})->middleware(['auth', 'verified'])->name('platform-admin-facility-config.page');

Route::get('platform/admin/service-plans', function () {
    return Inertia::render('platform/admin/service-plans/Index');
})->middleware(['auth', 'verified', 'can:platform.subscription-plans.read'])->name('platform-admin-service-plans.page');

Route::get('platform/admin/branding', function (SystemBrandingManager $brandingManager) {
    return Inertia::render('platform/admin/branding/Index', [
        'mailBranding' => $brandingManager->mailBranding(),
    ]);
})->middleware(['auth', 'verified', 'can:platform.settings.manage-branding'])->name('platform-admin-branding.page');

Route::get('platform/admin/clinical-catalogs/{catalog?}', function (?string $catalog = null) {
    return Inertia::render('platform/admin/clinical-catalogs/Index', [
        'catalog' => $catalog,
    ]);
})->where('catalog', 'lab-tests|radiology-procedures|theatre-procedures|formulary-items')
    ->middleware(['auth', 'verified', 'can:platform.clinical-catalog.read'])
    ->name('platform-admin-clinical-catalogs.page');

// Legacy page deleted — order creation, reorder/add-on parity shipped in V2
// (reports/order-creation-v2-modernization-plan.md). /legacy kept as an
// alias to V2, not removed outright — see laboratory-orders' route block
// above for why (other pages still link to it with params V2 doesn't read
// yet; a separate, deliberately deferred pass).
Route::get('radiology-orders', function () {
    return Inertia::render('radiology-orders/IndexV2');
})->middleware(['auth', 'verified', 'can:radiology.orders.read', 'facility.entitlement:radiology.orders'])->name('radiology-orders.page');

Route::get('radiology-orders/v2', function () {
    return Inertia::render('radiology-orders/IndexV2');
})->middleware(['auth', 'verified', 'can:radiology.orders.read', 'facility.entitlement:radiology.orders'])->name('radiology-orders.page.v2');

Route::get('radiology-orders/legacy', function () {
    return Inertia::render('radiology-orders/IndexV2');
})->middleware(['auth', 'verified', 'can:radiology.orders.read', 'facility.entitlement:radiology.orders'])->name('radiology-orders.page.legacy');

// P0 of the Reception/Emergency/Admission/Bed-Management audit
// follow-through: emergency/Queue.vue reached full parity with the legacy
// page (queue, status transitions incl. admit-with-bed, case creation,
// transfers, audit logs) — this is now a real route swap, not an alias
// pair with a /legacy fallback, per the standing "legacy pages get deleted,
// not kept around" directive. The old emergency-triage/Index.vue file is
// removed in the same initiative (see P0e).
Route::get('emergency-triage', function () {
    return Inertia::render('emergency/Queue');
})->middleware(['auth', 'verified', 'can:emergency.triage.read', 'facility.entitlement:emergency.triage'])->name('emergency-triage.page');

Route::get('emergency/queue', function () {
    return Inertia::render('emergency/Queue');
})->middleware(['auth', 'verified', 'can:emergency.triage.read', 'facility.entitlement:emergency.triage'])->name('emergency.queue');

Route::get('inpatient-ward', function () {
    return Inertia::render('inpatient-ward/Index');
})->middleware(['auth', 'verified', 'can:inpatient.ward.read', 'facility.entitlement:inpatient.ward'])->name('inpatient-ward.page');

Route::get('inpatient-ward/discharge-checklists/{id}/print', [InpatientWardDischargeChecklistDocumentController::class, 'show'])
    ->middleware(['auth', 'verified', 'can:inpatient.ward.read', 'facility.entitlement:inpatient.care_plans'])
    ->name('inpatient-ward-discharge-checklists.print.page');

Route::get('inpatient-ward/discharge-checklists/{id}/pdf', [InpatientWardDischargeChecklistDocumentController::class, 'downloadPdf'])
    ->middleware(['auth', 'verified', 'can:inpatient.ward.read', 'facility.entitlement:inpatient.care_plans'])
    ->name('inpatient-ward-discharge-checklists.pdf.download');

// Cut over to the rebuilt worklist (pre-op/start/complete/lifecycle
// actions on existing procedures). Scheduling — creation, OR room/resource
// booking — isn't in the V2 build (a whole separate resource-allocation
// sub-system with no lab/pharmacy/radiology analogue), so the old page
// remains reachable at theatre-procedures/legacy, same precedent
// laboratory-orders/legacy and radiology-orders/legacy established.
Route::get('theatre-procedures', function () {
    return Inertia::render('theatre-procedures/IndexV2');
})->middleware(['auth', 'verified', 'can:theatre.procedures.read', 'facility.entitlement:theatre.procedures'])->name('theatre-procedures.page');

Route::get('theatre-procedures/v2', function () {
    return Inertia::render('theatre-procedures/IndexV2');
})->middleware(['auth', 'verified', 'can:theatre.procedures.read', 'facility.entitlement:theatre.procedures'])->name('theatre-procedures.page.v2');

// Rollback path — the pre-cutover page, unchanged. Also the only place
// scheduling (creation + resource allocation) currently lives.
Route::get('theatre-procedures/legacy', function () {
    return Inertia::render('theatre-procedures/Index');
})->middleware(['auth', 'verified', 'can:theatre.procedures.read', 'facility.entitlement:theatre.procedures'])->name('theatre-procedures.page.legacy');

Route::get('claims-insurance', function () {
    return Inertia::render('claims-insurance/Index');
})->middleware(['auth', 'verified', 'can:claims.insurance.read', 'facility.entitlement:claims.insurance'])->name('claims-insurance.page');

Route::get('inventory-procurement', function (Request $request) {
    return Inertia::render('inventory-procurement/Home');
})->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.procurement'])->name('inventory-procurement.page');

Route::get('inventory-procurement/workspace', function () {
    return redirect('inventory-procurement/stock-control');
})->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.procurement'])->name('inventory-procurement-workspace.page');

Route::get('inventory-procurement/stock-control', function () {
    return Inertia::render('inventory-procurement/stock-control/Index');
})->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.procurement'])->name('inventory-procurement-stock-control.page');

Route::get('inventory-procurement/items/{id}', function (string $id) {
    return Inertia::render('inventory-procurement/items/Show', ['itemId' => $id]);
})->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.procurement'])->name('inventory-procurement-items.show.page');

Route::get('inventory-procurement/procurement', function () {
    return Inertia::render('inventory-procurement/procurement/Index');
})->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.procurement'])->name('inventory-procurement-procurement.page');

Route::get('inventory-procurement/requests-fulfilment', function () {
    return Inertia::render('inventory-procurement/requests-fulfilment/Index');
})->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.procurement'])->name('inventory-procurement-requests-fulfilment.page');

Route::get('inventory-procurement/review', function () {
    return Inertia::render('inventory-procurement/review/Index');
})->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.procurement'])->name('inventory-procurement-review.page');

Route::get('inventory-procurement/pending-approvals', function () {
    return Inertia::render('inventory-procurement/PendingApprovals');
})->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.procurement'])->name('inventory-procurement-pending-approvals.page');

Route::get('inventory-procurement/receive', function () {
    return Inertia::render('inventory-procurement/Receive');
})->middleware(['auth', 'verified', 'can:inventory.procurement.create-movement', 'facility.entitlement:inventory.stock_movements'])->name('inventory-procurement-receive.page');

Route::get('inventory-procurement/issue', function () {
    return Inertia::render('inventory-procurement/Issue');
})->middleware(['auth', 'verified', 'can:inventory.procurement.create-movement', 'facility.entitlement:inventory.stock_issue'])->name('inventory-procurement-issue.page');

Route::get('inventory-procurement/count', function () {
    return Inertia::render('inventory-procurement/Count');
})->middleware(['auth', 'verified', 'can:inventory.procurement.reconcile-stock', 'facility.entitlement:inventory.stock_movements'])->name('inventory-procurement-count.page');

Route::get('inventory-procurement/suppliers', function () {
    return Inertia::render('inventory-procurement/suppliers/Index');
})->middleware(['auth', 'verified', 'can:inventory.procurement.manage-suppliers', 'facility.entitlement:inventory.suppliers'])->name('inventory-procurement-suppliers.page');

Route::get('inventory-procurement/warehouses', function () {
    return Inertia::render('inventory-procurement/warehouses/Index');
})->middleware(['auth', 'verified', 'can:inventory.procurement.manage-warehouses', 'facility.entitlement:inventory.warehouses'])->name('inventory-procurement-warehouses.page');

Route::get('inventory-procurement/procurement-requests/{id}/grn', [InventoryProcurementDocumentController::class, 'showGoodsReceivedNote'])
    ->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.procurement'])
    ->name('inventory-procurement-procurement-requests.grn.page');

Route::get('inventory-procurement/procurement-requests/{id}/grn.pdf', [InventoryProcurementDocumentController::class, 'downloadGoodsReceivedNotePdf'])
    ->middleware(['auth', 'verified', 'can:inventory.procurement.read', 'facility.entitlement:inventory.procurement'])
    ->name('inventory-procurement-procurement-requests.grn.pdf.download');

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

Route::get('notifications', function () {
    return Inertia::render('notifications/Index');
})->middleware(['auth', 'verified'])->name('notifications.index');

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

});

require __DIR__.'/settings.php';
