<?php

namespace Database\Seeders;

use App\Models\User;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use App\Modules\Platform\Infrastructure\Models\TenantModel;
use App\Modules\Staff\Infrastructure\Models\ClinicalPrivilegeCatalogModel;
use App\Modules\Staff\Infrastructure\Models\ClinicalSpecialtyModel;
use App\Modules\Staff\Infrastructure\Models\StaffCredentialingAuditLogModel;
use App\Modules\Staff\Infrastructure\Models\StaffDocumentModel;
use App\Modules\Staff\Infrastructure\Models\StaffPrivilegeGrantAuditLogModel;
use App\Modules\Staff\Infrastructure\Models\StaffPrivilegeGrantModel;
use App\Modules\Staff\Infrastructure\Models\StaffProfessionalRegistrationModel;
use App\Modules\Staff\Infrastructure\Models\StaffProfileModel;
use App\Modules\Staff\Infrastructure\Models\StaffRegulatoryProfileModel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class TanzaniaStaffCredentialingPrivilegeDemoSeeder extends Seeder
{
    /**
     * @var array<int, array{code:string,name:string,description:string}>
     */
    private const SPECIALTY_BLUEPRINTS = [
        [
            'code' => 'TZ-GEN-SURG',
            'name' => 'General Surgery',
            'description' => 'Core general surgery service line for inpatient and theatre practice.',
        ],
        [
            'code' => 'TZ-ANESTH',
            'name' => 'Anaesthesia',
            'description' => 'Anaesthesia coverage for theatre, recovery, and peri-procedural care.',
        ],
        [
            'code' => 'TZ-PERIOP',
            'name' => 'Perioperative Nursing',
            'description' => 'Perioperative and theatre nursing coverage.',
        ],
        [
            'code' => 'TZ-OUTPAT',
            'name' => 'Outpatient Practice',
            'description' => 'General outpatient consultation and minor-procedure support.',
        ],
        [
            'code' => 'TZ-EMERG',
            'name' => 'Emergency Medicine',
            'description' => 'Emergency unit assessment, stabilization, and escalation.',
        ],
        [
            'code' => 'TZ-LAB',
            'name' => 'Laboratory Practice',
            'description' => 'Laboratory diagnostic and specimen workflow coverage.',
        ],
        [
            'code' => 'TZ-RAD',
            'name' => 'Diagnostic Imaging',
            'description' => 'Radiology and imaging service coverage.',
        ],
        [
            'code' => 'TZ-PHARM',
            'name' => 'Pharmacy Practice',
            'description' => 'Medication verification, dispensing, and pharmacy governance coverage.',
        ],
    ];

    /**
     * @var array<int, array{
     *     specialtyCode:string,
     *     code:string,
     *     name:string,
     *     description:string,
     *     cadreCode:string|null,
     *     facilityType:string|null
     * }>
     */
    private const PRIVILEGE_CATALOG_BLUEPRINTS = [
        [
            'specialtyCode' => 'TZ-GEN-SURG',
            'code' => 'TZ-GS-CORE-001',
            'name' => 'General Surgery Theatre Coverage',
            'description' => 'Core general surgery privilege for theatre and inpatient operative care.',
            'cadreCode' => 'medical_doctor',
            'facilityType' => 'hospital',
        ],
        [
            'specialtyCode' => 'TZ-GEN-SURG',
            'code' => 'TZ-GS-WARD-002',
            'name' => 'Surgical Inpatient Review Coverage',
            'description' => 'Post-operative surgical review and ward round coverage.',
            'cadreCode' => 'medical_doctor',
            'facilityType' => 'hospital',
        ],
        [
            'specialtyCode' => 'TZ-ANESTH',
            'code' => 'TZ-AN-CORE-001',
            'name' => 'Anaesthesia Theatre Coverage',
            'description' => 'Anaesthesia coverage for theatre lists and immediate recovery handover.',
            'cadreCode' => 'medical_doctor',
            'facilityType' => 'hospital',
        ],
        [
            'specialtyCode' => 'TZ-ANESTH',
            'code' => 'TZ-AN-REC-002',
            'name' => 'Recovery and Sedation Support',
            'description' => 'Peri-procedural sedation and recovery oversight coverage.',
            'cadreCode' => 'medical_doctor',
            'facilityType' => 'hospital',
        ],
        [
            'specialtyCode' => 'TZ-PERIOP',
            'code' => 'TZ-PO-NUR-001',
            'name' => 'Perioperative Nursing Coverage',
            'description' => 'Perioperative nursing support for theatre setup, counts, and recovery coordination.',
            'cadreCode' => 'registered_nurse',
            'facilityType' => 'hospital',
        ],
        [
            'specialtyCode' => 'TZ-PERIOP',
            'code' => 'TZ-PO-STER-002',
            'name' => 'Sterile Field and Instrument Count Coordination',
            'description' => 'Sterile field maintenance, swab counts, and instrument reconciliation coverage.',
            'cadreCode' => 'registered_nurse',
            'facilityType' => 'hospital',
        ],
        [
            'specialtyCode' => 'TZ-OUTPAT',
            'code' => 'TZ-OPD-CORE-001',
            'name' => 'Outpatient Consultation Coverage',
            'description' => 'General outpatient consultation and follow-up review privilege.',
            'cadreCode' => 'clinical_officer',
            'facilityType' => 'hospital',
        ],
        [
            'specialtyCode' => 'TZ-OUTPAT',
            'code' => 'TZ-OPD-MIN-002',
            'name' => 'Minor Procedure Room Support',
            'description' => 'Minor procedure room support for wound care, suturing, and observation.',
            'cadreCode' => 'clinical_officer',
            'facilityType' => 'hospital',
        ],
        [
            'specialtyCode' => 'TZ-EMERG',
            'code' => 'TZ-EM-CORE-001',
            'name' => 'Emergency Unit Coverage',
            'description' => 'Emergency assessment, stabilization, and escalation coverage.',
            'cadreCode' => 'medical_doctor',
            'facilityType' => 'hospital',
        ],
        [
            'specialtyCode' => 'TZ-EMERG',
            'code' => 'TZ-EM-RESUS-002',
            'name' => 'Emergency Stabilization and Referral Coordination',
            'description' => 'Emergency resuscitation, triage escalation, and referral coordination coverage.',
            'cadreCode' => 'medical_doctor',
            'facilityType' => 'hospital',
        ],
        [
            'specialtyCode' => 'TZ-LAB',
            'code' => 'TZ-LAB-CORE-001',
            'name' => 'Core Laboratory Diagnostics Coverage',
            'description' => 'Routine laboratory diagnostics, specimen handling, and result release coverage.',
            'cadreCode' => 'laboratory_scientist',
            'facilityType' => 'hospital',
        ],
        [
            'specialtyCode' => 'TZ-RAD',
            'code' => 'TZ-RAD-CORE-001',
            'name' => 'Diagnostic Imaging Coverage',
            'description' => 'Radiology image acquisition and diagnostic imaging workflow coverage.',
            'cadreCode' => 'radiographer',
            'facilityType' => 'hospital',
        ],
        [
            'specialtyCode' => 'TZ-PHARM',
            'code' => 'TZ-PHARM-CORE-001',
            'name' => 'Pharmacy Dispensing Coverage',
            'description' => 'Medication verification, dispensing, and controlled stock oversight coverage.',
            'cadreCode' => 'pharmacist',
            'facilityType' => 'hospital',
        ],
    ];

    /**
     * @var array<int, array{
     *     department:string,
     *     jobTitle:string,
     *     documentType:string,
     *     documentTitle:string,
     *     documentExpiresOffsetDays:int,
     *     documentVerificationStatus:string,
     *     regulatorCode:string,
     *     cadreCode:string,
     *     professionalTitle:string,
     *     registrationType:string,
     *     practiceAuthorityLevel:string,
     *     supervisionLevel:string,
     *     goodStandingStatus:string,
     *     registrationCategory:string,
     *     registrationStatus:string,
     *     licenseStatus:string,
     *     verificationStatus:string,
     *     privilegeStatus:string,
     *     privileges:array<int, array{specialtyCode:string,privilegeCode:string,privilegeName:string,scopeNotes:string,reviewDueOffsetDays:int}>
     * }>
     */
    private const DEMO_SCENARIOS = [
        [
            'department' => 'Theatre',
            'jobTitle' => 'Consultant Surgeon',
            'documentType' => 'license_copy',
            'documentTitle' => 'MCT Specialist License',
            'documentExpiresOffsetDays' => 180,
            'documentVerificationStatus' => 'verified',
            'regulatorCode' => 'mct',
            'cadreCode' => 'medical_doctor',
            'professionalTitle' => 'Consultant Surgeon',
            'registrationType' => 'full',
            'practiceAuthorityLevel' => 'independent',
            'supervisionLevel' => 'independent',
            'goodStandingStatus' => 'in_good_standing',
            'registrationCategory' => 'annual_practicing_license',
            'registrationStatus' => 'active',
            'licenseStatus' => 'active',
            'verificationStatus' => 'verified',
            'privilegeStatus' => 'active',
            'privileges' => [
                [
                    'specialtyCode' => 'TZ-GEN-SURG',
                    'privilegeCode' => 'TZ-GS-CORE-001',
                    'privilegeName' => 'General Surgery Theatre Coverage',
                    'scopeNotes' => 'Core general surgery privilege for theatre and inpatient operative care.',
                    'reviewDueOffsetDays' => 180,
                ],
            ],
        ],
        [
            'department' => 'Theatre',
            'jobTitle' => 'Consultant Anaesthetist',
            'documentType' => 'license_copy',
            'documentTitle' => 'MCT Anaesthesia License',
            'documentExpiresOffsetDays' => 12,
            'documentVerificationStatus' => 'verified',
            'regulatorCode' => 'mct',
            'cadreCode' => 'medical_doctor',
            'professionalTitle' => 'Consultant Anaesthetist',
            'registrationType' => 'full',
            'practiceAuthorityLevel' => 'independent',
            'supervisionLevel' => 'independent',
            'goodStandingStatus' => 'in_good_standing',
            'registrationCategory' => 'annual_practicing_license',
            'registrationStatus' => 'active',
            'licenseStatus' => 'active',
            'verificationStatus' => 'verified',
            'privilegeStatus' => 'approved',
            'privileges' => [
                [
                    'specialtyCode' => 'TZ-ANESTH',
                    'privilegeCode' => 'TZ-AN-CORE-001',
                    'privilegeName' => 'Anaesthesia Theatre Coverage',
                    'scopeNotes' => 'Anaesthesia coverage for theatre lists and immediate recovery handover.',
                    'reviewDueOffsetDays' => 90,
                ],
            ],
        ],
        [
            'department' => 'Theatre',
            'jobTitle' => 'Theatre Nurse',
            'documentType' => 'license_copy',
            'documentTitle' => 'TNMC Theatre Nursing License',
            'documentExpiresOffsetDays' => -8,
            'documentVerificationStatus' => 'verified',
            'regulatorCode' => 'tnmc',
            'cadreCode' => 'registered_nurse',
            'professionalTitle' => 'Theatre Nurse',
            'registrationType' => 'full',
            'practiceAuthorityLevel' => 'independent',
            'supervisionLevel' => 'independent',
            'goodStandingStatus' => 'in_good_standing',
            'registrationCategory' => 'annual_practicing_license',
            'registrationStatus' => 'active',
            'licenseStatus' => 'expired',
            'verificationStatus' => 'verified',
            'privilegeStatus' => 'suspended',
            'privileges' => [
                [
                    'specialtyCode' => 'TZ-PERIOP',
                    'privilegeCode' => 'TZ-PO-NUR-001',
                    'privilegeName' => 'Perioperative Nursing Coverage',
                    'scopeNotes' => 'Perioperative nursing support for theatre setup, counts, and recovery coordination.',
                    'reviewDueOffsetDays' => 60,
                ],
            ],
        ],
        [
            'department' => 'General OPD',
            'jobTitle' => 'Clinical Officer',
            'documentType' => 'license_copy',
            'documentTitle' => 'Clinical Practice License',
            'documentExpiresOffsetDays' => 90,
            'documentVerificationStatus' => 'pending',
            'regulatorCode' => 'mct',
            'cadreCode' => 'clinical_officer',
            'professionalTitle' => 'Clinical Officer',
            'registrationType' => 'full',
            'practiceAuthorityLevel' => 'independent',
            'supervisionLevel' => 'independent',
            'goodStandingStatus' => 'in_good_standing',
            'registrationCategory' => 'annual_practicing_license',
            'registrationStatus' => 'active',
            'licenseStatus' => 'active',
            'verificationStatus' => 'pending',
            'privilegeStatus' => 'requested',
            'privileges' => [
                [
                    'specialtyCode' => 'TZ-OUTPAT',
                    'privilegeCode' => 'TZ-OPD-CORE-001',
                    'privilegeName' => 'Outpatient Consultation Coverage',
                    'scopeNotes' => 'General outpatient consultation and follow-up review privilege.',
                    'reviewDueOffsetDays' => 120,
                ],
            ],
        ],
        [
            'department' => 'Emergency Unit',
            'jobTitle' => 'Emergency Medical Officer',
            'documentType' => 'license_copy',
            'documentTitle' => 'Emergency Practice License',
            'documentExpiresOffsetDays' => 200,
            'documentVerificationStatus' => 'verified',
            'regulatorCode' => 'mct',
            'cadreCode' => 'medical_doctor',
            'professionalTitle' => 'Emergency Medical Officer',
            'registrationType' => 'full',
            'practiceAuthorityLevel' => 'independent',
            'supervisionLevel' => 'independent',
            'goodStandingStatus' => 'in_good_standing',
            'registrationCategory' => 'annual_practicing_license',
            'registrationStatus' => 'active',
            'licenseStatus' => 'active',
            'verificationStatus' => 'verified',
            'privilegeStatus' => 'under_review',
            'privileges' => [
                [
                    'specialtyCode' => 'TZ-EMERG',
                    'privilegeCode' => 'TZ-EM-CORE-001',
                    'privilegeName' => 'Emergency Unit Coverage',
                    'scopeNotes' => 'Emergency assessment, stabilization, and escalation coverage.',
                    'reviewDueOffsetDays' => 150,
                ],
            ],
        ],
    ];

    public function run(): void
    {
        $this->ensureDemoFacilityIfMissing();
        $this->call(BaselineStaffDirectorySeeder::class);
        $committeeActors = $this->ensureCommitteeActors();

        $facilities = FacilityModel::query()
            ->orderBy('name')
            ->get(['id', 'tenant_id', 'code', 'name']);

        if ($facilities->isEmpty()) {
            $this->command?->warn('No facilities are available for Tanzania credentialing demo seeding.');

            return;
        }

        foreach ($facilities as $facility) {
            $tenantId = $facility->tenant_id ? (string) $facility->tenant_id : null;
            $specialties = $this->ensureSpecialties($tenantId);
            $privilegeCatalogs = $this->ensurePrivilegeCatalogs($tenantId, $specialties);
            $seededScenarioCount = 0;

            foreach (self::DEMO_SCENARIOS as $scenario) {
                $profile = $this->findFacilityProfile(
                    facilityId: (string) $facility->id,
                    department: $scenario['department'],
                    jobTitle: $scenario['jobTitle'],
                );

                if (! $profile) {
                    $this->command?->warn(sprintf(
                        'Skipped Tanzania demo scenario for %s / %s at %s because no matching staff profile was found.',
                        $scenario['department'],
                        $scenario['jobTitle'],
                        $facility->name ?: $facility->code ?: $facility->id,
                    ));
                    continue;
                }

                $document = $this->upsertDocument(
                    profile: $profile,
                    title: $scenario['documentTitle'],
                    documentType: $scenario['documentType'],
                    verificationStatus: $scenario['documentVerificationStatus'],
                    expiresOffsetDays: $scenario['documentExpiresOffsetDays'],
                );

                $regulatoryProfile = $this->upsertRegulatoryProfile($profile, $scenario);
                $registration = $this->upsertRegistration(
                    profile: $profile,
                    regulatoryProfileId: (string) $regulatoryProfile->id,
                    sourceDocumentId: (string) $document->id,
                    facilityCode: (string) ($facility->code ?: 'FACILITY'),
                    scenario: $scenario,
                );

                $this->upsertCredentialingAuditLogs($profile, $regulatoryProfile, $registration, $scenario);

                foreach ($scenario['privileges'] as $privilegeBlueprint) {
                    $specialtyId = $specialties[$privilegeBlueprint['specialtyCode']] ?? null;
                    if (! $specialtyId) {
                        continue;
                    }

                    $grant = $this->upsertPrivilegeGrant(
                        profile: $profile,
                        tenantId: $tenantId,
                        facilityId: (string) $facility->id,
                        specialtyId: $specialtyId,
                        privilegeCatalogId: $privilegeCatalogs[$privilegeBlueprint['privilegeCode']] ?? null,
                        committeeActors: $committeeActors,
                        scenario: $scenario,
                        privilegeBlueprint: $privilegeBlueprint,
                    );

                    $this->upsertPrivilegeAuditLog($grant, $committeeActors);
                }

                $seededScenarioCount++;
            }

            $facilityLabel = trim((string) ($facility->name ?: $facility->code ?: $facility->id));
            $this->command?->info(sprintf(
                'Seeded Tanzania credentialing + privileging demo data for %s (%d staff scenarios).',
                $facilityLabel,
                $seededScenarioCount,
            ));
        }
    }

    /**
     * @return array{reviewerId:int,approverId:int}
     */
    private function ensureCommitteeActors(): array
    {
        $reviewer = User::query()->firstOrCreate(
            ['email' => 'halima.msuya.committee.demo@afyanova.local'],
            [
                'name' => 'Halima Msuya',
                'password' => Hash::make(Str::random(40)),
                'email_verified_at' => now(),
            ],
        );
        $approver = User::query()->firstOrCreate(
            ['email' => 'nassor.juma.committee.demo@afyanova.local'],
            [
                'name' => 'Nassor Juma',
                'password' => Hash::make(Str::random(40)),
                'email_verified_at' => now(),
            ],
        );

        return [
            'reviewerId' => $reviewer->id,
            'approverId' => $approver->id,
        ];
    }

    /**
     * @return array<string, string>
     */
    private function ensureSpecialties(?string $tenantId): array
    {
        $specialtyIds = [];

        foreach (self::SPECIALTY_BLUEPRINTS as $blueprint) {
            $specialty = ClinicalSpecialtyModel::query()->updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'code' => $blueprint['code'],
                ],
                [
                    'name' => $blueprint['name'],
                    'description' => $blueprint['description'],
                    'status' => 'active',
                    'status_reason' => null,
                ],
            );

            $specialtyIds[$blueprint['code']] = (string) $specialty->id;
        }

        return $specialtyIds;
    }

    /**
     * @param  array<string, string>  $specialties
     * @return array<string, string>
     */
    private function ensurePrivilegeCatalogs(?string $tenantId, array $specialties): array
    {
        $catalogIds = [];

        foreach (self::PRIVILEGE_CATALOG_BLUEPRINTS as $blueprint) {
            $specialtyId = $specialties[$blueprint['specialtyCode']] ?? null;
            if (! $specialtyId) {
                continue;
            }

            $catalog = ClinicalPrivilegeCatalogModel::query()->updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'code' => $blueprint['code'],
                ],
                [
                    'specialty_id' => $specialtyId,
                    'name' => $blueprint['name'],
                    'description' => $blueprint['description'],
                    'cadre_code' => $blueprint['cadreCode'],
                    'facility_type' => $blueprint['facilityType'],
                    'status' => 'active',
                    'status_reason' => null,
                ],
            );

            $catalogIds[$blueprint['code']] = (string) $catalog->id;
        }

        return $catalogIds;
    }

    private function findFacilityProfile(string $facilityId, string $department, string $jobTitle): ?StaffProfileModel
    {
        return StaffProfileModel::query()
            ->select('staff_profiles.*')
            ->join('facility_user', 'facility_user.user_id', '=', 'staff_profiles.user_id')
            ->where('facility_user.facility_id', $facilityId)
            ->where('facility_user.is_active', true)
            ->where('staff_profiles.department', $department)
            ->where('staff_profiles.job_title', $jobTitle)
            ->orderBy('staff_profiles.created_at')
            ->first();
    }

    private function upsertDocument(
        StaffProfileModel $profile,
        string $title,
        string $documentType,
        string $verificationStatus,
        int $expiresOffsetDays,
    ): StaffDocumentModel {
        $expiresAt = Carbon::today()->addDays($expiresOffsetDays)->toDateString();
        $issuedAt = Carbon::today()->subDays(335)->toDateString();

        return StaffDocumentModel::query()->updateOrCreate(
            [
                'staff_profile_id' => $profile->id,
                'document_type' => $documentType,
                'title' => $title,
            ],
            [
                'tenant_id' => $profile->tenant_id,
                'description' => 'Demo source document for Tanzania credentialing workflows.',
                'file_path' => 'staff-documents/demo/'.$profile->id.'/'.$documentType.'.pdf',
                'original_filename' => Str::slug($title).'.pdf',
                'mime_type' => 'application/pdf',
                'file_size_bytes' => 1024,
                'checksum_sha256' => hash('sha256', $profile->id.$title.$expiresAt),
                'issued_at' => $issuedAt,
                'expires_at' => $expiresAt,
                'verification_status' => $verificationStatus,
                'verification_reason' => $verificationStatus === 'pending' ? 'Awaiting manual verification.' : null,
                'status' => 'active',
                'status_reason' => null,
                'uploaded_by_user_id' => null,
                'verified_by_user_id' => null,
                'verified_at' => $verificationStatus === 'verified' ? Carbon::now()->subDays(7) : null,
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $scenario
     */
    private function upsertRegulatoryProfile(StaffProfileModel $profile, array $scenario): StaffRegulatoryProfileModel
    {
        return StaffRegulatoryProfileModel::query()->updateOrCreate(
            ['staff_profile_id' => $profile->id],
            [
                'tenant_id' => $profile->tenant_id,
                'primary_regulator_code' => $scenario['regulatorCode'],
                'cadre_code' => $scenario['cadreCode'],
                'professional_title' => $scenario['professionalTitle'],
                'registration_type' => $scenario['registrationType'],
                'practice_authority_level' => $scenario['practiceAuthorityLevel'],
                'supervision_level' => $scenario['supervisionLevel'],
                'good_standing_status' => $scenario['goodStandingStatus'],
                'good_standing_checked_at' => Carbon::today()->subDays(10)->toDateString(),
                'notes' => 'Seeded Tanzania credentialing demo profile.',
                'created_by_user_id' => null,
                'updated_by_user_id' => null,
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $scenario
     */
    private function upsertRegistration(
        StaffProfileModel $profile,
        string $regulatoryProfileId,
        string $sourceDocumentId,
        string $facilityCode,
        array $scenario,
    ): StaffProfessionalRegistrationModel {
        $normalizedFacilityCode = strtoupper(preg_replace('/[^A-Z0-9]+/', '', strtoupper($facilityCode)) ?: 'FACILITY');
        $registrationNumber = sprintf(
            '%s-%s-%s',
            strtoupper($scenario['regulatorCode']),
            $normalizedFacilityCode,
            strtoupper(substr(md5($profile->id.$scenario['registrationCategory']), 0, 8)),
        );
        $expiresAt = Carbon::today()->addDays((int) $scenario['documentExpiresOffsetDays'])->toDateString();

        return StaffProfessionalRegistrationModel::query()->updateOrCreate(
            [
                'staff_profile_id' => $profile->id,
                'regulator_code' => $scenario['regulatorCode'],
                'registration_number' => $registrationNumber,
            ],
            [
                'tenant_id' => $profile->tenant_id,
                'staff_regulatory_profile_id' => $regulatoryProfileId,
                'registration_category' => $scenario['registrationCategory'],
                'license_number' => 'LIC-'.substr(strtoupper(md5($profile->id.$scenario['jobTitle'])), 0, 12),
                'registration_status' => $scenario['registrationStatus'],
                'license_status' => $scenario['licenseStatus'],
                'verification_status' => $scenario['verificationStatus'],
                'verification_reason' => $scenario['verificationStatus'] === 'pending' ? 'Pending council verification.' : null,
                'verification_notes' => $scenario['verificationStatus'] === 'pending'
                    ? 'Seeded pending verification for demo coverage gating.'
                    : 'Seeded verified record for demo coverage gating.',
                'verified_at' => $scenario['verificationStatus'] === 'verified' ? Carbon::now()->subDays(5) : null,
                'verified_by_user_id' => null,
                'issued_at' => Carbon::today()->subDays(330)->toDateString(),
                'expires_at' => $expiresAt,
                'renewal_due_at' => Carbon::parse($expiresAt)->subDays(15)->toDateString(),
                'cpd_cycle_start_at' => Carbon::today()->startOfYear()->toDateString(),
                'cpd_cycle_end_at' => Carbon::today()->endOfYear()->toDateString(),
                'cpd_points_required' => 30,
                'cpd_points_earned' => $scenario['verificationStatus'] === 'verified' ? 24 : 10,
                'source_document_id' => $sourceDocumentId,
                'source_system' => 'demo_seed',
                'notes' => 'Seeded Tanzania credentialing demo registration.',
                'created_by_user_id' => null,
                'updated_by_user_id' => null,
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $scenario
     * @param  array{specialtyCode:string,privilegeCode:string,privilegeName:string,scopeNotes:string,reviewDueOffsetDays:int}  $privilegeBlueprint
     * @param  array{reviewerId:int,approverId:int}  $committeeActors
     */
    private function upsertPrivilegeGrant(
        StaffProfileModel $profile,
        ?string $tenantId,
        string $facilityId,
        string $specialtyId,
        ?string $privilegeCatalogId,
        array $committeeActors,
        array $scenario,
        array $privilegeBlueprint,
    ): StaffPrivilegeGrantModel {
        $grantedAt = Carbon::today()->subDays(45)->toDateString();
        $requestedAt = Carbon::parse($grantedAt)->subDays(14)->startOfDay();
        $reviewStartedAt = in_array($scenario['privilegeStatus'], ['under_review', 'approved', 'active', 'suspended', 'retired'], true)
            ? (clone $requestedAt)->addDays(3)
            : null;
        $approvedAt = in_array($scenario['privilegeStatus'], ['approved', 'active', 'suspended', 'retired'], true)
            ? (clone $requestedAt)->addDays(7)
            : null;
        $activatedAt = in_array($scenario['privilegeStatus'], ['active', 'suspended', 'retired'], true)
            ? Carbon::parse($grantedAt)->startOfDay()
            : null;
        $statusReason = match ($scenario['privilegeStatus']) {
            'requested' => 'Awaiting department review.',
            'under_review' => 'Department review is in progress.',
            'approved' => 'Approved and waiting for activation.',
            'suspended' => 'Temporarily held pending credential renewal.',
            default => null,
        };
        $reviewerUserId = in_array($scenario['privilegeStatus'], ['under_review', 'approved', 'active', 'suspended', 'retired'], true)
            ? $committeeActors['reviewerId']
            : null;
        $reviewNote = match ($scenario['privilegeStatus']) {
            'under_review' => 'Department reviewer confirmed the request is ready for committee agenda.',
            'approved', 'active', 'suspended', 'retired' => 'Department reviewer confirmed facility readiness and scope alignment.',
            default => null,
        };
        $approverUserId = in_array($scenario['privilegeStatus'], ['approved', 'active', 'suspended', 'retired'], true)
            ? $committeeActors['approverId']
            : null;
        $approvalNote = match ($scenario['privilegeStatus']) {
            'approved' => 'Medical staff committee approved and queued the request for activation.',
            'active' => 'Medical staff committee approved the request before activation.',
            'suspended' => 'Medical staff committee approval remains on file while the privilege is temporarily held.',
            'retired' => 'Medical staff committee approval remains archived with the retired privilege record.',
            default => null,
        };

        return StaffPrivilegeGrantModel::query()->updateOrCreate(
            [
                'staff_profile_id' => $profile->id,
                'facility_id' => $facilityId,
                'specialty_id' => $specialtyId,
                'privilege_code' => $privilegeBlueprint['privilegeCode'],
            ],
            [
                'tenant_id' => $tenantId,
                'privilege_catalog_id' => $privilegeCatalogId,
                'privilege_name' => $privilegeBlueprint['privilegeName'],
                'scope_notes' => $privilegeBlueprint['scopeNotes'],
                'granted_at' => $grantedAt,
                'review_due_at' => Carbon::today()->addDays($privilegeBlueprint['reviewDueOffsetDays'])->toDateString(),
                'requested_at' => $requestedAt,
                'review_started_at' => $reviewStartedAt,
                'approved_at' => $approvedAt,
                'activated_at' => $activatedAt,
                'status' => $scenario['privilegeStatus'],
                'status_reason' => $statusReason,
                'granted_by_user_id' => null,
                'reviewer_user_id' => $reviewerUserId,
                'review_note' => $reviewNote,
                'approver_user_id' => $approverUserId,
                'approval_note' => $approvalNote,
                'updated_by_user_id' => null,
            ],
        );
    }

    /**
     * @param  array{reviewerId:int,approverId:int}  $committeeActors
     */
    private function upsertPrivilegeAuditLog(StaffPrivilegeGrantModel $grant, array $committeeActors): void
    {
        StaffPrivilegeGrantAuditLogModel::query()->firstOrCreate(
            [
                'staff_privilege_grant_id' => $grant->id,
                'action' => 'staff-privilege-grant.created',
            ],
            [
                'staff_profile_id' => $grant->staff_profile_id,
                'actor_id' => null,
                'changes' => [
                    'after' => [
                        'facility_id' => $grant->facility_id,
                        'specialty_id' => $grant->specialty_id,
                        'privilege_catalog_id' => $grant->privilege_catalog_id,
                        'privilege_code' => $grant->privilege_code,
                        'privilege_name' => $grant->privilege_name,
                        'status' => 'requested',
                        'review_due_at' => optional($grant->review_due_at)->toDateString(),
                    ],
                ],
                'metadata' => [
                    'source' => 'demo_seed',
                ],
                'created_at' => Carbon::parse($grant->requested_at ?? $grant->created_at ?? Carbon::today()->toDateString())->addHours(9),
            ],
        );

        if ($grant->status !== 'requested') {
            $transitionedAt = $grant->activated_at
                ?? $grant->approved_at
                ?? $grant->review_started_at
                ?? $grant->updated_at
                ?? $grant->created_at;

            StaffPrivilegeGrantAuditLogModel::query()->updateOrCreate(
                [
                    'staff_privilege_grant_id' => $grant->id,
                    'action' => 'staff-privilege-grant.status.updated',
                ],
                [
                    'staff_profile_id' => $grant->staff_profile_id,
                    'actor_id' => match ($grant->status) {
                        'under_review' => $committeeActors['reviewerId'],
                        'approved' => $committeeActors['approverId'],
                        default => null,
                    },
                    'changes' => [
                        'status' => [
                            'before' => $this->priorWorkflowStatus($grant->status),
                            'after' => $grant->status,
                        ],
                        'status_reason' => [
                            'before' => null,
                            'after' => $grant->status_reason,
                        ],
                        'reviewer_user_id' => [
                            'before' => null,
                            'after' => $grant->reviewer_user_id,
                        ],
                        'review_note' => [
                            'before' => null,
                            'after' => $grant->review_note,
                        ],
                        'approver_user_id' => [
                            'before' => null,
                            'after' => $grant->approver_user_id,
                        ],
                        'approval_note' => [
                            'before' => null,
                            'after' => $grant->approval_note,
                        ],
                    ],
                    'metadata' => [
                        'source' => 'demo_seed',
                        'transition' => [
                            'from' => $this->priorWorkflowStatus($grant->status),
                            'to' => $grant->status,
                        ],
                        'reason_required' => in_array($grant->status, ['suspended', 'retired'], true),
                        'reason_provided' => $grant->status_reason !== null,
                        'governance_stage' => match ($grant->status) {
                            'under_review' => 'review',
                            'approved' => 'approval',
                            default => 'status',
                        },
                    ],
                    'created_at' => $transitionedAt ? Carbon::parse($transitionedAt) : Carbon::now(),
                ],
            );
        }
    }

    private function priorWorkflowStatus(string $status): string
    {
        return match ($status) {
            'under_review' => 'requested',
            'approved' => 'under_review',
            'active' => 'approved',
            'suspended' => 'active',
            'retired' => 'active',
            default => 'requested',
        };
    }

    /**
     * @param  array<string, mixed>  $scenario
     */
    private function upsertCredentialingAuditLogs(
        StaffProfileModel $profile,
        StaffRegulatoryProfileModel $regulatoryProfile,
        StaffProfessionalRegistrationModel $registration,
        array $scenario,
    ): void {
        StaffCredentialingAuditLogModel::query()->firstOrCreate(
            [
                'staff_profile_id' => $profile->id,
                'staff_regulatory_profile_id' => $regulatoryProfile->id,
                'action' => 'staff-credentialing.regulatory-profile.created',
            ],
            [
                'tenant_id' => $profile->tenant_id,
                'staff_professional_registration_id' => null,
                'actor_id' => null,
                'changes' => [
                    'after' => [
                        'primary_regulator_code' => $regulatoryProfile->primary_regulator_code,
                        'cadre_code' => $regulatoryProfile->cadre_code,
                        'good_standing_status' => $regulatoryProfile->good_standing_status,
                    ],
                ],
                'metadata' => [
                    'source' => 'demo_seed',
                ],
                'created_at' => Carbon::now()->subDays(40),
            ],
        );

        StaffCredentialingAuditLogModel::query()->firstOrCreate(
            [
                'staff_profile_id' => $profile->id,
                'staff_professional_registration_id' => $registration->id,
                'action' => 'staff-credentialing.registration.created',
            ],
            [
                'tenant_id' => $profile->tenant_id,
                'staff_regulatory_profile_id' => $regulatoryProfile->id,
                'actor_id' => null,
                'changes' => [
                    'after' => [
                        'regulator_code' => $registration->regulator_code,
                        'registration_category' => $registration->registration_category,
                        'verification_status' => $registration->verification_status,
                        'expires_at' => optional($registration->expires_at)->toDateString(),
                    ],
                ],
                'metadata' => [
                    'source' => 'demo_seed',
                ],
                'created_at' => Carbon::now()->subDays(35),
            ],
        );

        if ($scenario['verificationStatus'] !== 'verified') {
            StaffCredentialingAuditLogModel::query()->firstOrCreate(
                [
                    'staff_profile_id' => $profile->id,
                    'staff_professional_registration_id' => $registration->id,
                    'action' => 'staff-credentialing.registration.verification.updated',
                ],
                [
                    'tenant_id' => $profile->tenant_id,
                    'staff_regulatory_profile_id' => $regulatoryProfile->id,
                    'actor_id' => null,
                    'changes' => [
                        'verification_status' => [
                            'before' => 'verified',
                            'after' => $registration->verification_status,
                        ],
                    ],
                    'metadata' => [
                        'source' => 'demo_seed',
                        'reason' => $registration->verification_reason,
                    ],
                    'created_at' => Carbon::now()->subDays(20),
                ],
            );
        }
    }

    private function ensureDemoFacilityIfMissing(): void
    {
        if (FacilityModel::query()->exists()) {
            return;
        }

        $tenant = TenantModel::query()->firstOrCreate(
            ['code' => 'AFYTZ'],
            [
                'name' => 'AfyaNova Tanzania Demo',
                'country_code' => 'TZ',
                'status' => 'active',
            ],
        );

        FacilityModel::query()->firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'code' => 'DAR-MAIN',
            ],
            [
                'name' => 'Dar Main Hospital',
                'facility_type' => 'hospital',
                'timezone' => 'Africa/Dar_es_Salaam',
                'status' => 'active',
            ],
        );
    }
}
