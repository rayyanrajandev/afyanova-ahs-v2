<?php

use App\Models\User;
use App\Modules\Admission\Infrastructure\Models\AdmissionModel;
use App\Modules\Appointment\Infrastructure\Models\AppointmentModel;
use App\Modules\Appointment\Infrastructure\Models\AppointmentReferralModel;
use App\Modules\Laboratory\Infrastructure\Models\LaboratoryOrderModel;
use App\Modules\MedicalRecord\Infrastructure\Models\MedicalRecordAuditLogModel;
use App\Modules\MedicalRecord\Infrastructure\Models\MedicalRecordModel;
use App\Modules\MedicalRecord\Infrastructure\Models\MedicalRecordSignerAttestationModel;
use App\Modules\MedicalRecord\Infrastructure\Models\MedicalRecordVersionModel;
use App\Modules\Patient\Infrastructure\Models\PatientModel;
use App\Modules\Pharmacy\Infrastructure\Models\PharmacyOrderModel;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Radiology\Infrastructure\Models\RadiologyOrderModel;
use App\Modules\TheatreProcedure\Infrastructure\Models\TheatreProcedureModel;
use App\Support\Settings\SystemSettingsManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

function makeMedicalRecordPrintActor(array $permissions = []): User
{
    $user = User::factory()->create([
        'email_verified_at' => now(),
    ]);

    foreach ($permissions as $permission) {
        $user->givePermissionTo($permission);
    }

    return $user;
}

function makeMedicalRecordPrintPatient(): PatientModel
{
    return PatientModel::query()->create([
        'patient_number' => 'PT-MR-PRINT-0001',
        'first_name' => 'Zawadi',
        'middle_name' => null,
        'last_name' => 'Komba',
        'gender' => 'female',
        'date_of_birth' => '1991-11-03',
        'phone' => '+255700111222',
        'email' => 'zawadi@example.test',
        'country_code' => 'TZ',
        'region' => 'Dar es Salaam',
        'district' => 'Temeke',
        'address_line' => 'Mbagala',
        'status' => 'active',
    ]);
}

function makeMedicalRecordPrintAppointment(string $patientId): AppointmentModel
{
    return AppointmentModel::query()->create([
        'appointment_number' => 'APT-MR-PRINT-0001',
        'patient_id' => $patientId,
        'clinician_user_id' => null,
        'department' => 'Internal Medicine',
        'scheduled_at' => '2026-04-09 08:45:00',
        'duration_minutes' => 35,
        'reason' => 'Post-admission review',
        'notes' => null,
        'status' => 'completed',
        'status_reason' => null,
    ]);
}

function makeMedicalRecordPrintAdmission(string $patientId, ?string $appointmentId = null): AdmissionModel
{
    return AdmissionModel::query()->create([
        'admission_number' => 'ADM-MR-PRINT-0001',
        'patient_id' => $patientId,
        'appointment_id' => $appointmentId,
        'attending_clinician_user_id' => null,
        'ward' => 'Ward C',
        'bed' => 'C-07',
        'admitted_at' => '2026-04-08 14:00:00',
        'discharged_at' => null,
        'admission_reason' => 'Observation and follow-up',
        'notes' => null,
        'status' => 'admitted',
        'status_reason' => null,
    ]);
}

function makeMedicalRecordPrintReferral(string $appointmentId): AppointmentReferralModel
{
    return AppointmentReferralModel::query()->create([
        'appointment_id' => $appointmentId,
        'referral_number' => 'REF-MR-PRINT-0001',
        'referral_type' => 'internal',
        'priority' => 'urgent',
        'target_department' => 'Respiratory',
        'target_facility_name' => null,
        'target_clinician_user_id' => null,
        'referral_reason' => 'Requires higher-level pulmonary review',
        'clinical_notes' => 'Persistent symptoms despite initial treatment.',
        'handoff_notes' => 'Receiving team informed.',
        'requested_at' => '2026-04-09 08:10:00',
        'accepted_at' => '2026-04-09 08:35:00',
        'handed_off_at' => null,
        'completed_at' => null,
        'status' => 'accepted',
        'status_reason' => null,
        'metadata' => null,
    ]);
}

