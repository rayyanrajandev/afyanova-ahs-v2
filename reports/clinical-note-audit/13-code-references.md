# 13. Code References — Consolidated Index

This index lists every file this audit relied on, grouped by layer. Line-level citations for specific claims are inline in documents 01–12; this index is for navigation.

## 13.1 Database migrations

- `database/migrations/2026_02_25_000008_create_medical_records_table.php`
- `database/migrations/2026_02_25_000009_create_medical_record_audit_logs_table.php`
- `database/migrations/2026_02_25_000028_*` (tenant/facility columns on medical_records)
- `database/migrations/2026_03_16_000117_*` (signed_by_user_id/signed_at on medical_records)
- `database/migrations/2026_03_16_000118_create_medical_record_versions_table.php`
- `database/migrations/2026_03_16_000119_create_medical_record_signer_attestations_table.php`
- `database/migrations/2026_04_18_000601_*` (appointment_referral_id on medical_records)
- `database/migrations/2026_04_18_000602_*` (theatre_procedure_id on medical_records)
- `database/migrations/2026_05_21_000001_create_encounters_table.php`
- `database/migrations/2026_05_21_000002_add_encounter_id_to_clinical_artifacts.php`
- `database/migrations/2026_05_21_000003_create_encounter_audit_logs_table.php`
- `database/migrations/2026_05_21_000004_create_encounter_clinical_documents_table.php`

## 13.2 MedicalRecord module

**Domain**
- `app/Modules/MedicalRecord/Domain/ValueObjects/MedicalRecordStatus.php`
- `app/Modules/MedicalRecord/Domain/ValueObjects/MedicalRecordNoteType.php`
- `app/Modules/MedicalRecord/Domain/Repositories/MedicalRecordRepositoryInterface.php`
- `app/Modules/MedicalRecord/Domain/Repositories/MedicalRecordVersionRepositoryInterface.php`
- `app/Modules/MedicalRecord/Domain/Repositories/MedicalRecordAuditLogRepositoryInterface.php`
- `app/Modules/MedicalRecord/Domain/Repositories/MedicalRecordSignerAttestationRepositoryInterface.php`
- `app/Modules/MedicalRecord/Domain/Services/{Patient,Appointment,AppointmentReferral,Admission,TheatreProcedure,DiagnosisTerminology}LookupServiceInterface.php`

**Application**
- `app/Modules/MedicalRecord/Application/UseCases/CreateMedicalRecordUseCase.php`
- `app/Modules/MedicalRecord/Application/UseCases/UpdateMedicalRecordUseCase.php`
- `app/Modules/MedicalRecord/Application/UseCases/UpdateMedicalRecordStatusUseCase.php`
- `app/Modules/MedicalRecord/Application/UseCases/GetMedicalRecordUseCase.php`
- `app/Modules/MedicalRecord/Application/UseCases/GetMedicalRecordVersionDiffUseCase.php`
- `app/Modules/MedicalRecord/Application/UseCases/ListMedicalRecordAuditLogsUseCase.php`
- `app/Modules/MedicalRecord/Application/UseCases/ListMedicalRecordSignerAttestationsUseCase.php`
- `app/Modules/MedicalRecord/Application/UseCases/ListMedicalRecordStatusCountsUseCase.php`
- `app/Modules/MedicalRecord/Application/UseCases/ListMedicalRecordsUseCase.php`
- `app/Modules/MedicalRecord/Application/UseCases/ListMedicalRecordVersionsUseCase.php`
- `app/Modules/MedicalRecord/Application/UseCases/CreateMedicalRecordSignerAttestationUseCase.php`
- `app/Modules/MedicalRecord/Application/Exceptions/*.php` (13 exception classes — see [09](09-database-structure.md)/[05](05-saving-mechanism.md) for the inventory)

**Infrastructure**
- `app/Modules/MedicalRecord/Infrastructure/Models/{MedicalRecordModel,MedicalRecordVersionModel,MedicalRecordAuditLogModel,MedicalRecordSignerAttestationModel}.php`
- `app/Modules/MedicalRecord/Infrastructure/Repositories/Eloquent{MedicalRecord,MedicalRecordVersion,MedicalRecordAuditLog,MedicalRecordSignerAttestation}Repository.php`
- `app/Modules/MedicalRecord/Infrastructure/Services/{Admission,Appointment,AppointmentReferral,DiagnosisTerminology,Patient,TheatreProcedure}LookupService.php`

**Presentation**
- `app/Modules/MedicalRecord/Presentation/Http/Controllers/MedicalRecordController.php`
- `app/Modules/MedicalRecord/Presentation/Http/Controllers/MedicalRecordDocumentController.php`
- `app/Modules/MedicalRecord/Presentation/Http/Requests/*.php` (6 FormRequests)
- `app/Modules/MedicalRecord/Presentation/Http/Transformers/*.php` (5 transformers)

## 13.3 Encounter module

**Domain**
- `app/Modules/Encounter/Domain/ValueObjects/EncounterStatus.php`
- `app/Modules/Encounter/Domain/ValueObjects/EncounterClinicalDocumentStatus.php`
- `app/Modules/Encounter/Domain/Repositories/EncounterClinicalDocumentRepositoryInterface.php`
- `app/Modules/Encounter/Domain/Repositories/EncounterAuditLogRepositoryInterface.php`

