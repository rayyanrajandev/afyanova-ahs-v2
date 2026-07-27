# Consumption Recipes — Blueprint

Each catalog item can define which store items are consumed when the service
is performed. When the order is marked `completed`, the system auto-deducts
the mapped quantities from inventory (FEFO-aware, batch-tracked).

---

## Lab Tests (16 items)

All lab tests share common collection consumables plus test-specific reagents.

### Common collection supplies (per specimen)

| Store Item | Qty | Stage |
|---|---|---|
| Examination glove (pair) | 1 | sample_collection |
| Cotton wool swab | 1 | sample_collection |
| Surgical spirit / alcohol prep | 1 | sample_collection |
| Sharps container use allocation | 1 | processing |

### Per-test breakdown

| Code | Name | Specific Consumables | Qty | Unit | Stage |
|---|---|---|---|---|---|
| LAB-MRDT-001 | Malaria RDT | Malaria RDT kit | 1 | test | processing |
| | | Lancets | 1 | each | sample_collection |
| | | EDTA capillary tube | 1 | each | sample_collection |
| LAB-HIV-001 | HIV Test | HIV rapid test kit | 1 | test | processing |
| | | EDTA capillary tube | 1 | each | sample_collection |
| LAB-HPYLORI-001 | H. pylori Antibody | H. pylori rapid test kit | 1 | test | processing |
| | | EDTA capillary tube | 1 | each | sample_collection |
| LAB-VDRL-001 | Syphilis (VDRL) | VDRL antigen reagent | 1 | ml | processing |
| | | Serum separator tube | 1 | each | sample_collection |
| | | Vacutainer needle | 1 | each | sample_collection |
| LAB-HB-001 | Hemoglobin (Hb) | Hb reagent / cuvette | 1 | test | processing |
| | | EDTA capillary tube | 1 | each | sample_collection |
| | | Lancets | 1 | each | sample_collection |
| LAB-RBG-001 | Blood Sugar (RBG) | Glucose test strip | 1 | each | processing |
| | | Lancets | 1 | each | sample_collection |
| LAB-ABO-001 | Blood Group & Rh | Anti-A, Anti-B, Anti-D sera | 1 | set | processing |
| | | EDTA tube | 1 | each | sample_collection |
| | | Vacutainer needle | 1 | each | sample_collection |
| LAB-URINE-001 | Urinalysis | Urine dipstick | 1 | each | processing |
| | | Urine collection cup | 1 | each | sample_collection |
| LAB-STOOL-001 | Stool Analysis | Stool collection container | 1 | each | sample_collection |
| | | Wooden spatula / applicator | 1 | each | sample_collection |
| | | Glass slide | 1 | each | processing |
| | | Normal saline (for wet mount) | 1 | ml | processing |
| LAB-ESR-001 | ESR | ESR tube (citrated) | 1 | each | sample_collection |
| | | ESR rack/stand allocation | 1 | each | processing |
| | | Vacutainer needle | 1 | each | sample_collection |
| LAB-HVS-001 | High Vaginal Swab | Sterile vaginal swab | 1 | each | sample_collection |
| | | Glass slide | 1 | each | processing |
| | | Normal saline | 1 | ml | processing |
| | | KOH 10% solution | 1 | ml | processing |
| | | Examination glove (pair) | 1 | pair | sample_collection |
| LAB-UPT-001 | Urine Pregnancy | UPT cassette / strip | 1 | each | processing |
| | | Urine collection cup | 1 | each | sample_collection |
| LAB-HBSAG-001 | Hepatitis B (HBsAg) | HBsAg rapid test kit | 1 | test | processing |
| | | Serum separator tube | 1 | each | sample_collection |
| | | Vacutainer needle | 1 | each | sample_collection |
| LAB-WIDAL-001 | Widal Test | Widal antigen suspension | 1 | set | processing |
| | | Serum separator tube | 1 | each | sample_collection |
| | | Vacutainer needle | 1 | each | sample_collection |
| LAB-CHO-001 | Lipid Profile | Lipid panel reagent | 1 | test | processing |
| | | Serum separator tube | 1 | each | sample_collection |
| | | Vacutainer needle | 1 | each | sample_collection |
| LAB-URA-001 | Renal Function | Creatinine / Uric acid reagent | 1 | test | processing |
| | | Serum separator tube | 1 | each | sample_collection |
| | | Vacutainer needle | 1 | each | sample_collection |