function makeMedicalRecordPrintRecord(
    PatientModel $patient,
    User $author,
    ?User $signer = null,
    ?AppointmentModel $appointment = null,
    ?AppointmentReferralModel $appointmentReferral = null,
    ?AdmissionModel $admission = null,
    ?TheatreProcedureModel $theatreProcedure = null,
): MedicalRecordModel {
    return MedicalRecordModel::query()->create([
        'record_number' => 'MR-PRINT-0001',
        'patient_id' => $patient->id,
        'appointment_id' => $appointment?->id,
        'appointment_referral_id' => $appointmentReferral?->id,
        'theatre_procedure_id' => $theatreProcedure?->id,
        'admission_id' => $admission?->id,
        'author_user_id' => $author->id,
        'encounter_at' => '2026-04-09 09:05:00',
        'record_type' => $theatreProcedure ? 'procedure_note' : 'progress_note',
        'subjective' => '<p>Patient reports improved breathing with reduced overnight discomfort.</p>',
        'objective' => '<p>Vitals stable. Chest exam improved compared with prior round.</p>',
        'assessment' => '<p>Recovery trajectory is positive with residual monitoring needs.</p>',
        'plan' => '<p>Continue observation, medication adherence, and repeat review tomorrow.</p>',
        'diagnosis_code' => 'J18',
        'status' => 'finalized',
        'status_reason' => 'Ready for attending signoff.',
        'signed_by_user_id' => $signer?->id,
        'signed_at' => $signer ? '2026-04-09 10:10:00' : null,
    ]);
}

function seedMedicalRecordPrintDiagnosis(): void
{
    ClinicalCatalogItemModel::query()->create([
        'tenant_id' => null,
        'facility_id' => null,
        'catalog_type' => 'diagnosis_code',
        'code' => 'J18',
        'name' => 'Pneumonia, unspecified organism',
        'department_id' => null,
        'category' => 'respiratory',
        'unit' => null,
        'description' => 'Lower respiratory infection requiring clinical review.',
        'metadata' => null,
        'status' => 'active',
        'status_reason' => null,
    ]);
}

function seedMedicalRecordPrintEncounterResources(
    PatientModel $patient,
    AppointmentModel $appointment,
    AdmissionModel $admission,
    User $operatingClinician,
    User $anesthetist,
): TheatreProcedureModel {
    LaboratoryOrderModel::query()->create([
        'order_number' => 'LAB-MR-0001',
        'patient_id' => $patient->id,
        'appointment_id' => $appointment->id,
        'admission_id' => $admission->id,
        'ordered_by_user_id' => null,
        'ordered_at' => '2026-04-09 09:20:00',
        'test_code' => 'CBC',
        'test_name' => 'Complete Blood Count',
        'priority' => 'routine',
        'specimen_type' => 'blood',
        'clinical_notes' => null,
        'result_summary' => 'WBC trend improving.',
        'resulted_at' => '2026-04-09 11:00:00',
        'status' => 'completed',
        'entry_state' => 'active',
        'status_reason' => null,
        'lifecycle_reason_code' => null,
    ]);

    PharmacyOrderModel::query()->create([
        'order_number' => 'RX-MR-0001',
        'patient_id' => $patient->id,
        'appointment_id' => $appointment->id,
        'admission_id' => $admission->id,
        'ordered_by_user_id' => null,
        'ordered_at' => '2026-04-09 09:25:00',
        'medication_code' => 'AMOX500',
        'medication_name' => 'Amoxicillin',
        'dosage_instruction' => '500 mg orally every 8 hours',
        'clinical_indication' => 'Respiratory infection',
        'quantity_prescribed' => 21,
        'quantity_dispensed' => 21,
        'dispensing_notes' => 'Full course dispensed.',
        'dispensed_at' => '2026-04-09 10:15:00',
        'status' => 'dispensed',
        'entry_state' => 'active',
        'status_reason' => null,
        'lifecycle_reason_code' => null,
    ]);

    RadiologyOrderModel::query()->create([
        'order_number' => 'RAD-MR-0001',
        'patient_id' => $patient->id,
        'appointment_id' => $appointment->id,
        'admission_id' => $admission->id,
        'ordered_by_user_id' => null,
        'ordered_at' => '2026-04-09 09:30:00',
        'procedure_code' => 'CXR',
        'modality' => 'xray',
        'study_description' => 'Chest X-Ray',
        'clinical_indication' => 'Pneumonia follow-up',
        'scheduled_for' => '2026-04-09 09:45:00',
        'report_summary' => 'Interval improvement in lower lobe opacity.',
        'completed_at' => '2026-04-09 10:05:00',
        'status' => 'completed',
        'entry_state' => 'active',
        'status_reason' => null,
        'lifecycle_reason_code' => null,
    ]);

    return TheatreProcedureModel::query()->create([
        'procedure_number' => 'THR-MR-0001',
        'patient_id' => $patient->id,
        'appointment_id' => $appointment->id,
        'admission_id' => $admission->id,
        'theatre_procedure_catalog_item_id' => null,
        'procedure_type' => 'bronchoscopy',
        'procedure_name' => 'Diagnostic Bronchoscopy',
        'operating_clinician_user_id' => $operatingClinician->id,
        'anesthetist_user_id' => $anesthetist->id,
        'theatre_room_service_point_id' => null,
        'theatre_room_name' => 'Procedure Room 2',
        'scheduled_at' => '2026-04-10 08:00:00',
        'started_at' => null,
        'completed_at' => null,
        'status' => 'planned',
        'entry_state' => 'active',
        'status_reason' => null,
        'lifecycle_reason_code' => null,
        'notes' => 'Reserved pending consultant confirmation.',
    ]);
}

