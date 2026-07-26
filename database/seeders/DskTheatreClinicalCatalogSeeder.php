<?php

namespace Database\Seeders;

use App\Modules\Department\Infrastructure\Models\DepartmentModel;
use App\Modules\Platform\Infrastructure\Models\ClinicalCatalogItemModel;
use App\Modules\Platform\Infrastructure\Models\FacilityModel;
use Illuminate\Database\Seeder;

class DskTheatreClinicalCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $facility = FacilityModel::where('code', 'DSK')->first();

        if (!$facility) {
            $this->command?->error('DSK facility not found. Run InitialFacilitySeeder first.');
            return;
        }

        $deptId = DepartmentModel::where('facility_id', $facility->id)->where('code', 'OPD')->value('id');

        if (!$deptId) {
            $this->command?->error('OPD department not found for DSK. Run DskDepartmentsSeeder first.');
            return;
        }

        $items = [
            ['code' => 'THR-WOUND-REPAIR-001', 'name' => 'Wound repair / suturing', 'category' => 'minor', 'unit' => 'procedure', 'description' => 'Primary closure of laceration or surgical wound with sutures.'],
            ['code' => 'THR-WOUND-DEBRIDE-001', 'name' => 'Wound debridement and dressing', 'category' => 'minor', 'unit' => 'procedure', 'description' => 'Cleaning, debridement of necrotic tissue, and dressing of wound.'],
            ['code' => 'THR-INC-DRAIN-001', 'name' => 'Incision and drainage of abscess', 'category' => 'minor', 'unit' => 'procedure', 'description' => 'Incision and drainage of superficial abscess or boil.'],
            ['code' => 'THR-SUTURE-REMOVE-001', 'name' => 'Suture removal', 'category' => 'minor', 'unit' => 'procedure', 'description' => 'Removal of surgical sutures or skin staples after wound healing.'],
            ['code' => 'THR-CIRCUMCISION-001', 'name' => 'Male circumcision', 'category' => 'minor', 'unit' => 'procedure', 'description' => 'Surgical removal of foreskin. Common procedure in Tanzania.'],
            ['code' => 'THR-LIPOMA-REMOVAL-001', 'name' => 'Lipoma / cyst excision', 'category' => 'minor', 'unit' => 'procedure', 'description' => 'Excision of subcutaneous lipoma or sebaceous cyst.'],
            ['code' => 'THR-SKIN-BIOPSY-001', 'name' => 'Skin biopsy', 'category' => 'minor', 'unit' => 'procedure', 'description' => 'Punch or incisional skin biopsy for histopathology.'],
            ['code' => 'THR-FORN-EXCISION-001', 'name' => 'Foreign body removal (soft tissue)', 'category' => 'minor', 'unit' => 'procedure', 'description' => 'Removal of foreign body (splinter, glass, metal) from soft tissue.'],
            ['code' => 'THR-NAIL-REMOVAL-001', 'name' => 'Nail avulsion', 'category' => 'minor', 'unit' => 'procedure', 'description' => 'Removal of fingernail or toenail, with or without matrixectomy.'],
            ['code' => 'THR-TOOTH-EXTRACT-001', 'name' => 'Simple tooth extraction', 'category' => 'dental', 'unit' => 'procedure', 'description' => 'Extraction of single tooth under local anaesthesia.'],
            ['code' => 'THR-DENTAL-ABSCESS-001', 'name' => 'Dental abscess drainage', 'category' => 'dental', 'unit' => 'procedure', 'description' => 'Incision and drainage of intraoral dental abscess.'],
            ['code' => 'THR-FB-EAR-001', 'name' => 'Foreign body removal from ear', 'category' => 'ent', 'unit' => 'procedure', 'description' => 'Removal of foreign body from external ear canal.'],
            ['code' => 'THR-FB-NOSE-001', 'name' => 'Foreign body removal from nose', 'category' => 'ent', 'unit' => 'procedure', 'description' => 'Removal of nasal foreign body using probe or forceps.'],
            ['code' => 'THR-EPISTAXIS-001', 'name' => 'Epistaxis management (nasal packing)', 'category' => 'ent', 'unit' => 'procedure', 'description' => 'Anterior nasal packing for persistent nosebleed.'],
            ['code' => 'THR-PERINEAL-REPAIR-001', 'name' => 'Perineal tear / episiotomy repair', 'category' => 'obstetric', 'unit' => 'procedure', 'description' => 'Repair of perineal laceration or episiotomy after vaginal delivery.'],
            ['code' => 'THR-MANUAL-PLACENTA-001', 'name' => 'Manual removal of retained placenta', 'category' => 'obstetric', 'unit' => 'procedure', 'description' => 'Manual removal of placenta when controlled cord traction fails.'],
            ['code' => 'THR-POSTPARTUM-DNC-001', 'name' => 'Manual vacuum evacuation (postpartum)', 'category' => 'obstetric', 'unit' => 'procedure', 'description' => 'Evacuation of retained products of conception after delivery.'],
            ['code' => 'THR-CHEST-DRAIN-001', 'name' => 'Chest tube insertion (intercostal drain)', 'category' => 'emergency', 'unit' => 'procedure', 'description' => 'Insertion of intercostal chest drain for pneumothorax or haemothorax.'],
            ['code' => 'THR-LUMBAR-PUNCTURE-001', 'name' => 'Lumbar puncture', 'category' => 'emergency', 'unit' => 'procedure', 'description' => 'Diagnostic lumbar puncture for CSF analysis.'],
            ['code' => 'THR-CRICOTHYROID-001', 'name' => 'Emergency cricothyroidotomy', 'category' => 'emergency', 'unit' => 'procedure', 'description' => 'Emergency surgical airway when intubation fails.'],
            ['code' => 'THR-FRACTURE-REDUCE-001', 'name' => 'Closed fracture reduction and splinting', 'category' => 'orthopaedic', 'unit' => 'procedure', 'description' => 'Closed reduction of simple fracture with splint or cast application.'],
            ['code' => 'THR-DISLOCATION-REDUCE-001', 'name' => 'Joint dislocation reduction', 'category' => 'orthopaedic', 'unit' => 'procedure', 'description' => 'Closed reduction of dislocated joint (shoulder, finger).'],
            ['code' => 'THR-IV-CANNULA-001', 'name' => 'Intravenous cannula insertion', 'category' => 'line', 'unit' => 'procedure', 'description' => 'Insertion of peripheral IV cannula for fluid or medication.'],
            ['code' => 'THR-CATHETER-001', 'name' => 'Urinary catheterisation', 'category' => 'line', 'unit' => 'procedure', 'description' => 'Insertion of urinary catheter for retention or monitoring.'],
            ['code' => 'THR-FB-EYE-001', 'name' => 'Corneal foreign body removal', 'category' => 'ophthalmic', 'unit' => 'procedure', 'description' => 'Removal of foreign body from cornea or conjunctiva.'],
            ['code' => 'THR-CHALAZION-001', 'name' => 'Chalazion incision', 'category' => 'ophthalmic', 'unit' => 'procedure', 'description' => 'Incision and drainage of chalazion (eyelid cyst).'],
        ];

        foreach ($items as $item) {
            ClinicalCatalogItemModel::firstOrCreate(
                [
                    'facility_id' => $facility->id,
                    'catalog_type' => 'theatre_procedure',
                    'code' => $item['code'],
                ],
                [
                    'tenant_id' => $facility->tenant_id,
                    'name' => $item['name'],
                    'department_id' => $deptId,
                    'category' => $item['category'],
                    'unit' => $item['unit'],
                    'description' => $item['description'],
                    'status' => 'active',
                ],
            );
        }

        $this->command?->info('Seeded ' . count($items) . ' theatre procedure catalog items for DSK Dispensary.');
    }
}