---

## Radiology Procedures (2 items)

| Code | Name | Consumables | Qty | Unit | Stage |
|---|---|---|---|---|---|
| RAD-US-ABD-001 | Abdominal Ultrasound | Ultrasound gel | 5 | ml | processing |
| | | Probe cover / condom | 1 | each | processing |
| | | Examination glove (pair) | 1 | pair | processing |
| | | Paper towel / wipe | 2 | each | processing |
| RAD-US-PEL-001 | Pelvic Ultrasound | Ultrasound gel | 5 | ml | processing |
| | | Probe cover / condom | 1 | each | processing |
| | | Examination glove (pair) | 1 | pair | processing |
| | | Paper towel / wipe | 2 | each | processing |

---

## Clinical Procedures (25 items)

### Wound care (4 items)

| Code | Name | Consumables | Qty | Unit | Stage |
|---|---|---|---|---|---|
| CLN-WOUND-CLEAN-001 | Wound cleaning | Sterile gauze (4x4) | 2 | each | procedure_completion |
| | | Normal saline 100 ml | 50 | ml | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| | | Cotton wool | 2 | each | procedure_completion |
| | | Povidone iodine 10% | 5 | ml | procedure_completion |
| CLN-WOUND-DRESS-001 | Wound dressing | Sterile gauze (4x4) | 2 | each | procedure_completion |
| | | Adhesive tape / plaster | 1 | strip | procedure_completion |
| | | Normal saline 100 ml | 50 | ml | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| | | Povidone iodine 10% | 5 | ml | procedure_completion |
| CLN-BURN-DRESS-001 | Burn dressing | Sterile gauze (4x4) | 4 | each | procedure_completion |
| | | Silver sulfadiazine cream | 5 | g | procedure_completion |
| | | Sterile bandage | 1 | each | procedure_completion |
| | | Normal saline 100 ml | 100 | ml | procedure_completion |
| | | Sterile glove (pair) | 1 | pair | procedure_completion |
| CLN-WOUND-DEBRIDE-001 | Minor wound debridement | Sterile gauze (4x4) | 4 | each | procedure_completion |
| | | Normal saline 100 ml | 100 | ml | procedure_completion |
| | | Scalpel blade #15 | 1 | each | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| | | Povidone iodine 10% | 5 | ml | procedure_completion |
| | | Lidocaine 1% injection | 2 | ml | procedure_completion |

### Minor surgical (6 items)

| Code | Name | Consumables | Qty | Unit | Stage |
|---|---|---|---|---|---|
| CLN-SUTURE-001 | Suturing lacerations | Suture (silk 3-0) | 1 | each | procedure_completion |
| | | Sterile gauze (4x4) | 2 | each | procedure_completion |
| | | Lidocaine 1% injection | 2 | ml | procedure_completion |
| | | Syringe 5 ml | 1 | each | procedure_completion |
| | | Needle (23G) | 1 | each | procedure_completion |
| | | Povidone iodine 10% | 5 | ml | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| CLN-SUTURE-REMOVE-001 | Suture removal | Suture removal kit | 1 | each | procedure_completion |
| | | Sterile gauze | 1 | each | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| CLN-INC-DRAIN-001 | I&D abscess | Scalpel blade #11 | 1 | each | procedure_completion |
| | | Sterile gauze (4x4) | 4 | each | procedure_completion |
| | | Lidocaine 1% injection | 3 | ml | procedure_completion |
| | | Syringe 5 ml | 1 | each | procedure_completion |
| | | Needle (21G) | 1 | each | procedure_completion |
| | | Povidone iodine 10% | 5 | ml | procedure_completion |
| | | Sterile glove (pair) | 1 | pair | procedure_completion |
| | | Drain tube / wick | 1 | each | procedure_completion |
| CLN-PARONYCHIA-001 | I&D paronychia | Scalpel blade #11 | 1 | each | procedure_completion |
| | | Sterile gauze (4x4) | 2 | each | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| | | Povidone iodine 10% | 5 | ml | procedure_completion |
| CLN-FB-REMOVAL-001 | Remove foreign body | Sterile gauze (4x4) | 2 | each | procedure_completion |
| | | Lidocaine 1% injection | 1 | ml | procedure_completion |
| | | Syringe 2 ml | 1 | each | procedure_completion |
| | | Needle (23G) | 1 | each | procedure_completion |
| | | Povidone iodine 10% | 5 | ml | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| CLN-MVA-001 | Manual vacuum aspiration | MVA syringe | 1 | each | procedure_completion |
| | | MVA cannula (suitable size) | 1 | each | procedure_completion |
| | | Speculum (disposable) | 1 | each | procedure_completion |
| | | Sterile glove (pair) | 1 | pair | procedure_completion |
| | | Povidone iodine 10% | 10 | ml | procedure_completion |
| | | Sterile gauze (4x4) | 4 | each | procedure_completion |
| | | Lidocaine 1% injection | 5 | ml | procedure_completion |
| | | Syringe 10 ml | 1 | each | procedure_completion |
| | | Needle (21G) | 1 | each | procedure_completion |