function seedMedicalRecordPrintControlTrail(MedicalRecordModel $record, User $attester, User $versionAuthor): void
{
    MedicalRecordSignerAttestationModel::query()->create([
        'medical_record_id' => $record->id,
        'attested_by_user_id' => $attester->id,
        'attestation_note' => 'Reviewed and confirmed clinical narrative.',
        'attested_at' => '2026-04-09 10:30:00',
    ]);

    MedicalRecordSignerAttestationModel::query()->create([
        'medical_record_id' => $record->id,
        'attested_by_user_id' => $versionAuthor->id,
        'attestation_note' => 'Follow-up review acknowledged after consultant feedback.',
        'attested_at' => '2026-04-09 11:00:00',
    ]);

    MedicalRecordVersionModel::query()->create([
        'medical_record_id' => $record->id,
        'version_number' => 1,
        'snapshot' => ['assessment' => 'Initial note'],
        'changed_fields' => ['subjective', 'objective'],
        'created_by_user_id' => $attester->id,
        'created_at' => '2026-04-09 09:10:00',
    ]);

    MedicalRecordVersionModel::query()->create([
        'medical_record_id' => $record->id,
        'version_number' => 2,
        'snapshot' => ['assessment' => 'Updated note'],
        'changed_fields' => ['assessment', 'plan', 'status'],
        'created_by_user_id' => $versionAuthor->id,
        'created_at' => '2026-04-09 10:20:00',
    ]);
}

it('forbids the medical record print page without medical record read permission', function (): void {
    $actor = makeMedicalRecordPrintActor();
    $author = makeMedicalRecordPrintActor();
    $patient = makeMedicalRecordPrintPatient();
    $record = makeMedicalRecordPrintRecord($patient, $author);

    $this->actingAs($actor)
        ->get('/medical-records/'.$record->id.'/print')
        ->assertForbidden();
});