**Application**
- `app/Modules/Encounter/Application/Services/EncounterLifecycleService.php`
- `app/Modules/Encounter/Application/Services/EncounterResolverService.php`
- `app/Modules/Encounter/Application/UseCases/CreateEncounterClinicalDocumentUseCase.php`
- `app/Modules/Encounter/Application/UseCases/GetEncounterClinicalDocumentUseCase.php`
- `app/Modules/Encounter/Application/UseCases/GetEncounterCloseReadinessUseCase.php`
- `app/Modules/Encounter/Application/UseCases/GetEncounterUseCase.php`
- `app/Modules/Encounter/Application/UseCases/GetEncounterWorkspaceUseCase.php`
- `app/Modules/Encounter/Application/UseCases/ListEncounterAuditLogsUseCase.php`
- `app/Modules/Encounter/Application/UseCases/ListEncounterClinicalDocumentsUseCase.php`
- `app/Modules/Encounter/Application/UseCases/ResolveEncounterForAppointmentUseCase.php`
- `app/Modules/Encounter/Application/UseCases/UpdateEncounterClinicalDocumentStatusUseCase.php`
- `app/Modules/Encounter/Application/UseCases/UpdateEncounterClinicalDocumentUseCase.php`
- `app/Modules/Encounter/Application/UseCases/UpdateEncounterStatusUseCase.php`
- `app/Modules/Encounter/Application/Exceptions/EncounterCloseBlockedException.php`
- `app/Modules/Encounter/Application/Exceptions/InvalidEncounterStatusTransitionException.php`

**Infrastructure**
- `app/Modules/Encounter/Infrastructure/Models/{EncounterModel,EncounterClinicalDocumentModel,EncounterAuditLogModel}.php`
- `app/Modules/Encounter/Infrastructure/Repositories/Eloquent{EncounterClinicalDocument,EncounterAuditLog}Repository.php`

**Presentation**
- `app/Modules/Encounter/Presentation/Http/Controllers/{EncounterController,EncounterDocumentController,EncounterClinicalAttachmentController}.php`
- `app/Modules/Encounter/Presentation/Http/Requests/*.php` (4 FormRequests)
- `app/Modules/Encounter/Presentation/Http/Transformers/*.php` (5 transformers)

## 13.4 Routes

- `routes/api.php` (lines ~61, 742–807 for this feature's `v1` routes)
- `routes/web.php` (lines ~42, 74–103 for this feature's Inertia routes)

## 13.5 Frontend

- `resources/js/pages/encounters/Workspace.vue` (10,151 lines — primary composer/editor)
- `resources/js/pages/encounters/Show.vue`
- `resources/js/pages/medical-records/Index.vue` (6,126 lines)
- `resources/js/pages/medical-records/Print.vue` (1,018 lines)
- `resources/js/pages/medical-records/noteTypes.ts` (435 lines)
- `resources/js/components/domain/clinical/EncounterNoteComposerShell.vue`
- `resources/js/components/domain/clinical/EncounterWorkspaceHeader.vue`
- `resources/js/components/domain/clinical/EncounterWorkspaceNavBar.vue`
- `resources/js/components/domain/clinical/EncounterWorkspaceMobileTabs.vue`
- `resources/js/components/domain/clinical/EncounterWorkspacePaneHeader.vue`
- `resources/js/components/domain/clinical/EncounterWorkspacePaneToolbar.vue`
- `resources/js/components/domain/clinical/EncounterWorkspaceStatusPopover.vue`
- `resources/js/components/domain/clinical/EncounterLifecycleDialog.vue`
- `resources/js/components/domain/clinical/EncounterCloseChecklistDialog.vue` (152 lines)
- `resources/js/components/domain/clinical/EncounterReturnBanner.vue`
- `resources/js/components/domain/clinical/EncounterBillingPanel.vue`
- `resources/js/components/domain/clinical/EncounterMedicationSafetyPanel.vue`
- `resources/js/components/domain/clinical/EncounterOrdersCommandCenter.vue`
- `resources/js/components/domain/clinical/EncounterOrderProgress.vue`
- `resources/js/components/domain/clinical/encounter-orders/EncounterInlineOrderPanel.vue`
- `resources/js/components/domain/clinical/EncounterTriageVitalsPanel.vue`
- `resources/js/components/domain/clinical/EncounterDocumentsPanel.vue`
- `resources/js/components/domain/clinical/EncounterGovernancePanel.vue`
- `resources/js/components/domain/clinical/EncounterWorkflowCareStreams.vue`
- `resources/js/components/orders/ClinicalLifecycleActionDialog.vue`
- `resources/js/lib/encounterWorkspace.ts`
- `resources/js/lib/encounterWorkspaceLifecycle.ts`
- `resources/js/lib/encounterCloseReadiness.ts`
- `resources/js/lib/encounterOrderProgress.ts`
- `resources/js/lib/encounterInlineOrders.ts`
- `resources/js/lib/encounterWorkspaceCare.ts`
- `resources/js/lib/notify.ts`
- `resources/js/types/encounterWorkspace.ts`
