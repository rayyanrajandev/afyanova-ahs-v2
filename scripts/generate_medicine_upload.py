#!/usr/bin/env python3
"""
Generate an Excel-ready CSV upload file for Clinical Catalog Formulary Items.
Based on the MEDICINE.pdf inventory list for Tanzania facility.
Fixes spelling errors, assigns proper therapeutic classes, dosage forms,
routes, and dispensing units from the Clinical Catalog option sets.
"""

import csv
import re

# ── Medicine data: (code, name, strength, category, unit, dosage_form, route, pack_size, otc_allowed, description) ──
# Categories match therapeuticClassOptions values
# Dosage forms match dosageFormOptions values
# Routes match routeOfAdministrationOptions values
# Units match dispensingUnitOptions values

medicines = [
    # ═══════════════════════════════════════════════════════════════════
    # CAPSULES
    # ═══════════════════════════════════════════════════════════════════
    ("MED-AMOX-250CAP", "Amoxicillin 250 mg capsule", "250 mg", "antibiotics", "capsule", "capsule", "oral", "100 capsules", "yes",
     "Broad-spectrum penicillin antibiotic for respiratory, urinary, and ENT infections."),
    ("MED-AMPCLOX-500CAP", "Ampicillin + Cloxacillin 500 mg capsule", "500 mg", "antibiotics", "capsule", "capsule", "oral", "100 capsules", "yes",
     "Combined penicillin antibiotic for skin, soft tissue, and respiratory infections."),
    ("MED-CEFAD-500CAP", "Cefadroxil 500 mg capsule", "500 mg", "antibiotics", "capsule", "capsule", "oral", "100 capsules", "yes",
     "First-generation cephalosporin for skin, urinary tract, and respiratory infections."),
    ("MED-CEPH-250CAP", "Cephalexin 250 mg capsule", "250 mg", "antibiotics", "capsule", "capsule", "oral", "100 capsules", "yes",
     "First-generation cephalosporin for bacterial infections of skin, bone, and respiratory tract."),
    ("MED-DOXY-100CAP", "Doxycycline 100 mg capsule", "100 mg", "antibiotics", "capsule", "capsule", "oral", "100 capsules", "yes",
     "Tetracycline antibiotic for malaria prophylaxis, respiratory, and sexually transmitted infections."),
    ("MED-FERR-162CAP", "Ferrotone 162 mg capsule", "162 mg", "haematological", "capsule", "capsule", "oral", "100 capsules", "yes",
     "Iron supplement capsule for prevention and treatment of iron-deficiency anaemia."),
    ("MED-OMPZ-20CAP", "Omeprazole 20 mg capsule", "20 mg", "gastrointestinal", "capsule", "capsule", "oral", "30 capsules", "yes",
     "Proton pump inhibitor for gastric ulcer, GERD, and H. pylori eradication."),
    ("MED-PREG-75CAP", "Pregabalin 75 mg capsule", "75 mg", "neurological", "capsule", "capsule", "oral", "30 capsules", "no",
     "Anticonvulsant and neuropathic pain agent for diabetic neuropathy and post-herpetic neuralgia."),
    ("MED-PIROX-20CAP", "Piroxicam 20 mg capsule", "20 mg", "anti_inflammatory", "capsule", "capsule", "oral", "30 capsules", "yes",
     "Non-steroidal anti-inflammatory drug (NSAID) for pain and inflammation."),
    ("MED-TRAM-50CAP", "Tramadol 50 mg capsule", "50 mg", "analgesics_antipyretics", "capsule", "capsule", "oral", "100 capsules", "no",
     "Opioid analgesic for moderate to severe pain management."),
    ("MED-TAMS-04CAP", "Tamsulosin 0.4 mg capsule", "0.4 mg", "urological_genitourinary", "capsule", "capsule", "oral", "30 capsules", "no",
     "Alpha-1 blocker for benign prostatic hyperplasia (BPH) symptom relief."),
    ("MED-MISO-200TAB", "Misoprostol 200 mcg tablet", "200 mcg", "hormones_contraceptives", "tablet", "tablet", "oral", "100 tablets", "no",
     "Prostaglandin analogue for prevention of NSAID-induced gastric ulcer, and obstetric use."),
    ("MED-LOPER-5CAP", "Loperamide 5 mg capsule", "5 mg", "gastrointestinal", "capsule", "capsule", "oral", "100 capsules", "yes",
     "Antidiarrhoeal agent for symptomatic relief of acute diarrhoea."),

    # ═══════════════════════════════════════════════════════════════════
    # CREAMS / OINTMENTS / GELS
    # ═══════════════════════════════════════════════════════════════════
    ("MED-ACICV-10CREAM", "Aciclovir 5% cream 10 g", "5%", "antivirals", "tube", "cream", "topical", "10 g", "yes",
     "Antiviral cream for treatment of herpes simplex and varicella-zoster skin infections."),
    ("MED-BURN-30CREAM", "Burnox 30 g cream", "", "dermatological", "tube", "cream", "topical", "30 g", "yes",
     "Topical burn care cream for minor burns and wound healing."),
    ("MED-CLTR-15CREAM", "Clotrimazole 1% cream 15 g", "1%", "antifungals", "tube", "cream", "topical", "15 g", "yes",
     "Azole antifungal cream for dermatophyte and Candida skin infections."),
    ("MED-CLOB-10CREAM", "Clobetasol propionate 0.05% cream 10 g", "0.05%", "anti_inflammatory", "tube", "cream", "topical", "10 g", "no",
     "Potent topical corticosteroid for inflammatory dermatoses and eczema."),
    ("MED-DICLO-20GEL", "Diclofenac 1% gel 20 g", "1%", "anti_inflammatory", "tube", "gel", "topical", "20 g", "yes",
     "Topical NSAID gel for局部 pain, inflammation, and joint conditions."),
    ("MED-GENTR-10CREAM", "Gentrisone 10 g cream", "", "anti_inflammatory", "tube", "cream", "topical", "10 g", "no",
     "Combined betamethasone and gentamicin cream for infected inflammatory skin conditions."),
    ("MED-HYDC-15CREAM", "Hydrocortisone 1% cream 15 g", "1%", "anti_inflammatory", "tube", "cream", "topical", "15 g", "yes",
     "Mild topical corticosteroid for eczema, dermatitis, and allergic skin reactions."),
    ("MED-KETO-30CREAM", "Ketoconazole 2% cream 30 g", "2%", "antifungals", "tube", "cream", "topical", "30 g", "yes",
     "Azole antifungal cream for seborrhoeic dermatitis, tinea, and cutaneous candidiasis."),
    ("MED-MUPI-10OINT", "Mupirocin 2% ointment 10 g", "2%", "antibiotics", "tube", "ointment", "topical", "10 g", "no",
     "Topical antibiotic ointment for impetigo and secondary skin infections."),
    ("MED-SKDERM-30CREAM", "SK Derm 30 g cream", "", "anti_inflammatory", "tube", "cream", "topical", "30 g", "no",
     "Combined clotrimazole and betamethasone cream for infected eczema and dermatophytosis."),
    ("MED-SILVEX-10CREAM", "Silver sulfadiazine + chlorhexidine (Silverex) 10 g", "1%", "antibiotics", "tube", "cream", "topical", "10 g", "no",
     "Topical antimicrobial cream for prevention and treatment of burn wound infections."),
    ("MED-TETRA-15OINT", "Tetracycline 1% ointment 15 g", "1%", "antibiotics", "tube", "ointment", "topical", "15 g", "yes",
     "Topical tetracycline antibiotic for superficial eye and skin infections."),
    ("MED-WHFL-20OINT", "Whitfield's ointment 20 g", "", "antifungals", "tube", "ointment", "topical", "20 g", "yes",
     "Salicylic acid and benzoic acid ointment for fungal skin infections (tinea)."),
    ("MED-BPO-20GEL", "Benzoyl peroxide 5% gel (Persone) 20 g", "5%", "dermatological", "tube", "gel", "topical", "20 g", "yes",
     "Topical agent for mild to moderate acne vulgaris."),
    ("MED-BETBZ-30CREAM", "Betamethasone benzoate 0.1% cream 30 g", "0.1%", "anti_inflammatory", "tube", "cream", "topical", "30 g", "no",
     "Topical corticosteroid for inflammatory and pruritic skin conditions."),

    # ═══════════════════════════════════════════════════════════════════
    # EYE DROPS / EAR DROPS / NASAL DROPS
    # ═══════════════════════════════════════════════════════════════════
    ("MED-CIPRO-EYEDROP", "Ciprofloxacin 0.3% eye drops 10 ml", "0.3%", "antibiotics", "each", "eye drops", "ophthalmic", "10 ml", "no",
     "Fluoroquinolone antibiotic eye drops for bacterial conjunctivitis and eye infections."),
    ("MED-NASAL-ADULT", "Nasal decongestant drops (adult) 15 ml", "", "respiratory", "each", "nasal drops", "intranasal", "15 ml", "yes",
     "Imidazoline-based nasal decongestant drops for nasal congestion in adults."),
    ("MED-NASAL-PAED", "Nasal decongestant drops (paediatric) 15 ml", "", "respiratory", "each", "nasal drops", "intranasal", "15 ml", "yes",
     "Gentle nasal decongestant drops for nasal congestion in children."),
    ("MED-GENT-EYEDROP", "Gentamicin 0.3% eye drops 10 ml", "0.3%", "antibiotics", "each", "eye drops", "ophthalmic", "10 ml", "no",
     "Aminoglycoside antibiotic eye drops for external eye infections."),
    ("MED-BORIC-EARDROP", "Boric acid ear drops 15 ml", "", "otological", "each", "ear drops", "otical", "15 ml", "yes",
     "Antiseptic ear drops for chronic otitis externa and ear canal infections."),
    ("MED-CHLOR-EYEINT", "Chloramphenicol eye ointment", "1%", "antibiotics", "tube", "ointment", "ophthalmic", "5 g", "no",
     "Broad-spectrum antibiotic eye ointment for bacterial conjunctivitis and eye infections."),
    ("MED-DEXNEO-EYEDROP", "Dexamethasone + Neomycin (Dexaneomycin) eye drops 10 ml", "", "anti_inflammatory", "each", "eye drops", "ophthalmic", "10 ml", "no",
     "Combined corticosteroid and antibiotic eye drops for inflammatory eye conditions with infection."),
    ("MED-DEXP-EYEDROP", "Dexamethasone sodium phosphate eye drops 0.1%", "0.1%", "anti_inflammatory", "each", "eye drops", "ophthalmic", "5 ml", "no",
     "Corticosteroid eye drops for non-infective inflammatory eye conditions."),
    ("MED-CHLOR-EYEDROP", "Chloramphenicol eye drops 0.5% 5 ml", "0.5%", "antibiotics", "each", "eye drops", "ophthalmic", "5 ml", "no",
     "Broad-spectrum antibiotic eye drops for bacterial conjunctivitis."),

    # ═══════════════════════════════════════════════════════════════════
    # IV FLUIDS (Solutions for infusion)
    # ═══════════════════════════════════════════════════════════════════
    ("MED-CIPRO-IV100", "Ciprofloxacin 200 mg/100 ml IV infusion", "200 mg", "antibiotics", "each", "solution", "intravenous", "100 ml", "no",
     "Fluoroquinolone antibiotic IV infusion for severe bacterial infections."),
    ("MED-D5-IV500", "Dextrose 5% 500 ml IV infusion", "5%", "nutritional", "each", "solution", "intravenous", "500 ml", "no",
     "Isotonic glucose solution for fluid replacement and calorie provision."),
    ("MED-DNS-IV500", "Dextrose Normal Saline 500 ml IV infusion", "", "nutritional", "each", "solution", "intravenous", "500 ml", "no",
     "Combined dextrose and sodium chloride solution for fluid and electrolyte replacement."),
    ("MED-FLUC-IV100", "Fluconazole 200 mg/100 ml IV infusion", "200 mg", "antifungals", "each", "solution", "intravenous", "100 ml", "no",
     "Antifungal IV infusion for systemic candidiasis and cryptococcal meningitis."),
    ("MED-METRO-IV100", "Metronidazole 500 mg/100 ml IV infusion", "500 mg", "antiprotozoals", "each", "solution", "intravenous", "100 ml", "no",
     "Antiprotozoal and anaerobic antibacterial IV infusion for serious infections."),
    ("MED-NS-IV500", "Normal Saline 0.9% 500 ml IV infusion", "0.9%", "nutritional", "each", "solution", "intravenous", "500 ml", "no",
     "Isotonic sodium chloride solution for fluid and electrolyte replacement."),
    ("MED-RL-IV500", "Ringer's Lactate 500 ml IV infusion", "", "nutritional", "each", "solution", "intravenous", "500 ml", "no",
     "Crystalloid solution for fluid resuscitation and electrolyte replacement."),
    ("MED-SALB-NEB25", "Salbutamol 2.5 mg nebulisation solution", "2.5 mg", "respiratory", "each", "solution", "inhalation", "2.5 ml", "no",
     "Short-acting beta-2 agonist solution for nebulisation in acute asthma and bronchospasm."),
    ("MED-PARA-IV100", "Paracetamol 1 g/100 ml IV infusion", "1 g", "analgesics_antipyretics", "each", "solution", "intravenous", "100 ml", "no",
     "IV paracetamol for pain and fever when oral route is not suitable."),

    # ═══════════════════════════════════════════════════════════════════
    # INJECTIONS (Ampoules and Vials)
    # ═══════════════════════════════════════════════════════════════════
    ("MED-ADREN-1ML", "Adrenaline (Epinephrine) 1 mg/ml injection 1 ml", "1 mg", "cardiovascular", "ampoule", "injection", "intravenous", "1 ml", "no",
     "Sympathomimetic amine for cardiac arrest, anaphylaxis, and severe asthma."),
    ("MED-AMINO-250IV", "Aminophylline 250 mg/10 ml injection", "250 mg", "respiratory", "ampoule", "injection", "intravenous", "10 ml", "no",
     "Xanthine bronchodilator for acute severe asthma and bronchospasm."),
    ("MED-AMPIC-250IV", "Ampicillin 250 mg injection", "250 mg", "antibiotics", "vial", "injection", "intramuscular", "1 vial", "no",
     "Aminopenicillin antibiotic for respiratory, urinary, and meningococcal infections."),
    ("MED-AMPCLOX-500IV", "Ampicillin + Cloxacillin 500 mg injection", "500 mg", "antibiotics", "vial", "injection", "intramuscular", "1 vial", "no",
     "Combined penicillin injection for severe skin, soft tissue, and respiratory infections."),
    ("MED-AMOCL-12IV", "Amoxicillin + Clavulanate (Amox-Clav) 1.2 g injection", "1.2 g", "antibiotics", "vial", "injection", "intravenous", "1 vial", "no",
     "Beta-lactamase inhibitor combination for severe infections unresponsive to amoxicillin alone."),
    ("MED-ARTE-80IM", "Artemether 80 mg/ml injection 1 ml", "80 mg", "antimalarials", "ampoule", "injection", "intramuscular", "1 ml", "no",
     "Artemisinin derivative for treatment of severe falciparum malaria."),
    ("MED-ARTSN-60IV", "Artesunate 60 mg injection (IV/IM)", "60 mg", "antimalarials", "vial", "injection", "intravenous", "1 vial", "no",
     "Water-soluble artemisinin for treatment of severe and complicated malaria."),
    ("MED-ARTSN-120IV", "Artesunate 120 mg injection (IV/IM)", "120 mg", "antimalarials", "vial", "injection", "intravenous", "1 vial", "no",
     "Water-soluble artemisinin for treatment of severe and complicated malaria."),
    ("MED-ATROP-1IV", "Atropine sulfate 1 mg/ml injection 1 ml", "1 mg", "cardiovascular", "ampoule", "injection", "intravenous", "1 ml", "no",
     "Anticholinergic for bradycardia, organophosphate poisoning, and pre-anaesthesia."),
    ("MED-CEFOT-12IV", "Cefotaxime 1.2 g injection", "1.2 g", "antibiotics", "vial", "injection", "intravenous", "1 vial", "no",
     "Third-generation cephalosporin for meningitis, septicaemia, and severe bacterial infections."),
    ("MED-CEFTR-1IV", "Ceftriaxone 1 g injection", "1 g", "antibiotics", "vial", "injection", "intravenous", "1 vial", "no",
     "Third-generation cephalosporin for meningitis, pneumonia, and septicaemia."),
    ("MED-DEXAM-4IV", "Dexamethasone sodium phosphate 4 mg injection", "4 mg", "anti_inflammatory", "ampoule", "injection", "intravenous", "1 ml", "no",
     "Corticosteroid injection for cerebral oedema, severe allergic reactions, and inflammation."),
    ("MED-DIAZ-10IV", "Diazepam 10 mg/2 ml injection", "10 mg", "mental_health_psychiatric", "ampoule", "injection", "intravenous", "2 ml", "no",
     "Benzodiazepine for status epilepticus, severe anxiety, and muscle spasms."),
    ("MED-DICLO-3IM", "Diclofenac sodium 75 mg/3 ml injection", "75 mg", "anti_inflammatory", "ampoule", "injection", "intramuscular", "3 ml", "no",
     "NSAID injection for acute pain, renal colic, and musculoskeletal conditions."),
    ("MED-FURO-10IV", "Furosemide 10 mg/ml injection 2 ml", "20 mg", "cardiovascular", "ampoule", "injection", "intravenous", "2 ml", "no",
     "Loop diuretic for acute pulmonary oedema, heart failure, and fluid overload."),
    ("MED-GENT-40IM", "Gentamicin 40 mg/ml injection 2 ml", "40 mg", "antibiotics", "ampoule", "injection", "intramuscular", "2 ml", "no",
     "Aminoglycoside antibiotic for serious gram-negative infections."),
    ("MED-HYDC-100IV", "Hydrocortisone 100 mg injection", "100 mg", "anti_inflammatory", "vial", "injection", "intravenous", "1 vial", "no",
     "Corticosteroid for adrenal crisis, severe allergic reactions, and acute asthma."),
    ("MED-HYOSC-10IV", "Hyoscine butylbromide 20 mg/5 ml injection", "20 mg", "gastrointestinal", "ampoule", "injection", "intravenous", "5 ml", "no",
     "Antispasmodic for acute abdominal cramps and renal/ biliary colic."),
    ("MED-METOC-2IV", "Metoclopramide hydrochloride 10 mg/2 ml injection", "10 mg", "gastrointestinal", "ampoule", "injection", "intravenous", "2 ml", "no",
     "Antiemetic and prokinetic for nausea, vomiting, and gastroparesis."),
    ("MED-MEDRO-150IM", "Medroxyprogesterone acetate 150 mg/ml injection", "150 mg", "hormones_contraceptives", "vial", "injection", "intramuscular", "1 ml", "no",
     "Depot progestogen contraceptive injection for long-acting reversible contraception."),
    ("MED-PANTO-40IV", "Pantoprazole 40 mg injection", "40 mg", "gastrointestinal", "vial", "injection", "intravenous", "1 vial", "no",
     "Proton pump inhibitor IV for stress ulcer prophylaxis and acute GI bleeding."),
    ("MED-PROM-2IM", "Promethazine hydrochloride 25 mg/ml injection 2 ml", "25 mg", "mental_health_psychiatric", "ampoule", "injection", "intramuscular", "2 ml", "no",
     "Phenothiazine antihistamine and antiemetic for severe allergy and nausea."),
    ("MED-PENAD-24IM", "Benzathine benzylpenicillin (Penadur) 2.4 MU injection", "2.4 MU", "antibiotics", "vial", "injection", "intramuscular", "1 vial", "no",
     "Long-acting penicillin for syphilis, rheumatic fever prophylaxis, and streptococcal infections."),
    ("MED-CEFTRS-15IV", "Ceftriaxone + Sulbactam 1.5 g injection", "1.5 g", "antibiotics", "vial", "injection", "intravenous", "1 vial", "no",
     "Third-generation cephalosporin with beta-lactamase inhibitor for resistant infections."),
    ("MED-TETAN-05IM", "Tetanus toxoid vaccine 0.5 ml", "0.5 ml", "immunological_vaccines", "ampoule", "injection", "intramuscular", "0.5 ml", "no",
     "Active immunisation agent for prevention of tetanus."),
    ("MED-TRAM-2IV", "Tramadol hydrochloride 100 mg/2 ml injection", "100 mg", "analgesics_antipyretics", "ampoule", "injection", "intravenous", "2 ml", "no",
     "Opioid analgesic injection for moderate to severe acute pain."),
    ("MED-TRIAM-40IM", "Triamcinolone acetonide 40 mg/ml injection", "40 mg", "anti_inflammatory", "vial", "injection", "intramuscular", "1 ml", "no",
     "Intramuscular corticosteroid for severe inflammatory and allergic conditions."),
    ("MED-TRANE-5IV", "Tranexamic acid 500 mg/5 ml injection", "500 mg", "haematological", "ampoule", "injection", "intravenous", "5 ml", "no",
     "Antifibrinolytic agent for control of haemorrhage and excessive bleeding."),
    ("MED-VITB-10IM", "Vitamin B complex 10 ml injection", "", "vitamins_minerals", "ampoule", "injection", "intramuscular", "10 ml", "yes",
     "B-complex vitamin injection for deficiency states and neuropathy."),
    ("MED-IRONS-20IV", "Iron sucrose 20 mg/ml injection", "20 mg", "haematological", "vial", "injection", "intravenous", "1 ml", "no",
     "Intravenous iron replacement for iron-deficiency anaemia when oral iron is not tolerated."),
    ("MED-BENZP-5MU", "Benzylpenicillin (Penicillin G) 5 MU injection", "5 MU", "antibiotics", "vial", "injection", "intramuscular", "1 vial", "no",
     "Natural penicillin for syphilis, meningococcal infections, and gas gangrene."),
    ("MED-OXYT-10IU", "Oxytocin 10 IU/ml injection", "10 IU", "hormones_contraceptives", "ampoule", "injection", "intramuscular", "1 ml", "no",
     "Oxytocic hormone for prevention and treatment of postpartum haemorrhage."),

    # ═══════════════════════════════════════════════════════════════════
    # LOTIONS
    # ═══════════════════════════════════════════════════════════════════
    ("MED-BBE-100LOT", "BB lotion 100 ml", "", "dermatological", "bottle", "lotion", "topical", "100 ml", "yes",
     "Topical lotion for skin moisturising and minor skin conditions."),
    ("MED-CALZ-100LOT", "Calamine + Zinc oxide lotion 100 ml", "", "dermatological", "bottle", "lotion", "topical", "100 ml", "yes",
     "Anti-pruritic and soothing lotion for chickenpox, sunburn, and mild skin irritations."),

    # ═══════════════════════════════════════════════════════════════════
    # PESSARIES
    # ═══════════════════════════════════════════════════════════════════
    ("MED-GYNEX-PESS", "Miconazole + Metronidazole (Gynex) pessary", "", "antifungals", "each", "pessary", "vaginal", "1 pessary", "no",
     "Combined antifungal and antiprotozoal vaginal pessary for vaginitis and vaginal trichomoniasis."),
    ("MED-CLTR-100PESS", "Clotrimazole 100 mg vaginal pessary", "100 mg", "antifungals", "each", "pessary", "vaginal", "1 pessary", "yes",
     "Azole antifungal vaginal pessary for vulvovaginal candidiasis."),
    ("MED-MICG-400PESS", "Miconazole (Gynazol) nitrate 400 mg vaginal pessary", "400 mg", "antifungals", "each", "pessary", "vaginal", "1 pessary", "yes",
     "Azole antifungal vaginal pessary for single-dose treatment of vulvovaginal candidiasis."),

    # ═══════════════════════════════════════════════════════════════════
    # POWDER
    # ═══════════════════════════════════════════════════════════════════
    ("MED-GLUC-80POW", "Oral rehydration glucose powder 80 g sachet", "80 g", "nutritional", "sachet", "powder", "oral", "80 g sachet", "yes",
     "Glucose powder for preparation of oral rehydration solution."),
    ("MED-ORS-POW", "ORS rehydration salt sachet", "", "nutritional", "sachet", "powder", "oral", "1 sachet", "yes",
     "Oral rehydration salts for prevention and treatment of dehydration from diarrhoea."),

    # ═══════════════════════════════════════════════════════════════════
    # SYRUPS / ORAL LIQUIDS
    # ═══════════════════════════════════════════════════════════════════
    ("MED-ALBEN-10SYR", "Albendazole 400 mg/10 ml syrup", "400 mg", "antihelminthics", "bottle", "suspension", "oral", "10 ml", "yes",
     "Broad-spectrum anthelmintic syrup for intestinal worms and hydatid disease."),
    ("MED-AZITH-30SYR", "Azithromycin 200 mg/5 ml syrup 30 ml", "200 mg", "antibiotics", "bottle", "suspension", "oral", "30 ml", "yes",
     "Macrolide antibiotic syrup for respiratory, ENT, and sexually transmitted infections."),
    ("MED-AMOCL-100SYR", "Amoxicillin + Clavulanate (Amox-Clav) syrup 100 ml", "", "antibiotics", "bottle", "suspension", "oral", "100 ml", "yes",
     "Beta-lactamase inhibitor combination syrup for upper respiratory and ear infections."),
    ("MED-AMOX-100SYR", "Amoxicillin 250 mg/5 ml syrup 100 ml", "250 mg", "antibiotics", "bottle", "suspension", "oral", "100 ml", "yes",
     "Broad-spectrum penicillin syrup for childhood respiratory and ENT infections."),
    ("MED-AMPCLX-100SYR", "Ampicillin + Cloxacillin (Ampiclox) syrup 100 ml", "", "antibiotics", "bottle", "suspension", "oral", "100 ml", "yes",
     "Combined penicillin syrup for skin, respiratory, and urinary tract infections."),
    ("MED-ANTAC-100SYR", "Antacid / Relcergel syrup 100 ml", "", "gastrointestinal", "bottle", "suspension", "oral", "100 ml", "yes",
     "Aluminium and magnesium hydroxide antacid syrup for dyspepsia and gastric hyperacidity."),
    ("MED-AL-22SYR", "Artemether + Lumefantrine (AL) 22.8 mg/ml syrup", "22.8 mg", "antimalarials", "bottle", "suspension", "oral", "60 ml", "no",
     "ACT combination antimalarial syrup for uncomplicated falciparum malaria in children."),
    ("MED-AMPCLXN-06SYR", "Ampicillin + Cloxacillin neonatal syrup 60 mg/ml", "60 mg", "antibiotics", "bottle", "suspension", "oral", "100 ml", "no",
     "Combined penicillin syrup formulated for neonatal and infant infections."),
    ("MED-CEPH-100SYR", "Cephalexin 250 mg/5 ml syrup 100 ml", "250 mg", "antibiotics", "bottle", "suspension", "oral", "100 ml", "yes",
     "First-generation cephalosporin syrup for paediatric skin, bone, and respiratory infections."),
    ("MED-CETIR-60SYR", "Cetirizine hydrochloride 10 mg syrup 60 ml", "10 mg", "respiratory", "bottle", "syrup", "oral", "60 ml", "yes",
     "Second-generation antihistamine syrup for allergic rhinitis, urticaria, and pruritus."),
    ("MED-CITAL-100SYR", "Sodium citrate (Cital) syrup 100 ml", "", "gastrointestinal", "bottle", "syrup", "oral", "100 ml", "yes",
     "Urinary alkaliniser syrup for urinary tract infections and gout."),
    ("MED-COTRI-100SYR", "Co-trimoxazole 240 mg/5 ml syrup 100 ml", "240 mg", "antibiotics", "bottle", "suspension", "oral", "100 ml", "yes",
     "Sulphonamide antibiotic syrup for respiratory, urinary, and gastrointestinal infections."),
    ("MED-CODRIL-100SYR", "Codril cough syrup 100 ml", "", "respiratory", "bottle", "syrup", "oral", "100 ml", "yes",
     "Combined cough suppressant and expectorant syrup for dry and productive cough."),
    ("MED-BELLAD-100SYR", "Belladonna syrup 100 ml", "", "gastrointestinal", "bottle", "syrup", "oral", "100 ml", "yes",
     "Anticholinergic syrup for gastrointestinal spasms and colic."),
    ("MED-GRIPE-100SYR", "Gripe water 100 ml", "", "gastrointestinal", "bottle", "syrup", "oral", "100 ml", "yes",
     "Carminative remedy for infantile colic and flatulence."),
    ("MED-DRCOLD-100SYR", "Dr Cold (Phenylephrine + Chlorphenamine) syrup 100 ml", "", "respiratory", "bottle", "syrup", "oral", "100 ml", "yes",
     "Combined decongestant and antihistamine syrup for cold and flu symptoms."),
    ("MED-GLOBZ-200SYR", "Globin Z haematinic syrup 200 ml", "", "haematological", "bottle", "syrup", "oral", "200 ml", "yes",
     "Iron, folic acid, and vitamin B12 haematinic syrup for anaemia."),
    ("MED-ERYTH-100SYR", "Erythromycin stearate 250 mg/5 ml syrup 100 ml", "250 mg", "antibiotics", "bottle", "suspension", "oral", "100 ml", "yes",
     "Macrolide antibiotic syrup for respiratory, skin, and ENT infections in penicillin-allergic patients."),
    ("MED-HEMOV-200SYR", "Hemovit syrup 200 ml", "", "haematological", "bottle", "syrup", "oral", "200 ml", "yes",
     "Iron and vitamin haematinic syrup for iron-deficiency anaemia."),
    ("MED-HEMAT-200SYR", "Hematone haematinic syrup 200 ml", "", "haematological", "bottle", "syrup", "oral", "200 ml", "yes",
     "Iron, folic acid, and B-vitamin haematinic syrup for anaemia."),
    ("MED-IBUP-100SYR", "Ibuprofen 100 mg/5 ml syrup 100 ml", "100 mg", "anti_inflammatory", "bottle", "suspension", "oral", "100 ml", "yes",
     "NSAID syrup for pain, fever, and inflammation in children and adults."),
    ("MED-LACT-100SYR", "Lactulose syrup 100 ml", "", "gastrointestinal", "bottle", "syrup", "oral", "100 ml", "yes",
     "Osmotic laxative syrup for constipation and hepatic encephalopathy."),
    ("MED-LONART-24SYR", "Artemether + Lumefantrine (Lonart DS) 80 mg/480 mg syrup 24 ml", "80 mg", "antimalarials", "bottle", "suspension", "oral", "24 ml", "no",
     "ACT combination antimalarial syrup for treatment of uncomplicated malaria."),
    ("MED-METRO-100SYR", "Metronidazole 200 mg/5 ml syrup 100 ml", "200 mg", "antiprotozoals", "bottle", "suspension", "oral", "100 ml", "yes",
     "Antiprotozoal and anaerobic antibacterial syrup for giardiasis, amoebiasis, and dental infections."),
    ("MED-MUCAD-100SYR", "Ambroxol (Mucolyn Adult) syrup 100 ml", "", "respiratory", "bottle", "syrup", "oral", "100 ml", "yes",
     "Mucolytic syrup for productive cough and respiratory secretions."),
    ("MED-MUCPA-100SYR", "Ambroxol (Mucolyn Paediatric) syrup 100 ml", "", "respiratory", "bottle", "suspension", "oral", "100 ml", "yes",
     "Mucolytic syrup for productive cough in children."),
    ("MED-MULTV-100SYR", "Multivitamin syrup 100 ml", "", "nutritional", "bottle", "syrup", "oral", "100 ml", "yes",
     "Multivitamin supplement syrup for growth, development, and nutritional support."),
    ("MED-PARA-100SYR", "Paracetamol 120 mg/5 ml syrup 100 ml", "120 mg", "analgesics_antipyretics", "bottle", "syrup", "oral", "100 ml", "yes",
     "Analgesic and antipyretic syrup for pain and fever in children."),
    ("MED-COUGH-100SYR", "Cough syrup (Prynalyn) 100 ml", "", "respiratory", "bottle", "syrup", "oral", "100 ml", "yes",
     "Combined cough suppressant syrup for dry cough."),
    ("MED-NYST-30SYR", "Nystatin oral suspension 100,000 IU/ml 30 ml", "100000 IU", "antifungals", "bottle", "suspension", "oral", "30 ml", "yes",
     "Antifungal oral suspension for oral and oesophageal candidiasis."),
    ("MED-VITBC-100SYR", "Vitamin B-complex syrup 100 ml", "", "vitamins_minerals", "bottle", "syrup", "oral", "100 ml", "yes",
     "B-complex vitamin supplement syrup."),
    ("MED-ZECUF-100SYR", "Zecuf herbal cough syrup 100 ml", "", "respiratory", "bottle", "syrup", "oral", "100 ml", "yes",
     "Herbal cough syrup for relief of cough and respiratory discomfort."),
    ("MED-ZNSUL-100SYR", "Zinc sulphate 20 mg/5 ml syrup 100 ml", "20 mg", "nutritional", "bottle", "syrup", "oral", "100 ml", "yes",
     "Zinc supplement syrup for diarrhoea management in children and nutritional supplementation."),
    ("MED-SKTONE-100SYR", "Sktonic (Iron, Vitamin B, Folic Acid, Zinc) syrup 100 ml", "", "haematological", "bottle", "syrup", "oral", "100 ml", "yes",
     "Combined haematinic syrup with iron, B-vitamins, folic acid, and zinc for anaemia."),
    ("MED-TERMID-100SYR", "Termidol (Ibuprofen + Paracetamol) syrup 100 ml", "", "anti_inflammatory", "bottle", "suspension", "oral", "100 ml", "yes",
     "Combined NSAID and analgesic syrup for pain and fever."),
    ("MED-MUMFER-150SYR", "Mumfer iron and folic acid syrup 150 ml", "", "haematological", "bottle", "syrup", "oral", "150 ml", "yes",
     "Iron and folic acid supplement syrup for pregnancy and anaemia."),

    # ═══════════════════════════════════════════════════════════════════
    # TABLETS
    # ═══════════════════════════════════════════════════════════════════
    ("MED-ASPJ-75TAB", "Aspirin Junior 75 mg tablet", "75 mg", "cardiovascular", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Low-dose aspirin for cardiovascular prophylaxis and antiplatelet therapy."),
    ("MED-ACICV-200TAB", "Aciclovir 200 mg tablet", "200 mg", "antivirals", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Antiviral tablet for herpes simplex and varicella-zoster infections."),
    ("MED-ACECL-100TAB", "Aceclofenac 100 mg tablet", "100 mg", "anti_inflammatory", "tablet", "tablet", "oral", "30 tablets", "yes",
     "NSAID tablet for pain, inflammation, and musculoskeletal conditions."),
    ("MED-ALBEN-200TAB", "Albendazole 400 mg tablet", "400 mg", "antihelminthics", "tablet", "tablet", "oral", "1 tablet", "yes",
     "Broad-spectrum anthelmintic for intestinal worms, neurocysticercosis, and hydatid disease."),
    ("MED-ALUME-12TAB", "Artemether + Lumefantrine 20/120 mg (12 tablets)", "20 mg", "antimalarials", "tablet", "tablet", "oral", "12 tablets", "no",
     "ACT combination antimalarial for uncomplicated falciparum malaria."),
    ("MED-ALUME-6TAB", "Artemether + Lumefantrine 80/480 mg (Lonart DS) (6 tablets)", "80 mg", "antimalarials", "tablet", "tablet", "oral", "6 tablets", "no",
     "ACT combination antimalarial for treatment of uncomplicated malaria."),
    ("MED-ALUME-24TAB", "Artemether + Lumefantrine 20/120 mg (24 tablets)", "20 mg", "antimalarials", "tablet", "tablet", "oral", "24 tablets", "no",
     "ACT combination antimalarial for uncomplicated falciparum malaria."),
    ("MED-AMOCL-625TAB", "Amoxicillin + Clavulanate (Amox-Clav) 625 mg tablet", "625 mg", "antibiotics", "tablet", "tablet", "oral", "10 tablets", "yes",
     "Beta-lactamase inhibitor combination for resistant bacterial infections."),
    ("MED-AMOCL-375TAB", "Amoxicillin + Clavulanate (Amox-Clav) 375 mg tablet", "375 mg", "antibiotics", "tablet", "tablet", "oral", "10 tablets", "yes",
     "Beta-lactamase inhibitor combination for respiratory and ENT infections."),
    ("MED-AMINO-100TAB", "Aminophylline 100 mg tablet", "100 mg", "respiratory", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Xanthine bronchodilator tablet for chronic asthma and bronchospasm."),
    ("MED-ATEN-50TAB", "Atenolol 50 mg tablet", "50 mg", "cardiovascular", "tablet", "tablet", "oral", "30 tablets", "yes",
     "Beta-1 selective blocker for hypertension, angina, and post-MI prophylaxis."),
    ("MED-BACL-10TAB", "Baclofen 10 mg tablet", "10 mg", "neurological", "tablet", "tablet", "oral", "30 tablets", "no",
     "GABA-B agonist for spasticity in multiple sclerosis, spinal cord injury, and stroke."),
    ("MED-BENDFT-5TAB", "Bendroflumethiazide 5 mg tablet", "5 mg", "cardiovascular", "tablet", "tablet", "oral", "30 tablets", "yes",
     "Thiazide diuretic for hypertension and oedema."),
    ("MED-BISAC-5TAB", "Bisacodyl 5 mg tablet", "5 mg", "gastrointestinal", "tablet", "tablet", "oral", "30 tablets", "yes",
     "Stimulant laxative for constipation and bowel evacuation."),
    ("MED-CAPT-25TAB", "Captopril 25 mg tablet", "25 mg", "cardiovascular", "tablet", "tablet", "oral", "100 tablets", "yes",
     "ACE inhibitor for hypertension, heart failure, and diabetic nephropathy."),
    ("MED-CLARI-500TAB", "Clarithromycin 500 mg tablet", "500 mg", "antibiotics", "tablet", "tablet", "oral", "10 tablets", "no",
     "Macrolide antibiotic for respiratory, skin, and H. pylori infections."),
    ("MED-CETIR-10TAB", "Cetirizine 10 mg tablet", "10 mg", "respiratory", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Second-generation antihistamine for allergic rhinitis and chronic urticaria."),
    ("MED-CEFIX-400TAB", "Cefixime 400 mg tablet", "400 mg", "antibiotics", "tablet", "tablet", "oral", "10 tablets", "no",
     "Third-generation cephalosporin for urinary tract and respiratory infections."),
    ("MED-CIPRO-500TAB", "Ciprofloxacin 500 mg tablet", "500 mg", "antibiotics", "tablet", "tablet", "oral", "20 tablets", "no",
     "Fluoroquinolone antibiotic for urinary tract, gastrointestinal, and respiratory infections."),
    ("MED-CIPT-600TAB", "Ciprofloxacin + Tinidazole 600 mg tablet", "600 mg", "antibiotics", "tablet", "tablet", "oral", "10 tablets", "no",
     "Combined fluoroquinolone and antiprotozoal for mixed aerobic-anaerobic infections."),
    ("MED-CMAG-250TAB", "Compound Magnesium Trisilicate 250 mg tablet", "250 mg", "gastrointestinal", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Antacid tablet for dyspepsia, heartburn, and gastric hyperacidity."),
    ("MED-COTRI-480TAB", "Co-trimoxazole 480 mg tablet", "480 mg", "antibiotics", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Sulphonamide antibiotic for respiratory, urinary, and gastrointestinal infections."),
    ("MED-DIAZ-5TAB", "Diazepam 5 mg tablet", "5 mg", "mental_health_psychiatric", "tablet", "tablet", "oral", "100 tablets", "no",
     "Benzodiazepine for anxiety, muscle spasms, seizures, and alcohol withdrawal."),
    ("MED-AZITH-500TAB", "Azithromycin 500 mg (Azuma) tablet", "500 mg", "antibiotics", "tablet", "tablet", "oral", "3 tablets", "yes",
     "Macrolide antibiotic for respiratory, ENT, and sexually transmitted infections."),
    ("MED-AZITH-250TAB", "Azithromycin 250 mg (Azuma) tablet", "250 mg", "antibiotics", "tablet", "tablet", "oral", "6 tablets", "yes",
     "Macrolide antibiotic for paediatric respiratory and ENT infections."),
    ("MED-ERYTH-250TAB", "Erythromycin stearate 250 mg tablet", "250 mg", "antibiotics", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Macrolide antibiotic for respiratory, skin, and ENT infections in penicillin-allergic patients."),
    ("MED-FERSUL-200TAB", "Ferrous sulphate 200 mg tablet", "200 mg", "haematological", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Iron supplement tablet for prevention and treatment of iron-deficiency anaemia."),
    ("MED-FLUC-150TAB", "Fluconazole 150 mg capsule", "150 mg", "antifungals", "capsule", "capsule", "oral", "1 capsule", "yes",
     "Azole antifungal for vaginal candidiasis and systemic fungal infections."),
    ("MED-FOLIC-5TAB", "Folic acid 5 mg tablet", "5 mg", "haematological", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Vitamin supplement for folic acid deficiency anaemia and neural tube defect prophylaxis."),
    ("MED-FURO-40TAB", "Furosemide 40 mg tablet", "40 mg", "cardiovascular", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Loop diuretic for hypertension, heart failure, and oedema."),
    ("MED-GRIS-500TAB", "Griseofulvin 500 mg tablet", "500 mg", "antifungals", "tablet", "tablet", "oral", "30 tablets", "no",
     "Antifungal tablet for dermatophyte infections of skin, hair, and nails."),
    ("MED-HYDR-25TAB", "Hydralazine 25 mg tablet", "25 mg", "cardiovascular", "tablet", "tablet", "oral", "100 tablets", "no",
     "Direct vasodilator for hypertension and heart failure."),
    ("MED-HYOSC-10TAB", "Hyoscine butylbromide 10 mg tablet", "10 mg", "gastrointestinal", "tablet", "tablet", "oral", "30 tablets", "yes",
     "Antispasmodic tablet for irritable bowel syndrome and abdominal cramps."),
    ("MED-IBUP-200TAB", "Ibuprofen 200 mg tablet", "200 mg", "anti_inflammatory", "tablet", "tablet", "oral", "100 tablets", "yes",
     "NSAID tablet for pain, fever, and inflammation."),
    ("MED-LOPER-2TAB", "Loperamide hydrochloride 2 mg tablet", "2 mg", "gastrointestinal", "tablet", "tablet", "oral", "100 capsules", "yes",
     "Antidiarrhoeal agent for symptomatic relief of acute and chronic diarrhoea."),
    ("MED-LORA-10TAB", "Loratadine 10 mg tablet", "10 mg", "respiratory", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Second-generation antihistamine for allergic rhinitis and chronic urticaria."),
    ("MED-MALAF-525TAB", "Malafin (Sulfamethoxypyrazine + Pyrimethamine) 525 mg tablet", "525 mg", "antimalarials", "tablet", "tablet", "oral", "10 tablets", "no",
     "Antimalarial combination for treatment of uncomplicated malaria."),
    ("MED-METF-500TAB", "Metformin hydrochloride 500 mg tablet", "500 mg", "endocrine_metabolic", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Biguanide oral antidiabetic for type 2 diabetes mellitus."),
    ("MED-METGLIM-501TAB", "Metformin + Glimepiride 500 mg/1 mg tablet", "500 mg", "endocrine_metabolic", "tablet", "tablet", "oral", "30 tablets", "no",
     "Combined oral antidiabetic for type 2 diabetes not controlled by monotherapy."),
    ("MED-METOC-10TAB", "Metoclopramide hydrochloride 10 mg tablet", "10 mg", "gastrointestinal", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Antiemetic and prokinetic for nausea, vomiting, and gastroparesis."),
    ("MED-METRO-200TAB", "Metronidazole 200 mg tablet", "200 mg", "antiprotozoals", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Antiprotozoal and anaerobic antibacterial for giardiasis, amoebiasis, and dental infections."),
    ("MED-METMI-200TAB", "Metronidazole + Miconazole vaginal tablet", "", "antifungals", "tablet", "tablet", "vaginal", "10 tablets", "no",
     "Combined antiprotozoal and antifungal vaginal tablet for mixed vaginitis."),
    ("MED-MEBEN-100TAB", "Mebendazole 100 mg tablet", "100 mg", "antihelminthics", "tablet", "tablet", "oral", "1 tablet", "yes",
     "Anthelmintic tablet for threadworm, roundworm, and whipworm infections."),
    ("MED-MONT-10TAB", "Montelukast 10 mg tablet", "10 mg", "respiratory", "tablet", "tablet", "oral", "30 tablets", "yes",
     "Leukotriene receptor antagonist for prevention of chronic asthma."),
    ("MED-MONT-5TAB", "Montelukast 5 mg tablet", "5 mg", "respiratory", "tablet", "tablet", "oral", "30 tablets", "yes",
     "Leukotriene receptor antagonist for prevention of chronic asthma in children."),
    ("MED-MELOX-15TAB", "Meloxicam 15 mg tablet", "15 mg", "anti_inflammatory", "tablet", "tablet", "oral", "30 tablets", "yes",
     "COX-2 preferential NSAID for osteoarthritis, rheumatoid arthritis, and pain."),
    ("MED-MULTV-TAB", "Multivitamin tablet", "", "nutritional", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Daily multivitamin supplement for nutritional support."),
    ("MED-NIFE-20TAB", "Nifedipine 20 mg tablet", "20 mg", "cardiovascular", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Calcium channel blocker for hypertension and angina pectoris."),
    ("MED-NITF-100TAB", "Nitrofurantoin 100 mg tablet", "100 mg", "antibiotics", "tablet", "tablet", "oral", "30 tablets", "yes",
     "Urinary antiseptic for prevention and treatment of urinary tract infections."),
    ("MED-PARA-500TAB", "Paracetamol 500 mg tablet", "500 mg", "analgesics_antipyretics", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Analgesic and antipyretic for pain and fever."),
    ("MED-PARA-SUP125", "Paracetamol suppository 125 mg", "125 mg", "analgesics_antipyretics", "each", "suppository", "rectal", "10 suppositories", "yes",
     "Rectal paracetamol for pain and fever when oral route is not suitable."),
    ("MED-PRED-5TAB", "Prednisolone 5 mg tablet", "5 mg", "anti_inflammatory", "tablet", "tablet", "oral", "100 tablets", "no",
     "Corticosteroid for asthma, allergic conditions, autoimmune diseases, and inflammation."),
    ("MED-NEURO-300TAB", "Neurotone (Methylcobalamin) 300 mcg tablet", "300 mcg", "vitamins_minerals", "tablet", "tablet", "oral", "30 tablets", "yes",
     "Vitamin B12 supplement for peripheral neuropathy and B12 deficiency."),
    ("MED-PANTO-40TAB", "Pantoprazole 40 mg tablet", "40 mg", "gastrointestinal", "tablet", "tablet", "oral", "30 tablets", "yes",
     "Proton pump inhibitor for gastric ulcer, GERD, and erosive oesophagitis."),
    ("MED-DUOCO-360TAB", "Duo-Cotex 360 mg tablet", "360 mg", "anti_inflammatory", "tablet", "tablet", "oral", "30 tablets", "yes",
     "Combined analgesic tablet for pain and inflammation."),
    ("MED-VITBC-10TAB", "Vitamin B complex 10 mg tablet", "10 mg", "vitamins_minerals", "tablet", "tablet", "oral", "100 tablets", "yes",
     "B-complex vitamin supplement for deficiency states."),
    ("MED-ZNSUL-20TAB", "Zinc sulphate 20 mg dispersible tablet", "20 mg", "nutritional", "tablet", "dispersible tablet", "oral", "100 tablets", "yes",
     "Zinc supplement dispersible tablet for diarrhoea management and nutritional deficiency."),
    ("MED-TIZA-4TAB", "Tizanidine 4 mg tablet", "4 mg", "neurological", "tablet", "tablet", "oral", "30 tablets", "no",
     "Centrally acting muscle relaxant for spasticity and musculoskeletal pain."),
    ("MED-TINI-500TAB", "Tinidazole 500 mg tablet", "500 mg", "antiprotozoals", "tablet", "tablet", "oral", "10 tablets", "yes",
     "Antiprotozoal for giardiasis, amoebiasis, and bacterial vaginosis."),
    ("MED-PVPC-250TAB", "Phenoxymethylpenicillin 250 mg tablet", "250 mg", "antibiotics", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Oral penicillin for streptococcal pharyngitis, tonsillitis, and rheumatic fever prophylaxis."),
    ("MED-PROM-25TAB", "Promethazine 25 mg tablet", "25 mg", "mental_health_psychiatric", "tablet", "tablet", "oral", "100 tablets", "yes",
     "Phenothiazine antihistamine for allergy, sedation, and nausea."),
    ("MED-NORE-5TAB", "Norethisterone (NOR 5) 5 mg tablet", "5 mg", "hormones_contraceptives", "tablet", "tablet", "oral", "30 tablets", "no",
     "Progestogen for menstrual disorders, endometriosis, and contraception."),
    ("MED-DUPH-10TAB", "Duphaston (Dydrogesterone) 10 mg tablet", "10 mg", "hormones_contraceptives", "tablet", "tablet", "oral", "20 tablets", "no",
     "Progestogen for threatened miscarriage, endometriosis, and menstrual disorders."),
]

# ── Medical consumables / devices (NOT formulary items — include for reference) ──
consumables = [
    # Infusion & Injection Sets
    ("MED-CANN-22G", "Cannula 22G (Blue)", "", "Medical consumable", "each", "", "", "1 piece", "no", "Intravenous cannula 22 gauge for venous access."),
    ("MED-CANN-20G", "Cannula 20G (Pink)", "", "Medical consumable", "each", "", "", "1 piece", "no", "Intravenous cannula 20 gauge for venous access."),
    ("MED-CANN-24G", "Cannula 24G (Yellow)", "", "Medical consumable", "each", "", "", "1 piece", "no", "Intravenous cannula 24 gauge for paediatric and small vein access."),
    ("MED-CANN-18G", "Cannula 18G (Green)", "", "Medical consumable", "each", "", "", "1 piece", "no", "Intravenous cannula 18 gauge for rapid fluid resuscitation and blood transfusion."),
    ("MED-IVSET-1PC", "Giving IV set 1 piece", "", "Medical consumable", "each", "", "", "1 piece", "no", "Standard IV infusion set with flow regulator."),
    ("MED-SCALPV-1PC", "Scalp vein set 1 piece", "", "Medical consumable", "each", "", "", "1 piece", "no", "Butterfly needle scalp vein set for difficult venous access."),
    ("MED-SYR10-1PC", "Syringe 10 ml (10 CC) 1 piece", "", "Medical consumable", "each", "", "", "1 piece", "no", "Disposable 10 ml syringe for injection and aspiration."),
    ("MED-SYR2-1PC", "Syringe 2 ml (2 CC) 1 piece", "", "Medical consumable", "each", "", "", "1 piece", "no", "Disposable 2 ml syringe for small volume injections."),
    ("MED-SYR5-1PC", "Syringe 5 ml (5 CC) 1 piece", "", "Medical consumable", "each", "", "", "1 piece", "no", "Disposable 5 ml syringe for standard injections."),
    # Delivery and care supplies
    ("MED-DELIK-6PCS", "Delivery kit 6 pieces", "", "Medical consumable", "kit", "", "", "6 pieces", "no", "Clean delivery kit for safe childbirth."),
    ("MED-URBAG-1PC", "Urine bag 1 piece", "", "Medical consumable", "each", "", "", "1 piece", "no", "Sterile urine collection bag for catheterised patients."),
    ("MED-CATH-1PC", "Catheter 1 piece", "", "Medical consumable", "each", "", "", "1 piece", "no", "Urinary catheter for bladder drainage."),
]

# ── Soaps (hygiene products — include for reference, may not belong in formulary) ──
soaps = [
    ("MED-DETTL-100", "Dettol Juniors soap 100 g", "", "dermatological", "each", "", "", "100 g", "yes", "Antibacterial soap for children."),
    ("MED-TMCIT-100", "Tetmosol Citronella soap 100 g", "", "dermatological", "each", "", "", "100 g", "yes", "Insect-repellent medicated soap."),
    ("MED-TMJNR-75", "Tetmosol Juniors soap 75 g", "", "dermatological", "each", "", "", "75 g", "yes", "Medicated soap for children."),
]


def write_csv(filename, items, include_medicines=True):
    headers = [
        "code", "name", "category", "unit", "facility_tier", "department_code",
        "billing_service_code", "description", "status", "status_reason",
        "standard_local", "standard_loinc", "standard_snomed_ct",
        "standard_nhif", "standard_msd", "standard_cpt", "standard_icd",
        "strength", "dosage_form", "route", "pack_size", "otc_allowed"
    ]

    with open(filename, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(headers)

        for med in items:
            code, name, strength, category, unit, dosage_form, route, pack_size, otc, description = med
            writer.writerow([
                code,             # code
                name,             # name
                category,         # category (therapeutic class)
                unit,             # unit (dispensing unit)
                "",               # facility_tier
                "PHM",            # department_code (pharmacy department)
                "",               # billing_service_code
                description,      # description
                "active",         # status
                "",               # status_reason
                "",               # standard_local
                "",               # standard_loinc
                "",               # standard_snomed_ct
                "",               # standard_nhif
                "",               # standard_msd
                "",               # standard_cpt
                "",               # standard_icd
                strength,         # strength
                dosage_form,      # dosage_form
                route,            # route
                pack_size,        # pack_size
                otc,              # otc_allowed
            ])

    print(f"Written {len(items)} rows to {filename}")


if __name__ == "__main__":
    import os
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "documents")
    os.makedirs(output_dir, exist_ok=True)

    # Main medicines upload file
    main_file = os.path.join(output_dir, "formulary_upload_medicines.csv")
    write_csv(main_file, medicines)
    print(f"\nMedicines CSV: {main_file}")
    print(f"  Total medicines: {len(medicines)}")

    # Reference file with all items including consumables
    all_file = os.path.join(output_dir, "formulary_upload_all_items.csv")
    write_csv(all_file, medicines + consumables + soaps)
    print(f"\nAll items CSV (including consumables and soaps): {all_file}")
    print(f"  Total items: {len(medicines) + len(consumables) + len(soaps)}")

    # Summary by category
    categories = {}
    for med in medicines:
        cat = med[3]
        categories[cat] = categories.get(cat, 0) + 1
    print("\n── Category breakdown ──")
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count}")

    # Summary by dosage form
    forms = {}
    for med in medicines:
        form = med[5]
        forms[form] = forms.get(form, 0) + 1
    print("\n── Dosage form breakdown ──")
    for form, count in sorted(forms.items()):
        print(f"  {form}: {count}")