### Injections (4 items)

| Code | Name | Consumables | Qty | Unit | Stage |
|---|---|---|---|---|---|
| CLN-INJECTION-IM-001 | IM injection | Syringe 2 ml | 1 | each | procedure_completion |
| | | Needle (23G) | 1 | each | procedure_completion |
| | | Cotton wool swab | 1 | each | procedure_completion |
| | | Surgical spirit / alcohol prep | 1 | each | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| CLN-INJECTION-IV-001 | IV injection | Syringe 5 ml | 1 | each | procedure_completion |
| | | Needle (21G) | 1 | each | procedure_completion |
| | | Cotton wool swab | 1 | each | procedure_completion |
| | | Surgical spirit / alcohol prep | 1 | each | procedure_completion |
| | | Tourniquet | 1 | each | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| CLN-INJECTION-SC-001 | SC injection | Syringe 1 ml (insulin) | 1 | each | procedure_completion |
| | | Needle (26G) | 1 | each | procedure_completion |
| | | Cotton wool swab | 1 | each | procedure_completion |
| | | Surgical spirit / alcohol prep | 1 | each | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| CLN-INJECTION-ID-001 | Intradermal injection | Syringe 1 ml (tuberculin) | 1 | each | procedure_completion |
| | | Needle (26G) | 1 | each | procedure_completion |
| | | Cotton wool swab | 1 | each | procedure_completion |
| | | Surgical spirit / alcohol prep | 1 | each | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |

### IV therapy (2 items)

| Code | Name | Consumables | Qty | Unit | Stage |
|---|---|---|---|---|---|
| CLN-IV-CANNULA-001 | IV cannulation | IV cannula (suitable gauge) | 1 | each | procedure_completion |
| | | Transparent dressing | 1 | each | procedure_completion |
| | | Tourniquet | 1 | each | procedure_completion |
| | | Cotton wool swab | 1 | each | procedure_completion |
| | | Surgical spirit / alcohol prep | 1 | each | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| | | Normal saline 10 ml flush syringe | 1 | each | procedure_completion |
| CLN-IV-FLUID-001 | IV fluid admin | IV giving set | 1 | each | procedure_completion |
| | | IV cannula (if new line) | 1 | each | procedure_completion |
| | | Transparent dressing | 1 | each | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| | | Normal saline 10 ml flush syringe | 1 | each | procedure_completion |

### Emergency (2 items)

| Code | Name | Consumables | Qty | Unit | Stage |
|---|---|---|---|---|---|
| CLN-BLOOD-TRANSFUSION-001 | Blood transfusion | Blood giving set | 1 | each | procedure_completion |
| | | IV cannula (18G or 20G) | 1 | each | procedure_completion |
| | | Transparent dressing | 1 | each | procedure_completion |
| | | Normal saline 10 ml flush | 1 | each | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| CLN-EMERG-MED-001 | Emergency med admin | Syringe 5 ml | 1 | each | procedure_completion |
| | | Needle (21G) | 1 | each | procedure_completion |
| | | Cotton wool swab | 1 | each | procedure_completion |
| | | Surgical spirit | 1 | each | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| CLN-PATIENT-STABILIZE-001 | Patient stabilization | Oxygen mask (if applicable) | 1 | each | procedure_completion |
| | | IV cannula | 1 | each | procedure_completion |
| | | IV giving set | 1 | each | procedure_completion |
| | | Examination glove (pair) | 2 | pair | procedure_completion |