it('renders a branded medical record print page with linked clinical context', function (): void {
    $actor = makeMedicalRecordPrintActor([
        'medical.records.read',
        'laboratory.orders.read',
        'pharmacy.orders.read',
        'radiology.orders.read',
        'theatre.procedures.read',
    ]);
    $author = makeMedicalRecordPrintActor();
    $signer = makeMedicalRecordPrintActor();
    $attester = makeMedicalRecordPrintActor();
    $versionAuthor = makeMedicalRecordPrintActor();
    $operatingClinician = makeMedicalRecordPrintActor();
    $anesthetist = makeMedicalRecordPrintActor();
    $patient = makeMedicalRecordPrintPatient();
    $appointment = makeMedicalRecordPrintAppointment($patient->id);
    $referral = makeMedicalRecordPrintReferral($appointment->id);
    $admission = makeMedicalRecordPrintAdmission($patient->id, $appointment->id);
    $admission->forceFill([
        'status' => 'discharged',
        'discharged_at' => '2026-04-09 07:40:00',
        'discharge_destination' => 'Medical clinic review',
        'follow_up_plan' => 'Return in 7 days for medication review and repeat assessment.',
    ])->save();
    $appointment->forceFill([
        'source_admission_id' => $admission->id,
    ])->save();
    $theatreProcedure = seedMedicalRecordPrintEncounterResources($patient, $appointment, $admission, $operatingClinician, $anesthetist);
    $record = makeMedicalRecordPrintRecord($patient, $author, $signer, $appointment, $referral, $admission, $theatreProcedure);

    seedMedicalRecordPrintDiagnosis();
    seedMedicalRecordPrintControlTrail($record, $attester, $versionAuthor);

    app(SystemSettingsManager::class)->putMany([
        'branding.system_name' => [
            'group' => 'branding',
            'type' => 'string',
            'value' => 'Afyanova Clinical',
        ],
        'branding.mail_from_name' => [
            'group' => 'branding',
            'type' => 'string',
            'value' => 'Afyanova Care Team',
        ],
        'branding.mail_reply_to_address' => [
            'group' => 'branding',
            'type' => 'string',
            'value' => 'care@afyanova.so',
        ],
        'branding.mail_footer_text' => [
            'group' => 'branding',
            'type' => 'string',
            'value' => 'Clinical printouts should be handled according to facility privacy policy.',
        ],
    ]);

    $this->actingAs($actor)
        ->get('/medical-records/'.$record->id.'/print')
        ->assertInertia(fn (Assert $page) => $page
            ->component('medical-records/Print')
            ->where('record.id', (string) $record->id)
            ->where('record.recordNumber', 'MR-PRINT-0001')
            ->where('patient.patientNumber', 'PT-MR-PRINT-0001')
            ->where('patient.fullName', 'Zawadi Komba')
            ->where('appointment.appointmentNumber', 'APT-MR-PRINT-0001')
            ->where('appointment.sourceAdmissionId', (string) $admission->id)
            ->where('appointment.sourceAdmission.admissionNumber', 'ADM-MR-PRINT-0001')
            ->where('appointment.sourceAdmission.dischargeDestination', 'Medical clinic review')
            ->where('appointment.sourceAdmission.followUpPlan', 'Return in 7 days for medication review and repeat assessment.')
            ->where('appointmentReferral.referralNumber', 'REF-MR-PRINT-0001')
            ->where('appointmentReferral.referralType', 'internal')
            ->where('appointmentReferral.priority', 'urgent')
            ->where('appointmentReferral.status', 'accepted')
            ->where('appointmentReferral.targetDepartment', 'Respiratory')
            ->where('appointmentReferral.referralReason', 'Requires higher-level pulmonary review')
            ->where('appointmentReferral.clinicalNotes', 'Persistent symptoms despite initial treatment.')
            ->where('appointmentReferral.handoffNotes', 'Receiving team informed.')
            ->where('appointmentReferral.acceptedAt', fn (?string $value): bool => $value !== null && $value !== '')
            ->where('theatreProcedure.procedureNumber', 'THR-MR-0001')
            ->where('admission.admissionNumber', 'ADM-MR-PRINT-0001')
            ->where('author.name', $author->name)
            ->where('signer.name', $signer->name)
            ->where('diagnosis.code', 'J18')
            ->where('diagnosis.name', 'Pneumonia, unspecified organism')
            ->where('versionSummary.count', 2)
            ->where('versionSummary.latestVersionNumber', 2)
            ->where('versionSummary.latestVersionCreatedBy.name', $versionAuthor->name)
            ->where('attestations.0.attestedBy.name', $versionAuthor->name)
            ->where('encounterResources.laboratory.0.orderNumber', 'LAB-MR-0001')
            ->where('encounterResources.pharmacy.0.orderNumber', 'RX-MR-0001')
            ->where('encounterResources.radiology.0.orderNumber', 'RAD-MR-0001')
            ->where('encounterResources.theatre.0.procedureNumber', 'THR-MR-0001')
            ->where('canViewEncounterOrders.laboratory', true)
            ->where('canViewEncounterOrders.pharmacy', true)
            ->where('canViewEncounterOrders.radiology', true)
            ->where('canViewEncounterOrders.theatre', true)
            ->where('documentBranding.systemName', 'Afyanova Clinical')
            ->where('documentBranding.issuedByName', 'Afyanova Care Team')
            ->where('documentBranding.supportEmail', 'care@afyanova.so')
            ->where('documentBranding.footerText', 'Clinical printouts should be handled according to facility privacy policy.')
            ->where('generatedAt', fn (string $value): bool => $value !== ''));
});

