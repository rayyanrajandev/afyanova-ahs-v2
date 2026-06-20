#!/usr/bin/env python3
"""
Generate CSV for common Tanzania Dispensary-level theatre procedures.
Only basic procedures that a dispensary (lowest clinical facility) can perform.
"""

import csv

# Dispensary-level procedures only — basic, common, low-resource
procedures = [
    # ── Wound care ──
    ("THR-WOUND-REPAIR-001", "Wound repair / suturing", "minor",
     "Primary closure of laceration or surgical wound with sutures.",
     "minor", "local", 30, "yes"),

    ("THR-WOUND-DEBRIDE-001", "Wound debridement and dressing", "minor",
     "Cleaning, debridement of necrotic tissue, and dressing of wound.",
     "minor", "local", 30, "yes"),

    ("THR-INC-DRAIN-001", "Incision and drainage of abscess", "minor",
     "Incision and drainage of superficial abscess or boil.",
     "minor", "local", 30, "yes"),

    ("THR-SUTURE-REMOVE-001", "Suture removal", "minor",
     "Removal of surgical sutures or skin staples after wound healing.",
     "minor", "none", 10, "no"),

    # ── Minor surgery ──
    ("THR-CIRCUMCISION-001", "Male circumcision", "minor",
     "Surgical removal of foreskin. Common procedure in Tanzania.",
     "minor", "local", 45, "yes"),

    ("THR-LIPOMA-REMOVAL-001", "Lipoma / cyst excision", "minor",
     "Excision of subcutaneous lipoma or sebaceous cyst.",
     "minor", "local", 30, "yes"),

    ("THR-SKIN-BIOPSY-001", "Skin biopsy", "minor",
     "Punch or incisional skin biopsy for histopathology.",
     "minor", "local", 20, "yes"),

    ("THR-FORN-EXCISION-001", "Foreign body removal (soft tissue)", "minor",
     "Removal of foreign body (splinter, glass, metal) from soft tissue.",
     "minor", "local", 30, "yes"),

    ("THR-NAIL-REMOVAL-001", "Nail avulsion", "minor",
     "Removal of fingernail or toenail, with or without matrixectomy.",
     "minor", "local", 20, "yes"),

    # ── Dental ──
    ("THR-TOOTH-EXTRACT-001", "Simple tooth extraction", "dental",
     "Extraction of single tooth under local anaesthesia.",
     "dental", "local", 20, "no"),

    ("THR-DENTAL-ABSCESS-001", "Dental abscess drainage", "dental",
     "Incision and drainage of intraoral dental abscess.",
     "dental", "local", 20, "yes"),

    # ── ENT ──
    ("THR-FB-EAR-001", "Foreign body removal from ear", "ent",
     "Removal of foreign body from external ear canal.",
     "ent", "none", 10, "no"),

    ("THR-FB-NOSE-001", "Foreign body removal from nose", "ent",
     "Removal of nasal foreign body using probe or forceps.",
     "ent", "none", 10, "no"),

    ("THR-EPISTAXIS-001", "Epistaxis management (nasal packing)", "ent",
     "Anterior nasal packing for persistent nosebleed.",
     "ent", "local", 20, "no"),

    # ── Obstetric ──
    ("THR-PERINEAL-REPAIR-001", "Perineal tear / episiotomy repair", "obstetric",
     "Repair of perineal laceration or episiotomy after vaginal delivery.",
     "obstetric", "local", 30, "yes"),

    ("THR-MANUAL-PLACENTA-001", "Manual removal of retained placenta", "obstetric",
     "Manual removal of placenta when controlled cord traction fails.",
     "obstetric", "local", 20, "yes"),

    ("THR-POSTPARTUM-DNC-001", "Manual vacuum evacuation (postpartum)", "obstetric",
     "Evacuation of retained products of conception after delivery.",
     "obstetric", "local", 30, "yes"),

    # ── Emergency ──
    ("THR-CHEST-DRAIN-001", "Chest tube insertion (intercostal drain)", "emergency",
     "Insertion of intercostal chest drain for pneumothorax or haemothorax.",
     "emergency", "local", 30, "yes"),

    ("THR-LUMBAR-PUNCTURE-001", "Lumbar puncture", "emergency",
     "Diagnostic lumbar puncture for CSF analysis.",
     "emergency", "none", 20, "yes"),

    ("THR-CRICOTHYROID-001", "Emergency cricothyroidotomy", "emergency",
     "Emergency surgical airway when intubation fails.",
     "emergency", "none", 10, "yes"),

    # ── Orthopaedic ──
    ("THR-FRACTURE-REDUCE-001", "Closed fracture reduction and splinting", "orthopaedic",
     "Closed reduction of simple fracture with splint or cast application.",
     "orthopaedic", "sedation", 45, "yes"),

    ("THR-DISLOCATION-REDUCE-001", "Joint dislocation reduction", "orthopaedic",
     "Closed reduction of dislocated joint (shoulder, finger).",
     "orthopaedic", "sedation", 30, "no"),

    # ── Lines and access ──
    ("THR-IV-CANNULA-001", "Intravenous cannula insertion", "line",
     "Insertion of peripheral IV cannula for fluid or medication.",
     "line", "none", 10, "no"),

    ("THR-CATHETER-001", "Urinary catheterisation", "line",
     "Insertion of urinary catheter for retention or monitoring.",
     "line", "none", 10, "no"),

    # ── Basic ophthalmic ──
    ("THR-FB-EYE-001", "Corneal foreign body removal", "ophthalmic",
     "Removal of foreign body from cornea or conjunctiva.",
     "ophthalmic", "local", 15, "no"),

    ("THR-CHALAZION-001", "Chalazion incision", "ophthalmic",
     "Incision and drainage of chalazion (eyelid cyst).",
     "ophthalmic", "local", 20, "yes"),
]


def write_csv(filename, items):
    headers = [
        "code", "name", "category", "unit", "facility_tier", "department_code",
        "billing_service_code", "description", "status", "status_reason",
        "standard_local", "standard_loinc", "standard_snomed_ct",
        "standard_nhif", "standard_msd", "standard_cpt", "standard_icd",
        "procedure_class", "anesthesia_type", "expected_duration_minutes", "sterile_prep_required"
    ]

    with open(filename, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(headers)

        for proc in items:
            code, name, category, description, proc_class, anesthesia, duration, sterile = proc
            writer.writerow([
                code, name, category, "procedure", "dispensary",
                "THR", "", description, "active", "",
                "", "", "", "", "", "", "",
                proc_class, anesthesia, duration, sterile,
            ])

    print(f"Written {len(items)} rows to {filename}")


if __name__ == "__main__":
    import os
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "documents")
    os.makedirs(output_dir, exist_ok=True)

    main_file = os.path.join(output_dir, "dispensary_procedures_upload.csv")
    write_csv(main_file, procedures)

    print(f"File: {main_file}")
    print(f"Total: {len(procedures)} procedures")

    categories = {}
    for p in procedures:
        categories[p[2]] = categories.get(p[2], 0) + 1
    print("\n── Breakdown ──")
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count}")