### Family planning (2 items)

| Code | Name | Consumables | Qty | Unit | Stage |
|---|---|---|---|---|---|
| CLN-IMPLANT-INSERT-001 | Implant insertion | Implant rod (e.g. Implanon) | 1 | each | procedure_completion |
| | | Lidocaine 1% injection | 2 | ml | procedure_completion |
| | | Syringe 2 ml | 1 | each | procedure_completion |
| | | Needle (23G) | 1 | each | procedure_completion |
| | | Sterile gauze (4x4) | 2 | each | procedure_completion |
| | | Povidone iodine 10% | 5 | ml | procedure_completion |
| | | Sterile glove (pair) | 1 | pair | procedure_completion |
| | | Adhesive dressing / bandage | 1 | each | procedure_completion |
| CLN-IMPLANT-REMOVE-001 | Implant removal | Scalpel blade #11 | 1 | each | procedure_completion |
| | | Lidocaine 1% injection | 2 | ml | procedure_completion |
| | | Syringe 2 ml | 1 | each | procedure_completion |
| | | Needle (23G) | 1 | each | procedure_completion |
| | | Sterile gauze (4x4) | 2 | each | procedure_completion |
| | | Povidone iodine 10% | 5 | ml | procedure_completion |
| | | Sterile glove (pair) | 1 | pair | procedure_completion |
| | | Adhesive dressing / bandage | 1 | each | procedure_completion |

### Nursing follow-up (3 items)

| Code | Name | Consumables | Qty | Unit | Stage |
|---|---|---|---|---|---|
| CLN-HTN-FOLLOWUP-001 | Hypertension follow-up | Examination glove (pair) | 1 | pair | procedure_completion |
| | | Cotton wool swab | 1 | each | procedure_completion |
| CLN-DM-FOLLOWUP-001 | Diabetes follow-up | Glucose test strip | 1 | each | procedure_completion |
| | | Lancet | 1 | each | procedure_completion |
| | | Cotton wool swab | 1 | each | procedure_completion |
| | | Surgical spirit / alcohol prep | 1 | each | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |
| CLN-ASTHMA-NEB-001 | Asthma nebulisation | Nebulisation mask kit | 1 | each | procedure_completion |
| | | Salbutamol nebule (2.5 mg) | 1 | each | procedure_completion |
| | | Normal saline 5 ml (diluent) | 3 | ml | procedure_completion |
| | | Examination glove (pair) | 1 | pair | procedure_completion |

### Administrative (1 item)

| Code | Name | Consumables | Qty | Unit | Stage |
|---|---|---|---|---|---|
| CLN-REFERRAL-001 | Referral documentation | *(none — paper/stationery managed outside stock control)* | | | |

---

## Implementation Notes

1. **Inventory items must exist first** in Inventory & Procurement with
   matching categories (`laboratory`, `medical_consumable`, `radiology`,
   `ppe`, etc.) before consumables can be mapped.

2. **Quantities are per service** — if a test uses 2 ml of reagent,
   the inventory item's unit should be `ml` (or the facility maps a
   "Reagent A" stocked as a kit with `quantity_per_order = 1`).

3. **Consumption stages** match the enum:
   - `per_order` — deducted when service is ordered
   - `sample_collection` — at sample collection
   - `processing` — during processing
   - `result_release` — when result is released
   - `procedure_completion` — when procedure is completed

4. **Waste factor** can be added (e.g. 10% for liquids where some
   volume is lost in tubing/droppers).

5. **Sharps container allocation** — facilities typically allocate a
   portion of a sharps container cost to each procedure rather than
   tracking each container use. This can be modelled as a fractional
   quantity (e.g. 0.01 "sharps container" unit per injection).