it('hides encounter-linked order data on the print page when the actor lacks module read permissions', function (): void {
    $actor = makeMedicalRecordPrintActor([
        'medical.records.read',
    ]);
    $author = makeMedicalRecordPrintActor();
    $patient = makeMedicalRecordPrintPatient();
    $record = makeMedicalRecordPrintRecord($patient, $author);

    $this->actingAs($actor)
        ->get('/medical-records/'.$record->id.'/print')
        ->assertInertia(fn (Assert $page) => $page
            ->component('medical-records/Print')
            ->where('appointment', null)
            ->where('admission', null)
            ->where('signer', null)
            ->where('encounterResources.laboratory', [])
            ->where('encounterResources.pharmacy', [])
            ->where('encounterResources.radiology', [])
            ->where('encounterResources.theatre', [])
            ->where('canViewEncounterOrders.laboratory', false)
            ->where('canViewEncounterOrders.pharmacy', false)
            ->where('canViewEncounterOrders.radiology', false)
            ->where('canViewEncounterOrders.theatre', false));
});

it('downloads the medical record as a branded pdf when authorized', function (): void {
    $actor = makeMedicalRecordPrintActor(['medical.records.read']);
    $author = makeMedicalRecordPrintActor();
    $patient = makeMedicalRecordPrintPatient();
    $record = makeMedicalRecordPrintRecord($patient, $author);

    $response = $this->actingAs($actor)
        ->withHeader('User-Agent', 'Afyanova-Test-Agent/1.0')
        ->withServerVariables(['REMOTE_ADDR' => '203.0.113.12'])
        ->get('/medical-records/'.$record->id.'/pdf');

    $response
        ->assertOk()
        ->assertHeader('Content-Type', 'application/pdf')
        ->assertHeader('X-Document-Format', 'pdf')
        ->assertHeader('X-Document-Schema-Version', 'document-pdf.v1')
        ->assertHeader('X-Document-Source', 'medical-record');

    expect((string) $response->headers->get('Content-Disposition'))
        ->toContain('.pdf');
    expect(substr((string) $response->getContent(), 0, 4))
        ->toBe('%PDF');

    $auditLog = MedicalRecordAuditLogModel::query()
        ->where('medical_record_id', $record->id)
        ->latest('created_at')
        ->first();

    expect($auditLog)->not->toBeNull();
    expect($auditLog?->action)->toBe('medical-record.document.pdf.downloaded');
    expect($auditLog?->actor_id)->toBe($actor->id);
    expect($auditLog?->metadata['document_format'] ?? null)->toBe('pdf');
    expect($auditLog?->metadata['document_delivery'] ?? null)->toBe('download');
    expect($auditLog?->metadata['document_schema_version'] ?? null)->toBe('document-pdf.v1');
    expect($auditLog?->metadata['document_source'] ?? null)->toBe('medical-record');
    expect($auditLog?->metadata['document_source_id'] ?? null)->toBe($record->id);
    expect($auditLog?->metadata['document_number'] ?? null)->toBe('MR-PRINT-0001');
    expect($auditLog?->metadata['route_name'] ?? null)->toBe('medical-records.pdf.download');
    expect($auditLog?->metadata['request_path'] ?? null)->toBe('/medical-records/'.$record->id.'/pdf');
    expect($auditLog?->metadata['request_ip'] ?? null)->toBe('203.0.113.12');
    expect($auditLog?->metadata['user_agent'] ?? null)->toBe('Afyanova-Test-Agent/1.0');
    expect($auditLog?->metadata['document_filename'] ?? '')->toContain('.pdf');
    expect($auditLog?->metadata['generated_at'] ?? null)->not->toBeNull();
});
