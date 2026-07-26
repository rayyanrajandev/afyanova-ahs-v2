<?php

namespace Database\Seeders;

use App\Modules\Department\Infrastructure\Models\DepartmentModel;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use Illuminate\Database\Seeder;

class DskLabClinicalCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $facility = FacilityModel::where('code', 'DSK')->first();

        if (!$facility) {
            $this->command?->error('DSK facility not found. Run InitialFacilitySeeder first.');
            return;
        }

        $labDeptId = DepartmentModel::where('facility_id', $facility->id)->where('code', 'LAB')->value('id');

        if (!$labDeptId) {
            $this->command?->error('LAB department not found for DSK. Run DskDepartmentsSeeder first.');
            return;
        }

        $items = [
            [
                'code' => 'LAB-MRDT-001',
                'name' => 'Malaria Rapid Diagnostic Test',
                'category' => 'parasitology',
                'unit' => 'test',
                'description' => 'A rapid screening test that detects malaria parasite antigens in a small blood sample, providing results within 15–20 minutes.',
            ],
            [
                'code' => 'LAB-HIV-001',
                'name' => 'Human Immunodeficiency Virus Test',
                'category' => 'serology_immunology',
                'unit' => 'test',
                'description' => 'A laboratory test used to detect HIV infection in a person\'s blood sample.',
            ],
            [
                'code' => 'LAB-HPYLORI-001',
                'name' => 'H. pylori Antibody Test',
                'category' => 'serology_immunology',
                'unit' => 'test',
                'description' => 'An H. pylori test is used to detect infection with Helicobacter Pylori infection.',
            ],
            [
                'code' => 'LAB-VDRL-001',
                'name' => 'Syphilis Test (VDRL)',
                'category' => 'serology_immunology',
                'unit' => 'test',
                'description' => 'Screens for syphilis infection.',
            ],
            [
                'code' => 'LAB-HB-001',
                'name' => 'Hemoglobin (Hb) Test',
                'category' => 'hematology',
                'unit' => 'report',
                'description' => 'Measures blood hemoglobin levels to check for anemia.',
            ],
            [
                'code' => 'LAB-RBG-001',
                'name' => 'Blood Sugar (RBG)',
                'category' => 'clinical_chemistry',
                'unit' => 'report',
                'description' => 'Measures glucose levels for diabetes screening.',
            ],
            [
                'code' => 'LAB-ABO-001',
                'name' => 'Blood Grouping & Rh Factor',
                'category' => 'blood_bank_transfusion',
                'unit' => 'test',
                'description' => 'Determines blood type and Rh status.',
            ],
            [
                'code' => 'LAB-URINE-001',
                'name' => 'Urinalysis',
                'category' => 'parasitology',
                'unit' => 'slide',
                'description' => 'Examines urine for infections, kidney disease, and other conditions.',
            ],
            [
                'code' => 'LAB-STOOL-001',
                'name' => 'Stool Analysis',
                'category' => 'parasitology',
                'unit' => 'slide',
                'description' => 'Detects intestinal parasites and gastrointestinal infections.',
            ],
            [
                'code' => 'LAB-ESR-001',
                'name' => 'Erythrocyte Sedimentation Rate (ESR)',
                'category' => 'hematology',
                'unit' => 'sample',
                'description' => 'Detects inflammation in the body.',
            ],
            [
                'code' => 'LAB-HVS-001',
                'name' => 'High Vaginal Swab Test',
                'category' => 'microbiology',
                'unit' => 'slide',
                'description' => 'Detect Bacteria, Fungi and Parasites.',
            ],
            [
                'code' => 'LAB-UPT-001',
                'name' => 'Urine Pregnancy Test (UPT)',
                'category' => 'parasitology',
                'unit' => 'test',
                'description' => 'Detects pregnancy.',
            ],
            [
                'code' => 'LAB-HBSAG-001',
                'name' => 'Hepatitis B Test (HBsAg)',
                'category' => 'serology_immunology',
                'unit' => 'test',
                'description' => 'Detects Hepatitis B infection.',
            ],
            [
                'code' => 'LAB-WIDAL-001',
                'name' => 'Typhoid Test (Widal Test)',
                'category' => 'serology_immunology',
                'unit' => 'test',
                'description' => 'Screens for typhoid fever.',
            ],
            [
                'code' => 'LAB-CHO-001',
                'name' => 'Lipid Profile (Cholesterol)',
                'category' => 'clinical_chemistry',
                'unit' => 'report',
                'description' => 'Measures cholesterol levels in the blood.',
            ],
            [
                'code' => 'LAB-URA-001',
                'name' => 'Renal Function Test (Uric Acid)',
                'category' => 'clinical_chemistry',
                'unit' => 'report',
                'description' => 'Detects Uric Acid level in blood.',
            ],
        ];

        foreach ($items as $item) {
            ClinicalCatalogItemModel::firstOrCreate(
                [
                    'facility_id' => $facility->id,
                    'catalog_type' => 'lab_test',
                    'code' => $item['code'],
                ],
                [
                    'tenant_id' => $facility->tenant_id,
                    'name' => $item['name'],
                    'department_id' => $labDeptId,
                    'category' => $item['category'],
                    'unit' => $item['unit'],
                    'description' => $item['description'],
                    'status' => 'active',
                ],
            );
        }

        $this->command?->info('Seeded ' . count($items) . ' lab test clinical catalog items for DSK Dispensary.');
    }
}
