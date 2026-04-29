<?php

namespace Database\Seeders;

use App\Models\User;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use App\Modules\Staff\Infrastructure\Models\StaffProfileModel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class BaselineStaffDirectorySeeder extends Seeder
{
    /**
     * @var array<int, array{
     *     key: string,
     *     name: string,
     *     department: string,
     *     jobTitle: string,
     *     licenseType: string|null,
     *     professionalLicenseNumber: string|null,
     *     phoneExtension: string,
     *     employmentType: string,
     *     assignmentRole: string
     * }>
     */
    private const STAFF_BLUEPRINTS = [
        [
            'key' => 'surgeon_consultant',
            'name' => 'Asha Mwakalinga',
            'department' => 'Theatre',
            'jobTitle' => 'Consultant Surgeon',
            'licenseType' => 'Medical Council',
            'professionalLicenseNumber' => 'MC-TZ-SURG-001',
            'phoneExtension' => '451',
            'employmentType' => 'full_time',
            'assignmentRole' => 'clinical',
        ],
        [
            'key' => 'surgeon_medical_officer',
            'name' => 'Hamza Suleiman',
            'department' => 'Surgery',
            'jobTitle' => 'Medical Officer',
            'licenseType' => 'Medical Council',
            'professionalLicenseNumber' => 'MC-TZ-MO-002',
            'phoneExtension' => '452',
            'employmentType' => 'full_time',
            'assignmentRole' => 'clinical',
        ],
        [
            'key' => 'anaesthetist_consultant',
            'name' => 'Salma Bakar',
            'department' => 'Theatre',
            'jobTitle' => 'Consultant Anaesthetist',
            'licenseType' => 'Medical Council',
            'professionalLicenseNumber' => 'MC-TZ-AN-003',
            'phoneExtension' => '453',
            'employmentType' => 'full_time',
            'assignmentRole' => 'clinical',
        ],
        [
            'key' => 'theatre_nurse',
            'name' => 'Rehema Mushi',
            'department' => 'Theatre',
            'jobTitle' => 'Theatre Nurse',
            'licenseType' => 'Nursing Council',
            'professionalLicenseNumber' => 'NC-TZ-TH-004',
            'phoneExtension' => '454',
            'employmentType' => 'full_time',
            'assignmentRole' => 'nursing',
        ],
        [
            'key' => 'theatre_scrub_nurse',
            'name' => 'Zainab Ali',
            'department' => 'Theatre',
            'jobTitle' => 'Scrub Nurse',
            'licenseType' => 'Nursing Council',
            'professionalLicenseNumber' => 'NC-TZ-TH-004A',
            'phoneExtension' => '455',
            'employmentType' => 'full_time',
            'assignmentRole' => 'nursing',
        ],
        [
            'key' => 'recovery_nurse',
            'name' => 'Restituta Mahundi',
            'department' => 'Theatre Recovery',
            'jobTitle' => 'Recovery Nurse',
            'licenseType' => 'Nursing Council',
            'professionalLicenseNumber' => 'NC-TZ-RCV-004B',
            'phoneExtension' => '456',
            'employmentType' => 'full_time',
            'assignmentRole' => 'nursing',
        ],
        [
            'key' => 'emergency_medical_officer',
            'name' => 'Khalid Juma',
            'department' => 'Emergency Unit',
            'jobTitle' => 'Emergency Medical Officer',
            'licenseType' => 'Medical Council',
            'professionalLicenseNumber' => 'MC-TZ-EM-005',
            'phoneExtension' => '311',
            'employmentType' => 'full_time',
            'assignmentRole' => 'clinical',
        ],
        [
            'key' => 'triage_nurse',
            'name' => 'Veronica Msuya',
            'department' => 'Emergency Unit',
            'jobTitle' => 'Triage Nurse',
            'licenseType' => 'Nursing Council',
            'professionalLicenseNumber' => 'NC-TZ-TRI-005A',
            'phoneExtension' => '312',
            'employmentType' => 'full_time',
            'assignmentRole' => 'nursing',
        ],
        [
            'key' => 'clinical_officer_opd',
            'name' => 'Paulina Lema',
            'department' => 'General OPD',
            'jobTitle' => 'Clinical Officer',
            'licenseType' => 'Clinical Officer',
            'professionalLicenseNumber' => 'CO-TZ-006',
            'phoneExtension' => '221',
            'employmentType' => 'full_time',
            'assignmentRole' => 'clinical',
        ],
        [
            'key' => 'dispensary_nurse',
            'name' => 'Fatma Mohammed',
            'department' => 'General OPD',
            'jobTitle' => 'Dispensary Nurse',
            'licenseType' => 'Nursing Council',
            'professionalLicenseNumber' => 'NC-TZ-DSP-006A',
            'phoneExtension' => '222',
            'employmentType' => 'full_time',
            'assignmentRole' => 'nursing',
        ],
        [
            'key' => 'procedure_room_nurse',
            'name' => 'Janet Mtei',
            'department' => 'Minor Procedures',
            'jobTitle' => 'Procedure Room Nurse',
            'licenseType' => 'Nursing Council',
            'professionalLicenseNumber' => 'NC-TZ-PRC-006B',
            'phoneExtension' => '223',
            'employmentType' => 'full_time',
            'assignmentRole' => 'nursing',
        ],
        [
            'key' => 'dressing_room_nurse',
            'name' => 'Asha Khamis',
            'department' => 'Dressing Room',
            'jobTitle' => 'Dressing Room Nurse',
            'licenseType' => 'Nursing Council',
            'professionalLicenseNumber' => 'NC-TZ-DRS-006C',
            'phoneExtension' => '224',
            'employmentType' => 'full_time',
            'assignmentRole' => 'nursing',
        ],
        [
            'key' => 'ward_nurse',
            'name' => 'Anna Mushi',
            'department' => 'Inpatient Ward',
            'jobTitle' => 'Ward Nurse',
            'licenseType' => 'Nursing Council',
            'professionalLicenseNumber' => 'NC-TZ-WD-007',
            'phoneExtension' => '322',
            'employmentType' => 'full_time',
            'assignmentRole' => 'nursing',
        ],
        [
            'key' => 'enrolled_nurse_ward',
            'name' => 'Khadija Othman',
            'department' => 'Inpatient Ward',
            'jobTitle' => 'Enrolled Nurse',
            'licenseType' => 'Nursing Council',
            'professionalLicenseNumber' => 'NC-TZ-ENR-007A',
            'phoneExtension' => '324',
            'employmentType' => 'full_time',
            'assignmentRole' => 'nursing',
        ],
        [
            'key' => 'midwife_senior',
            'name' => 'Joyce Mgaya',
            'department' => 'Maternity Ward',
            'jobTitle' => 'Senior Midwife',
            'licenseType' => 'Midwifery Council',
            'professionalLicenseNumber' => 'MW-TZ-008',
            'phoneExtension' => '323',
            'employmentType' => 'full_time',
            'assignmentRole' => 'nursing',
        ],
        [
            'key' => 'lab_technologist',
            'name' => 'Shabani Rajab',
            'department' => 'Laboratory',
            'jobTitle' => 'Laboratory Technologist',
            'licenseType' => 'Laboratory Council',
            'professionalLicenseNumber' => 'LAB-TZ-009',
            'phoneExtension' => '331',
            'employmentType' => 'full_time',
            'assignmentRole' => 'allied_health',
        ],
        [
            'key' => 'radiographer',
            'name' => 'Baraka Mrema',
            'department' => 'Radiology',
            'jobTitle' => 'Radiographer',
            'licenseType' => 'Imaging License',
            'professionalLicenseNumber' => 'RAD-TZ-010',
            'phoneExtension' => '341',
            'employmentType' => 'full_time',
            'assignmentRole' => 'allied_health',
        ],
        [
            'key' => 'pharmacist',
            'name' => 'Maryam Hassan',
            'department' => 'Pharmacy',
            'jobTitle' => 'Pharmacist',
            'licenseType' => 'Pharmacy Council',
            'professionalLicenseNumber' => 'PHARM-TZ-011',
            'phoneExtension' => '351',
            'employmentType' => 'full_time',
            'assignmentRole' => 'pharmacy',
        ],
        [
            'key' => 'pharmacy_technician',
            'name' => 'Frank Mollel',
            'department' => 'Pharmacy',
            'jobTitle' => 'Pharmacy Technician',
            'licenseType' => 'Pharmacy Technician',
            'professionalLicenseNumber' => 'PHT-TZ-012',
            'phoneExtension' => '352',
            'employmentType' => 'full_time',
            'assignmentRole' => 'pharmacy',
        ],
        [
            'key' => 'cashier',
            'name' => 'Zulekha Said',
            'department' => 'Billing and Finance',
            'jobTitle' => 'Cashier',
            'licenseType' => null,
            'professionalLicenseNumber' => null,
            'phoneExtension' => '361',
            'employmentType' => 'full_time',
            'assignmentRole' => 'finance',
        ],
        [
            'key' => 'medical_records_officer',
            'name' => 'Irene Mbise',
            'department' => 'Medical Records',
            'jobTitle' => 'Medical Records Officer',
            'licenseType' => null,
            'professionalLicenseNumber' => null,
            'phoneExtension' => '371',
            'employmentType' => 'full_time',
            'assignmentRole' => 'records',
        ],
        [
            'key' => 'registration_officer',
            'name' => 'Nassor Salim',
            'department' => 'Front Desk',
            'jobTitle' => 'Registration Officer',
            'licenseType' => null,
            'professionalLicenseNumber' => null,
            'phoneExtension' => '201',
            'employmentType' => 'full_time',
            'assignmentRole' => 'front_desk',
        ],
    ];

    public function run(): void
    {
        $facilities = FacilityModel::query()
            ->orderBy('name')
            ->get(['id', 'tenant_id', 'code', 'name']);

        if ($facilities->isEmpty()) {
            $seededCount = $this->seedScope(
                facilityId: null,
                facilityCode: 'global',
                tenantId: null,
            );

            $this->command?->warn(
                sprintf(
                    'No facilities found. Seeded %d global baseline staff profiles.',
                    $seededCount,
                ),
            );

            return;
        }

        foreach ($facilities as $facility) {
            $seededCount = $this->seedScope(
                facilityId: (string) $facility->id,
                facilityCode: $this->normalizeFacilityCode((string) ($facility->code ?: $facility->name ?: $facility->id)),
                tenantId: $facility->tenant_id ? (string) $facility->tenant_id : null,
            );

            $facilityLabel = trim((string) ($facility->name ?: $facility->code ?: $facility->id));
            $this->command?->info(
                sprintf(
                    'Seeded %d baseline staff profiles for %s.',
                    $seededCount,
                    $facilityLabel,
                ),
            );
        }
    }

    private function seedScope(?string $facilityId, string $facilityCode, ?string $tenantId): int
    {
        $seededCount = 0;

        foreach (self::STAFF_BLUEPRINTS as $blueprint) {
            $normalizedFacilityCode = $this->normalizeFacilityCode($facilityCode);
            $email = sprintf('%s.%s@local.test', $blueprint['key'], $normalizedFacilityCode);

            $user = User::query()->firstOrCreate(
                ['email' => $email],
                [
                    'tenant_id' => $tenantId,
                    'name' => $blueprint['name'],
                    'password' => Hash::make('password'),
                    'status' => 'active',
                    'status_reason' => null,
                ],
            );

            $user->forceFill([
                'tenant_id' => $tenantId,
                'name' => $blueprint['name'],
                'status' => 'active',
                'status_reason' => null,
            ])->save();

            if ($facilityId !== null) {
                $existingAssignment = DB::table('facility_user')
                    ->where('facility_id', $facilityId)
                    ->where('user_id', $user->id)
                    ->first();

                if ($existingAssignment) {
                    DB::table('facility_user')
                        ->where('facility_id', $facilityId)
                        ->where('user_id', $user->id)
                        ->update([
                            'role' => $blueprint['assignmentRole'],
                            'is_primary' => true,
                            'is_active' => true,
                            'updated_at' => now(),
                        ]);
                } else {
                    DB::table('facility_user')->insert([
                        'facility_id' => $facilityId,
                        'user_id' => $user->id,
                        'role' => $blueprint['assignmentRole'],
                        'is_primary' => true,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            StaffProfileModel::query()->updateOrCreate(
                ['user_id' => $user->id],
                [
                    'tenant_id' => $tenantId,
                    'employee_number' => sprintf(
                        'STF-%s-%s',
                        strtoupper(substr($normalizedFacilityCode, 0, 8)),
                        preg_replace('/[^A-Z0-9]/', '', strtoupper($blueprint['phoneExtension'])) ?: '000',
                    ),
                    'department' => $blueprint['department'],
                    'job_title' => $blueprint['jobTitle'],
                    'professional_license_number' => $blueprint['professionalLicenseNumber'],
                    'license_type' => $blueprint['licenseType'],
                    'phone_extension' => $blueprint['phoneExtension'],
                    'employment_type' => $blueprint['employmentType'],
                    'status' => 'active',
                    'status_reason' => null,
                ],
            );

            $seededCount++;
        }

        return $seededCount;
    }

    private function normalizeFacilityCode(string $value): string
    {
        $normalized = strtolower(trim($value));
        $normalized = preg_replace('/[^a-z0-9]+/', '-', $normalized) ?? '';
        $normalized = trim($normalized, '-');

        return $normalized !== '' ? $normalized : Str::lower((string) Str::uuid());
    }
}
