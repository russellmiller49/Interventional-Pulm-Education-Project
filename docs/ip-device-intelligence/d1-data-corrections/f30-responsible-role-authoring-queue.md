# F-30 — `responsibleRole` authoring queue

**Status: OWNER / WORKFLOW AUTHORING DECISION — no value below is authored.**

`responsibleRole` is null on every authored slot (232 imported template rows -> 0 authored
values; `procedureSlotToRecipeSlot` hardcodes `responsibleRole: null`). The nursing/
technician output therefore cannot group by responsibility, and the D1 UI keeps its honest
fallback panel until values are authored. Responsibility varies by workflow and institution,
so no value was inferred from zone, phase, role, item name, or clinical convention — every
row below is blank and marked OWNER DECISION REQUIRED.

No allowed responsible-role vocabulary exists in governed data yet (`responsibleRole` is a
free `string | null` in `domain/types.ts`). **Vocabulary itself is owner decision #0**: the
queue below cannot be filled until the owner fixes the closed list of responsibility values.

Rows reflect the current (v1-1 release) compositions with their composition actions applied,
so the six F-04-corrected sampling instruments appear at their corrected zone/phase. Optional
modules a composition offers (EBV's fluoroscopy) are included, which is why the queue holds
234 rows over 232 template rows.

Totals: **234 slot rows across 15 current compositions; 234 with null `responsibleRole` (100%); 0 authored.**

Counts by procedure: BRONCH_ABLATION 23, CHEST_TUBE 9, EBUS_TBNA 17, EBV 13, FLEX_DIAGNOSTIC 19, ICU_BRONCH 12, IPC_PLACEMENT 8, MED_THORACOSCOPY 20, PERC_TRACH 10, PHOTODYNAMIC_THERAPY 12, RIGID_BRONCH 31, TB_RULEOUT 11, THERAPEUTIC_BRONCH 30, THORACENTESIS 6, WLL 13

Counts by procedural phase (likely authoring batches): airway_access 21, diagnostic 22, post_procedure 15, pre_induction_or_sedation 20, pre_room 49, rescue_or_contingency 5, specimen_handling 26, therapeutic 74, unassigned 2

Grouped procedure → phase → section for fast authoring:

## BRONCH_ABLATION — Bronchoscopic tumor ablation (23 slots)

### pre_room

| Slot id           | Requirement key   | Role code                         | Label                                 | Requiredness | Section  | Zone                   | Dependency rule     | Module@version               | responsibleRole             |
| ----------------- | ----------------- | --------------------------------- | ------------------------------------- | ------------ | -------- | ---------------------- | ------------------- | ---------------------------- | --------------------------- |
| `SLOT-7DBF54AF12` | `SLOT-7DBF54AF12` | `FLUOROSCOPY_C_ARM`               | Fluoroscopy C-arm                     | conditional  | Imaging  | room_capital_equipment | Peripheral target   | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-8399A6050E` | `SLOT-8399A6050E` | `TOMOSYNTHESIS_NAVIGATION_SYSTEM` | Tomosynthesis navigation              | conditional  | Imaging  | room_capital_equipment | Peripheral target   | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-06198365DB` | `SLOT-06198365DB` | `RADIATION_PROTECTION`            | Radiation protection                  | conditional  | Imaging  | room_capital_equipment | Fluoroscopy planned | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-03C81C8ED9` | `SLOT-03C81C8ED9` | `RADIAL_EBUS_PROBE`               | Radial EBUS probe                     | conditional  | Imaging  | room_capital_equipment | Peripheral target   | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-F66DEC963D` | `SLOT-F66DEC963D` | `FLEX_SCOPE_THERAPEUTIC`          | Therapeutic bronchoscope              | required     | Platform | equipment_tower        | —                   | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-97AE031E2A` | `SLOT-97AE031E2A` | `VIDEO_PROCESSOR`                 | Compatible processor and light source | required     | Platform | equipment_tower        | —                   | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### pre_induction_or_sedation

| Slot id           | Requirement key   | Role code         | Label         | Requiredness | Section | Zone            | Dependency rule | Module@version               | responsibleRole             |
| ----------------- | ----------------- | ----------------- | ------------- | ------------ | ------- | --------------- | --------------- | ---------------------------- | --------------------------- |
| `SLOT-B7C11A32AD` | `SLOT-B7C11A32AD` | `GENERIC_SUCTION` | Suction setup | required     | Suction | equipment_tower | —               | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### airway_access

| Slot id           | Requirement key   | Role code                | Label                             | Requiredness | Section           | Zone       | Dependency rule                                       | Module@version               | responsibleRole             |
| ----------------- | ----------------- | ------------------------ | --------------------------------- | ------------ | ----------------- | ---------- | ----------------------------------------------------- | ---------------------------- | --------------------------- |
| `SLOT-E919659133` | `SLOT-E919659133` | `GENERIC_AIRWAY_ADAPTER` | Airway adapter                    | required     | Airway protection | mayo_stand | —                                                     | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-BE38624BB8` | `SLOT-BE38624BB8` | `LASER_RESISTANT_ETT`    | Laser-resistant endotracheal tube | conditional  | Airway protection | mayo_stand | Laser planned with an indwelling tube or tracheostomy | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### therapeutic

| Slot id           | Requirement key   | Role code                      | Label                                     | Requiredness | Section     | Zone            | Dependency rule                             | Module@version               | responsibleRole             |
| ----------------- | ----------------- | ------------------------------ | ----------------------------------------- | ------------ | ----------- | --------------- | ------------------------------------------- | ---------------------------- | --------------------------- |
| `SLOT-2EDD1F1A49` | `SLOT-2EDD1F1A49` | `CRYOPROBE_FLEX`               | Flexible cryoprobe                        | conditional  | Cryotherapy | equipment_tower | Cryotherapy planned                         | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-408806A1E9` | `SLOT-408806A1E9` | `CRYO_SYSTEM_ACCESSORY`        | Cryotherapy console accessories           | conditional  | Cryotherapy | equipment_tower | Cryotherapy planned                         | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-DB4AA915E7` | `SLOT-DB4AA915E7` | `ENERGY_PLATFORM`              | Energy platform                           | required     | Energy      | equipment_tower | —                                           | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-213AD02F3D` | `SLOT-213AD02F3D` | `APC_PROBE_FLEX`               | Flexible APC probe                        | conditional  | Energy      | equipment_tower | APC planned                                 | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-90EACE8A77` | `SLOT-90EACE8A77` | `LASER_CONSOLE`                | Surgical laser console                    | conditional  | Energy      | equipment_tower | Laser planned                               | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-D8AC96F833` | `SLOT-D8AC96F833` | `LASER_FIBER`                  | Laser delivery fibre                      | conditional  | Energy      | equipment_tower | Laser planned                               | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-5B5D976D2A` | `SLOT-5B5D976D2A` | `LASER_SAFETY_EQUIPMENT`       | Laser safety equipment                    | conditional  | Energy      | equipment_tower | Laser planned                               | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-C862A72632` | `SLOT-C862A72632` | `MICROWAVE_ABLATION_CATHETER`  | Bronchoscopic microwave ablation catheter | conditional  | Energy      | equipment_tower | Investigational protocol or study enrolment | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-063C99B0F4` | `SLOT-063C99B0F4` | `PULSED_FIELD_ABLATION_SYSTEM` | Pulsed electric field system              | conditional  | Energy      | equipment_tower | Investigational protocol or study enrolment | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### specimen_handling

| Slot id           | Requirement key   | Role code             | Label               | Requiredness | Section  | Zone             | Dependency rule   | Module@version               | responsibleRole             |
| ----------------- | ----------------- | --------------------- | ------------------- | ------------ | -------- | ---------------- | ----------------- | ---------------------------- | --------------------------- |
| `SLOT-D0D9794E05` | `SLOT-D0D9794E05` | `GUIDE_SHEATH_KIT`    | Guide sheath        | conditional  | Sampling | specimen_station | Peripheral target | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-E3604B09C0` | `SLOT-E3604B09C0` | `BIOPSY_FORCEPS_FLEX` | Biopsy forceps      | required     | Sampling | specimen_station | —                 | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-89F6487409` | `SLOT-89F6487409` | `GENERIC_SPECIMEN`    | Specimen containers | required     | Sampling | specimen_station | —                 | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### rescue_or_contingency

| Slot id           | Requirement key   | Role code                   | Label                           | Requiredness | Section | Zone           | Dependency rule       | Module@version               | responsibleRole             |
| ----------------- | ----------------- | --------------------------- | ------------------------------- | ------------ | ------- | -------------- | --------------------- | ---------------------------- | --------------------------- |
| `SLOT-26B0E004DD` | `SLOT-26B0E004DD` | `CHEST_TUBE_SMALL_BORE`     | Chest tube available for rescue | conditional  | Rescue  | emergency_cart | Peripheral target     | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-8AB12F127A` | `SLOT-8AB12F127A` | `RIGID_BRONCHOSCOPE_BARREL` | Rigid barrel on standby         | conditional  | Rescue  | emergency_cart | Central airway lesion | BRONCH_ABLATION_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

## CHEST_TUBE — Chest tube insertion (9 slots)

### pre_room

| Slot id           | Requirement key              | Role code            | Label                                      | Requiredness | Section | Zone                   | Dependency rule        | Module@version             | responsibleRole             |
| ----------------- | ---------------------------- | -------------------- | ------------------------------------------ | ------------ | ------- | ---------------------- | ---------------------- | -------------------------- | --------------------------- |
| `SLOT-E91A13EE9E` | `PLEURAL_ULTRASOUND_MACHINE` | `GENERIC_ULTRASOUND` | Ultrasound machine and sterile probe cover | optional     | Imaging | room_capital_equipment | Image-guided insertion | PLEURAL_PROCEDURE_CORE@1.0 | **OWNER DECISION REQUIRED** |

### pre_induction_or_sedation

| Slot id           | Requirement key   | Role code                    | Label                                              | Requiredness | Section  | Zone            | Dependency rule                                 | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ---------------------------- | -------------------------------------------------- | ------------ | -------- | --------------- | ----------------------------------------------- | ----------------------- | --------------------------- |
| `SLOT-3631C94D7A` | `SLOT-3631C94D7A` | `GENERIC_DRAINAGE_UNIT`      | Chest drainage unit                                | required     | Drainage | equipment_tower | —                                               | CHEST_TUBE_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-CE48C1B108` | `SLOT-CE48C1B108` | `GENERIC_SUCTION`            | Suction tubing/connectors                          | required     | Drainage | equipment_tower | —                                               | CHEST_TUBE_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-AECDA16326` | `SLOT-AECDA16326` | `PLEURAL_DRAINAGE_ACCESSORY` | Pleural drainage adapters / tubing / one-way valve | conditional  | Drainage | equipment_tower | Selected catheter requires accessory components | CHEST_TUBE_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### therapeutic

| Slot id           | Requirement key   | Role code               | Label                                          | Requiredness | Section      | Zone          | Dependency rule                           | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ----------------------- | ---------------------------------------------- | ------------ | ------------ | ------------- | ----------------------------------------- | ----------------------- | --------------------------- |
| `SLOT-20D17E94D4` | `SLOT-20D17E94D4` | `PNEUMOTHORAX_KIT`      | Dedicated pneumothorax aspiration/drainage kit | optional     | Pneumothorax | back_table    | Appropriate pneumothorax workflow         | CHEST_TUBE_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-708736B8C2` | `SLOT-708736B8C2` | `CHEST_TUBE_SMALL_BORE` | Small-bore Seldinger/pigtail chest drain       | conditional  | Tube         | sterile_field | Small-bore approach selected              | CHEST_TUBE_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-D5C3DB0027` | `SLOT-D5C3DB0027` | `CHEST_TUBE_LARGE_BORE` | Large-bore chest tube set                      | conditional  | Tube         | sterile_field | Large-bore percutaneous approach selected | CHEST_TUBE_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-4D849E266F` | `SLOT-4D849E266F` | `CHEST_TUBE_SURGICAL`   | Surgical thoracic catheter/trocar tube         | conditional  | Tube         | sterile_field | Surgical/trocar approach selected         | CHEST_TUBE_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### post_procedure

| Slot id           | Requirement key   | Role code             | Label                                    | Requiredness | Section        | Zone       | Dependency rule | Module@version          | responsibleRole             |
| ----------------- | ----------------- | --------------------- | ---------------------------------------- | ------------ | -------------- | ---------- | --------------- | ----------------------- | --------------------------- |
| `SLOT-4BE1D79D6C` | `SLOT-4BE1D79D6C` | `DRESSING_SECUREMENT` | Securement, suture, dressing, and labels | required     | Post-procedure | back_table | —               | CHEST_TUBE_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

## EBUS_TBNA — EBUS-TBNA / EBUS-FNB (17 slots)

### pre_room

| Slot id           | Requirement key                   | Role code              | Label                                   | Requiredness | Section  | Zone                   | Dependency rule     | Module@version             | responsibleRole             |
| ----------------- | --------------------------------- | ---------------------- | --------------------------------------- | ------------ | -------- | ---------------------- | ------------------- | -------------------------- | --------------------------- |
| `SLOT-F3BF1ECC7E` | `PROCEDURAL_FLUOROSCOPY_C_ARM`    | `FLUOROSCOPY_C_ARM`    | Fluoroscopy C-arm                       | conditional  | Imaging  | room_capital_equipment | Fluoroscopy planned | PROCEDURAL_FLUOROSCOPY@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-1D13D48BD7` | `PROCEDURAL_RADIATION_PROTECTION` | `RADIATION_PROTECTION` | Radiation protection                    | conditional  | Imaging  | room_capital_equipment | Fluoroscopy planned | PROCEDURAL_FLUOROSCOPY@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-4648848CC3` | `SLOT-4648848CC3`                 | `EBUS_SCOPE`           | Linear EBUS bronchoscope                | required     | Platform | equipment_tower        | —                   | EBUS_TBNA_SPECIFIC@1.0     | **OWNER DECISION REQUIRED** |
| `SLOT-7DFA66EA2D` | `FLEX_BRONCH_VIDEO_PROCESSOR`     | `VIDEO_PROCESSOR`      | Compatible video processor/light source | required     | Platform | equipment_tower        | —                   | FLEX_BRONCH_CORE@1.1       | **OWNER DECISION REQUIRED** |
| `SLOT-92874E31E1` | `SLOT-92874E31E1`                 | `ULTRASOUND_PROCESSOR` | Endoscopic ultrasound processor         | required     | Platform | equipment_tower        | —                   | EBUS_TBNA_SPECIFIC@1.0     | **OWNER DECISION REQUIRED** |
| `SLOT-B19121A5B9` | `SLOT-B19121A5B9`                 | `ULTRASOUND_CABLE`     | Compatible ultrasound cable             | required     | Platform | equipment_tower        | —                   | EBUS_TBNA_SPECIFIC@1.0     | **OWNER DECISION REQUIRED** |

### pre_induction_or_sedation

| Slot id           | Requirement key             | Role code         | Label                          | Requiredness | Section | Zone            | Dependency rule | Module@version       | responsibleRole             |
| ----------------- | --------------------------- | ----------------- | ------------------------------ | ------------ | ------- | --------------- | --------------- | -------------------- | --------------------------- |
| `SLOT-2E3065C976` | `FLEX_BRONCH_SUCTION_SETUP` | `GENERIC_SUCTION` | Suction source/tubing/syringes | required     | Suction | equipment_tower | —               | FLEX_BRONCH_CORE@1.1 | **OWNER DECISION REQUIRED** |

### airway_access

| Slot id           | Requirement key              | Role code                | Label                                     | Requiredness | Section           | Zone                   | Dependency rule                         | Module@version       | responsibleRole             |
| ----------------- | ---------------------------- | ------------------------ | ----------------------------------------- | ------------ | ----------------- | ---------------------- | --------------------------------------- | -------------------- | --------------------------- |
| `SLOT-D6B291DC80` | `FLEX_BRONCH_BITE_BLOCK`     | `BITE_BLOCK`             | Bite block                                | conditional  | Airway protection | mayo_stand             | Oral insertion without protected airway | FLEX_BRONCH_CORE@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-0306E7B77D` | `FLEX_BRONCH_AIRWAY_ADAPTER` | `GENERIC_AIRWAY_ADAPTER` | Airway adapter if mechanically ventilated | conditional  | Ventilation       | room_capital_equipment | Mechanically ventilated patient         | FLEX_BRONCH_CORE@1.1 | **OWNER DECISION REQUIRED** |

### diagnostic

| Slot id           | Requirement key   | Role code                | Label                         | Requiredness | Section         | Zone       | Dependency rule                           | Module@version         | responsibleRole             |
| ----------------- | ----------------- | ------------------------ | ----------------------------- | ------------ | --------------- | ---------- | ----------------------------------------- | ---------------------- | --------------------------- |
| `SLOT-1AF4BEFE3B` | `SLOT-1AF4BEFE3B` | `EBUS_NEEDLE_FNA`        | EBUS-TBNA FNA needle          | required     | Sampling        | back_table | —                                         | EBUS_TBNA_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-B83EBD2FBB` | `SLOT-B83EBD2FBB` | `EBUS_NEEDLE_FNB`        | EBUS FNB needle               | optional     | Sampling        | back_table | Histology/core biopsy desired             | EBUS_TBNA_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-D08C74941A` | `SLOT-D08C74941A` | `EBUS_MINIFORCEPS`       | Intranodal mini-forceps       | optional     | Sampling        | back_table | Miniforceps workflow selected             | EBUS_TBNA_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-E8F0B48B49` | `SLOT-E8F0B48B49` | `VACUUM_LOCKING_SYRINGE` | Vacuum-locking syringe        | optional     | Sampling        | back_table | —                                         | EBUS_TBNA_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-93655BF7C4` | `SLOT-93655BF7C4` | `EBUS_BALLOON`           | EBUS balloon                  | conditional  | Scope accessory | back_table | Balloon method used                       | EBUS_TBNA_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-CD12842559` | `SLOT-CD12842559` | `EBUS_NEEDLE_ADAPTER`    | Needle adapter / biopsy valve | conditional  | Scope accessory | back_table | Selected needle requires an adapter/valve | EBUS_TBNA_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### specimen_handling

| Slot id           | Requirement key   | Role code          | Label                                        | Requiredness | Section  | Zone             | Dependency rule            | Module@version         | responsibleRole             |
| ----------------- | ----------------- | ------------------ | -------------------------------------------- | ------------ | -------- | ---------------- | -------------------------- | ---------------------- | --------------------------- |
| `SLOT-12ACA27E54` | `SLOT-12ACA27E54` | `GENERIC_SPECIMEN` | Slides, cell-block, formalin/RPMI and labels | required     | Sampling | specimen_station | —                          | EBUS_TBNA_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-76F4405D68` | `SLOT-76F4405D68` | `SPECIMEN_TRAP`    | Airway wash/BAL trap                         | optional     | Sampling | specimen_station | Concurrent airway sampling | EBUS_TBNA_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

## EBV — Endobronchial valve placement (13 slots)

### pre_room

| Slot id           | Requirement key                     | Role code                | Label                             | Requiredness | Section  | Zone                   | Dependency rule     | Module@version              | responsibleRole             |
| ----------------- | ----------------------------------- | ------------------------ | --------------------------------- | ------------ | -------- | ---------------------- | ------------------- | --------------------------- | --------------------------- |
| `SLOT-F3BF1ECC7E` | `PROCEDURAL_FLUOROSCOPY_C_ARM`      | `FLUOROSCOPY_C_ARM`      | Fluoroscopy C-arm                 | conditional  | Imaging  | room_capital_equipment | Fluoroscopy planned | PROCEDURAL_FLUOROSCOPY@1.0  | **OWNER DECISION REQUIRED** |
| `SLOT-1D13D48BD7` | `PROCEDURAL_RADIATION_PROTECTION`   | `RADIATION_PROTECTION`   | Radiation protection              | conditional  | Imaging  | room_capital_equipment | Fluoroscopy planned | PROCEDURAL_FLUOROSCOPY@1.0  | **OWNER DECISION REQUIRED** |
| `SLOT-B79D3CF198` | `THERAPEUTIC_BRONCHOSCOPE_PLATFORM` | `FLEX_SCOPE_THERAPEUTIC` | Therapeutic bronchoscope          | required     | Platform | equipment_tower        | —                   | THERAPEUTIC_BRONCH_CORE@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-A24CA7DB72` | `SLOT-A24CA7DB72`                   | `VIDEO_PROCESSOR`        | Compatible processor/light source | required     | Platform | equipment_tower        | —                   | EBV_SPECIFIC@1.0            | **OWNER DECISION REQUIRED** |

### pre_induction_or_sedation

| Slot id           | Requirement key   | Role code         | Label         | Requiredness | Section | Zone            | Dependency rule | Module@version   | responsibleRole             |
| ----------------- | ----------------- | ----------------- | ------------- | ------------ | ------- | --------------- | --------------- | ---------------- | --------------------------- |
| `SLOT-D336807B69` | `SLOT-D336807B69` | `GENERIC_SUCTION` | Suction setup | required     | Suction | equipment_tower | —               | EBV_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### therapeutic

| Slot id           | Requirement key            | Role code                   | Label                         | Requiredness | Section   | Zone       | Dependency rule                                 | Module@version              | responsibleRole             |
| ----------------- | -------------------------- | --------------------------- | ----------------------------- | ------------ | --------- | ---------- | ----------------------------------------------- | --------------------------- | --------------------------- |
| `SLOT-B14DF27813` | `SLOT-B14DF27813`          | `EBV_VALVE`                 | Endobronchial valve(s)        | required     | Implant   | back_table | —                                               | EBV_SPECIFIC@1.0            | **OWNER DECISION REQUIRED** |
| `SLOT-D48FE87D5A` | `SLOT-D48FE87D5A`          | `EBV_DELIVERY_CATHETER`     | Valve deployment catheter     | required     | Implant   | back_table | —                                               | EBV_SPECIFIC@1.0            | **OWNER DECISION REQUIRED** |
| `SLOT-1647A73048` | `AIRWAY_RETRIEVAL_FORCEPS` | `FOREIGN_BODY_FORCEPS_FLEX` | Flexible grasping forceps     | conditional  | Retrieval | mayo_stand | Reposition/removal anticipated                  | THERAPEUTIC_BRONCH_CORE@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-639A3A4E14` | `SLOT-639A3A4E14`          | `EBV_SIZING_KIT`            | Valve sizing kit              | conditional  | Sizing    | back_table | Valve workflow requires manufacturer sizing kit | EBV_SPECIFIC@1.0            | **OWNER DECISION REQUIRED** |
| `SLOT-C657258C05` | `SLOT-C657258C05`          | `EBV_SIZING_BALLOON`        | Valve sizing balloon catheter | conditional  | Sizing    | back_table | Valve sizing performed                          | EBV_SPECIFIC@1.0            | **OWNER DECISION REQUIRED** |

### rescue_or_contingency

| Slot id           | Requirement key   | Role code               | Label                                | Requiredness | Section | Zone           | Dependency rule | Module@version   | responsibleRole             |
| ----------------- | ----------------- | ----------------------- | ------------------------------------ | ------------ | ------- | -------------- | --------------- | ---------------- | --------------------------- |
| `SLOT-030A408C27` | `SLOT-030A408C27` | `CHEST_TUBE_SMALL_BORE` | Chest tube kit immediately available | required     | Rescue  | emergency_cart | —               | EBV_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-022D0D3DC6` | `SLOT-022D0D3DC6` | `GENERIC_DRAINAGE_UNIT` | Chest drainage unit                  | required     | Rescue  | emergency_cart | —               | EBV_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### unassigned

| Slot id           | Requirement key   | Role code                       | Label                                               | Requiredness | Section    | Zone       | Dependency rule         | Module@version   | responsibleRole             |
| ----------------- | ----------------- | ------------------------------- | --------------------------------------------------- | ------------ | ---------- | ---------- | ----------------------- | ---------------- | --------------------------- |
| `SLOT-C4034E9595` | `SLOT-C4034E9595` | `COLLATERAL_VENTILATION_SYSTEM` | Collateral ventilation assessment platform/catheter | conditional  | Assessment | unassigned | Selected valve workflow | EBV_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

## FLEX_DIAGNOSTIC — Diagnostic flexible bronchoscopy (19 slots)

### pre_room

| Slot id           | Requirement key   | Role code                         | Label                           | Requiredness | Section  | Zone                   | Dependency rule            | Module@version               | responsibleRole             |
| ----------------- | ----------------- | --------------------------------- | ------------------------------- | ------------ | -------- | ---------------------- | -------------------------- | ---------------------------- | --------------------------- |
| `SLOT-15CBA5DCD0` | `SLOT-15CBA5DCD0` | `FLUOROSCOPY_C_ARM`               | Fluoroscopy C-arm               | conditional  | Imaging  | room_capital_equipment | Fluoroscopy planned        | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-7938FA701C` | `SLOT-7938FA701C` | `RADIATION_PROTECTION`            | Radiation protection            | conditional  | Imaging  | room_capital_equipment | Fluoroscopy planned        | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-37F5B1E3DF` | `SLOT-37F5B1E3DF` | `TOMOSYNTHESIS_NAVIGATION_SYSTEM` | Tomosynthesis navigation system | conditional  | Imaging  | room_capital_equipment | Peripheral lesion targeted | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-34A46FFBA2` | `SLOT-34A46FFBA2` | `FLEX_SCOPE_DIAGNOSTIC`           | Diagnostic bronchoscope         | required     | Platform | equipment_tower        | —                          | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-6BFE5046B8` | `SLOT-6BFE5046B8` | `VIDEO_PROCESSOR`                 | Compatible processor/display    | required     | Platform | equipment_tower        | —                          | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### pre_induction_or_sedation

| Slot id           | Requirement key   | Role code         | Label                   | Requiredness | Section | Zone            | Dependency rule | Module@version               | responsibleRole             |
| ----------------- | ----------------- | ----------------- | ----------------------- | ------------ | ------- | --------------- | --------------- | ---------------------------- | --------------------------- |
| `SLOT-49853F1B39` | `SLOT-49853F1B39` | `GENERIC_SUCTION` | Suction tubing/canister | required     | Suction | equipment_tower | —               | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### airway_access

| Slot id           | Requirement key   | Role code    | Label      | Requiredness | Section           | Zone       | Dependency rule                         | Module@version               | responsibleRole             |
| ----------------- | ----------------- | ------------ | ---------- | ------------ | ----------------- | ---------- | --------------------------------------- | ---------------------------- | --------------------------- |
| `SLOT-54D7E08779` | `SLOT-54D7E08779` | `BITE_BLOCK` | Bite block | conditional  | Airway protection | mayo_stand | Oral insertion without protected airway | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### diagnostic

| Slot id           | Requirement key   | Role code                | Label                        | Requiredness | Section           | Zone       | Dependency rule                             | Module@version               | responsibleRole             |
| ----------------- | ----------------- | ------------------------ | ---------------------------- | ------------ | ----------------- | ---------- | ------------------------------------------- | ---------------------------- | --------------------------- |
| `SLOT-7BFC6EB54E` | `SLOT-7BFC6EB54E` | `GUIDE_SHEATH_KIT`       | Peripheral guide-sheath kit  | optional     | Peripheral biopsy | back_table | Guide-sheath workflow planned               | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-09EF760638` | `SLOT-09EF760638` | `NAV_CATHETER_GUIDE`     | Peripheral guiding device    | optional     | Peripheral biopsy | back_table | Guiding-device workflow planned             | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-239938A6A9` | `SLOT-239938A6A9` | `RADIAL_EBUS_PROBE`      | Radial EBUS probe            | optional     | Peripheral biopsy | back_table | —                                           | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-C9A4F576D5` | `SLOT-C9A4F576D5` | `RADIAL_EBUS_DRIVE_UNIT` | Radial EBUS probe drive unit | conditional  | Peripheral biopsy | back_table | Required when RADIAL_EBUS_PROBE is selected | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### specimen_handling

| Slot id           | Requirement key   | Role code                  | Label                      | Requiredness | Section  | Zone             | Dependency rule  | Module@version               | responsibleRole             |
| ----------------- | ----------------- | -------------------------- | -------------------------- | ------------ | -------- | ---------------- | ---------------- | ---------------------------- | --------------------------- |
| `SLOT-F969CF31B0` | `SLOT-F969CF31B0` | `SPECIMEN_TRAP`            | BAL/wash specimen trap     | optional     | Sampling | specimen_station | BAL/wash planned | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-EFF8BA9B93` | `SLOT-EFF8BA9B93` | `BIOPSY_FORCEPS_FLEX`      | Biopsy forceps             | optional     | Sampling | specimen_station | Biopsy planned   | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-CD96ECF1DB` | `SLOT-CD96ECF1DB` | `CYTOLOGY_BRUSH`           | Cytology brush             | optional     | Sampling | specimen_station | Brushing planned | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-9363E589C4` | `SLOT-9363E589C4` | `TBNA_NEEDLE_CONVENTIONAL` | Conventional TBNA needle   | optional     | Sampling | specimen_station | TBNA planned     | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-6C8ED671CE` | `SLOT-6C8ED671CE` | `GENERIC_SPECIMEN`         | Specimen containers/labels | required     | Sampling | specimen_station | —                | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-4C2FE905D3` | `SLOT-4C2FE905D3` | `BAL_KIT`                  | BAL convenience tubing/kit | optional     | Sampling | specimen_station | —                | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### post_procedure

| Slot id           | Requirement key   | Role code                  | Label                                     | Requiredness | Section        | Zone       | Dependency rule                | Module@version               | responsibleRole             |
| ----------------- | ----------------- | -------------------------- | ----------------------------------------- | ------------ | -------------- | ---------- | ------------------------------ | ---------------------------- | --------------------------- |
| `SLOT-EA38AE186D` | `SLOT-EA38AE186D` | `BRONCH_REPROCESSING_KIT`  | Reusable scope pre-cleaning/transport kit | conditional  | Post-procedure | back_table | Reusable bronchoscope selected | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-EB37262191` | `SLOT-EB37262191` | `ENDOSCOPE_CLEANING_BRUSH` | Cleaning brush                            | conditional  | Post-procedure | back_table | Reusable bronchoscope selected | FLEX_DIAGNOSTIC_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

## ICU_BRONCH — ICU / bedside bronchoscopy (12 slots)

### pre_room

| Slot id           | Requirement key   | Role code               | Label                                 | Requiredness | Section           | Zone            | Dependency rule | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ----------------------- | ------------------------------------- | ------------ | ----------------- | --------------- | --------------- | ----------------------- | --------------------------- |
| `SLOT-1A3A9B71B1` | `SLOT-1A3A9B71B1` | `GENERIC_PPE`           | Procedure PPE                         | required     | Infection control | other           | —               | ICU_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-42AC1F18B2` | `SLOT-42AC1F18B2` | `FLEX_SCOPE_SINGLE_USE` | Bronchoscope (single-use or reusable) | required     | Platform          | equipment_tower | —               | ICU_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-7BAF2FC882` | `SLOT-7BAF2FC882` | `VIDEO_PROCESSOR`       | Compatible display/processor          | required     | Platform          | equipment_tower | —               | ICU_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### pre_induction_or_sedation

| Slot id           | Requirement key   | Role code         | Label                                | Requiredness | Section | Zone            | Dependency rule | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ----------------- | ------------------------------------ | ------------ | ------- | --------------- | --------------- | ----------------------- | --------------------------- |
| `SLOT-49FB14CBF6` | `SLOT-49FB14CBF6` | `GENERIC_SUCTION` | Suction source, tubing, and canister | required     | Suction | equipment_tower | —               | ICU_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### airway_access

| Slot id           | Requirement key   | Role code                | Label                              | Requiredness | Section     | Zone                   | Dependency rule | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ------------------------ | ---------------------------------- | ------------ | ----------- | ---------------------- | --------------- | ----------------------- | --------------------------- |
| `SLOT-B6ED05FBC7` | `SLOT-B6ED05FBC7` | `GENERIC_AIRWAY_ADAPTER` | Bronchoscopy swivel/airway adapter | required     | Ventilation | room_capital_equipment | —               | ICU_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### therapeutic

| Slot id           | Requirement key   | Role code                   | Label                     | Requiredness | Section   | Zone       | Dependency rule                         | Module@version          | responsibleRole             |
| ----------------- | ----------------- | --------------------------- | ------------------------- | ------------ | --------- | ---------- | --------------------------------------- | ----------------------- | --------------------------- |
| `SLOT-53400A7A7C` | `SLOT-53400A7A7C` | `FOREIGN_BODY_FORCEPS_FLEX` | Flexible grasping forceps | conditional  | Retrieval | mayo_stand | Mucus plug/foreign material anticipated | ICU_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### specimen_handling

| Slot id           | Requirement key   | Role code             | Label                                     | Requiredness | Section  | Zone             | Dependency rule  | Module@version          | responsibleRole             |
| ----------------- | ----------------- | --------------------- | ----------------------------------------- | ------------ | -------- | ---------------- | ---------------- | ----------------------- | --------------------------- |
| `SLOT-8790F5F0AE` | `SLOT-8790F5F0AE` | `SPECIMEN_TRAP`       | BAL/wash specimen trap                    | required     | Sampling | specimen_station | —                | ICU_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-5D918DA83D` | `SLOT-5D918DA83D` | `GENERIC_SPECIMEN`    | Lab containers, labels, and transport bag | required     | Sampling | specimen_station | —                | ICU_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-B138BA994E` | `SLOT-B138BA994E` | `BIOPSY_FORCEPS_FLEX` | Biopsy forceps                            | optional     | Sampling | specimen_station | Planned biopsy   | ICU_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-4CC66ADF82` | `SLOT-4CC66ADF82` | `CYTOLOGY_BRUSH`      | Cytology or microbiology brush            | optional     | Sampling | specimen_station | Planned brushing | ICU_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-63E328321A` | `SLOT-63E328321A` | `BAL_KIT`             | BAL convenience tubing/kit                | optional     | Sampling | specimen_station | —                | ICU_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### post_procedure

| Slot id           | Requirement key   | Role code                 | Label                                             | Requiredness | Section        | Zone       | Dependency rule                | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ------------------------- | ------------------------------------------------- | ------------ | -------------- | ---------- | ------------------------------ | ----------------------- | --------------------------- |
| `SLOT-3BE665D0CA` | `SLOT-3BE665D0CA` | `BRONCH_REPROCESSING_KIT` | Reusable scope bedside pre-cleaning/transport kit | conditional  | Post-procedure | back_table | Reusable bronchoscope selected | ICU_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

## IPC_PLACEMENT — Tunneled indwelling pleural catheter placement (8 slots)

### pre_room

| Slot id           | Requirement key              | Role code            | Label                                      | Requiredness | Section | Zone                   | Dependency rule | Module@version             | responsibleRole             |
| ----------------- | ---------------------------- | -------------------- | ------------------------------------------ | ------------ | ------- | ---------------------- | --------------- | -------------------------- | --------------------------- |
| `SLOT-E91A13EE9E` | `PLEURAL_ULTRASOUND_MACHINE` | `GENERIC_ULTRASOUND` | Ultrasound machine and sterile probe cover | required     | Imaging | room_capital_equipment | —               | PLEURAL_PROCEDURE_CORE@1.0 | **OWNER DECISION REQUIRED** |

### pre_induction_or_sedation

| Slot id           | Requirement key   | Role code          | Label                       | Requiredness | Section  | Zone            | Dependency rule | Module@version             | responsibleRole             |
| ----------------- | ----------------- | ------------------ | --------------------------- | ------------ | -------- | --------------- | --------------- | -------------------------- | --------------------------- |
| `SLOT-3FBC244FAF` | `SLOT-3FBC244FAF` | `IPC_DRAINAGE_KIT` | Compatible IPC drainage kit | required     | Drainage | equipment_tower | —               | IPC_PLACEMENT_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-27D1A61598` | `SLOT-27D1A61598` | `GENERIC_SUCTION`  | Initial drainage connection | required     | Drainage | equipment_tower | —               | IPC_PLACEMENT_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### therapeutic

| Slot id           | Requirement key   | Role code           | Label                                     | Requiredness | Section         | Zone          | Dependency rule | Module@version             | responsibleRole             |
| ----------------- | ----------------- | ------------------- | ----------------------------------------- | ------------ | --------------- | ------------- | --------------- | -------------------------- | --------------------------- |
| `SLOT-1BCF3D0702` | `SLOT-1BCF3D0702` | `IPC_INSERTION_KIT` | Indwelling pleural catheter insertion kit | required     | Catheter system | sterile_field | —               | IPC_PLACEMENT_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### specimen_handling

| Slot id           | Requirement key   | Role code          | Label                                        | Requiredness | Section  | Zone             | Dependency rule | Module@version             | responsibleRole             |
| ----------------- | ----------------- | ------------------ | -------------------------------------------- | ------------ | -------- | ---------------- | --------------- | -------------------------- | --------------------------- |
| `SLOT-CA2DF6D3A0` | `SLOT-CA2DF6D3A0` | `GENERIC_SPECIMEN` | Pleural fluid specimen containers and labels | conditional  | Sampling | specimen_station | —               | IPC_PLACEMENT_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### post_procedure

| Slot id           | Requirement key   | Role code             | Label                                                 | Requiredness | Section        | Zone       | Dependency rule | Module@version             | responsibleRole             |
| ----------------- | ----------------- | --------------------- | ----------------------------------------------------- | ------------ | -------------- | ---------- | --------------- | -------------------------- | --------------------------- |
| `SLOT-6693BCAEE1` | `SLOT-6693BCAEE1` | `IPC_DRESSING_KIT`    | Compatible IPC dressing kit                           | required     | Dressing       | back_table | —               | IPC_PLACEMENT_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-01010CB364` | `SLOT-01010CB364` | `DRESSING_SECUREMENT` | Securement, dressing, and patient education materials | required     | Post-procedure | back_table | —               | IPC_PLACEMENT_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### unassigned

| Slot id           | Requirement key   | Role code                  | Label                      | Requiredness | Section     | Zone       | Dependency rule | Module@version             | responsibleRole             |
| ----------------- | ----------------- | -------------------------- | -------------------------- | ------------ | ----------- | ---------- | --------------- | -------------------------- | --------------------------- |
| `SLOT-1E91C231E5` | `SLOT-1E91C231E5` | `IPC_MANAGEMENT_ACCESSORY` | IPC management accessories | conditional  | Accessories | unassigned | —               | IPC_PLACEMENT_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

## MED_THORACOSCOPY — Medical thoracoscopy / pleuroscopy (20 slots)

### pre_room

| Slot id           | Requirement key              | Role code                | Label                                      | Requiredness | Section       | Zone                   | Dependency rule | Module@version                | responsibleRole             |
| ----------------- | ---------------------------- | ------------------------ | ------------------------------------------ | ------------ | ------------- | ---------------------- | --------------- | ----------------------------- | --------------------------- |
| `SLOT-E91A13EE9E` | `PLEURAL_ULTRASOUND_MACHINE` | `GENERIC_ULTRASOUND`     | Ultrasound machine and sterile probe cover | required     | Imaging       | room_capital_equipment | —               | PLEURAL_PROCEDURE_CORE@1.0    | **OWNER DECISION REQUIRED** |
| `SLOT-5A9EDD575F` | `SLOT-5A9EDD575F`            | `THORACOSCOPE_SEMIRIGID` | Pleuroscope                                | required     | Platform      | equipment_tower        | —               | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-3CA143BB11` | `SLOT-3CA143BB11`            | `VIDEO_PROCESSOR`        | Compatible processor/light source          | required     | Platform      | equipment_tower        | —               | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-694FCE203D` | `SLOT-694FCE203D`            | `CO2_INSUFFLATOR`        | CO2 insufflation/regulation unit           | conditional  | Platform      | equipment_tower        | —               | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-E63DC64C2F` | `SLOT-E63DC64C2F`            | `THORACOSCOPE_RIGID`     | Thoracoscopy telescope                     | required     | Visualization | equipment_tower        | —               | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-6D737D1334` | `SLOT-6D737D1334`            | `ENDOSCOPY_LIGHT_CABLE`  | Fiber-optic light cable                    | required     | Visualization | equipment_tower        | —               | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### pre_induction_or_sedation

| Slot id           | Requirement key   | Role code               | Label                                      | Requiredness | Section  | Zone            | Dependency rule       | Module@version                | responsibleRole             |
| ----------------- | ----------------- | ----------------------- | ------------------------------------------ | ------------ | -------- | --------------- | --------------------- | ----------------------------- | --------------------------- |
| `SLOT-57CA4B1298` | `SLOT-57CA4B1298` | `CHEST_TUBE_SMALL_BORE` | Post-procedure chest tube                  | required     | Drainage | equipment_tower | —                     | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-AA3C2EAA6D` | `SLOT-AA3C2EAA6D` | `GENERIC_DRAINAGE_UNIT` | Chest drainage unit and suction connection | required     | Drainage | equipment_tower | —                     | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-9A1C0491F9` | `SLOT-9A1C0491F9` | `IPC_INSERTION_KIT`     | Indwelling pleural catheter kit            | optional     | Drainage | equipment_tower | IPC placement planned | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### airway_access

| Slot id           | Requirement key   | Role code               | Label                      | Requiredness | Section          | Zone            | Dependency rule | Module@version                | responsibleRole             |
| ----------------- | ----------------- | ----------------------- | -------------------------- | ------------ | ---------------- | --------------- | --------------- | ----------------------------- | --------------------------- |
| `SLOT-9448C2A991` | `SLOT-9448C2A991` | `THORACOSCOPY_TROCAR`   | Pleuroscopy trocar/cannula | required     | Access           | sterile_field   | —               | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-99F995A756` | `SLOT-99F995A756` | `ENDOBRONCHIAL_BLOCKER` | Endobronchial blocker      | conditional  | Airway isolation | equipment_tower | —               | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### therapeutic

| Slot id           | Requirement key   | Role code                | Label                                      | Requiredness | Section            | Zone            | Dependency rule                                 | Module@version                | responsibleRole             |
| ----------------- | ----------------- | ------------------------ | ------------------------------------------ | ------------ | ------------------ | --------------- | ----------------------------------------------- | ----------------------------- | --------------------------- |
| `SLOT-8FC90750FF` | `SLOT-8FC90750FF` | `THORACOSCOPY_ELECTRODE` | Thoracoscopy hook or coagulation electrode | conditional  | Energy             | equipment_tower | Adhesiolysis or surface haemostasis anticipated | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-51A2592738` | `SLOT-51A2592738` | `ENERGY_PLATFORM`        | Electrosurgical generator                  | conditional  | Energy             | equipment_tower | Thoracoscopy electrode selected                 | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-65FFA3703B` | `SLOT-65FFA3703B` | `THORACOSCOPY_SCISSORS`  | Thoracoscopy scissors                      | optional     | Instrumentation    | back_table      | —                                               | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-0037091804` | `SLOT-0037091804` | `THORACOSCOPY_PROBE`     | Thoracoscopy surgical probe                | optional     | Instrumentation    | back_table      | —                                               | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-1D10D8A2BF` | `SLOT-1D10D8A2BF` | `TALC_POUDRAGE_KIT`      | Talc poudrage delivery kit                 | conditional  | Pleurodesis        | back_table      | Poudrage planned                                | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-0B24E5F37A` | `SLOT-0B24E5F37A` | `TALC_VIAL`              | Sterile talc vial                          | conditional  | Pleurodesis        | back_table      | Talc pleurodesis planned                        | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-D8D781E494` | `SLOT-D8D781E494` | `GENERIC_SUCTION`        | Suction/irrigation tubing and canisters    | required     | Suction/irrigation | equipment_tower | —                                               | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### specimen_handling

| Slot id           | Requirement key   | Role code                     | Label                                  | Requiredness | Section  | Zone             | Dependency rule | Module@version                | responsibleRole             |
| ----------------- | ----------------- | ----------------------------- | -------------------------------------- | ------------ | -------- | ---------------- | --------------- | ----------------------------- | --------------------------- |
| `SLOT-545818F1DC` | `SLOT-545818F1DC` | `THORACOSCOPY_BIOPSY_FORCEPS` | Pleural biopsy forceps                 | required     | Sampling | specimen_station | —               | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-BC9CCE1853` | `SLOT-BC9CCE1853` | `GENERIC_SPECIMEN`            | Formalin/sterile containers and labels | required     | Sampling | specimen_station | —               | MED_THORACOSCOPY_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

## PERC_TRACH — Percutaneous dilational tracheostomy (10 slots)

### pre_room

| Slot id           | Requirement key   | Role code            | Label                                      | Requiredness | Section | Zone                   | Dependency rule                        | Module@version          | responsibleRole             |
| ----------------- | ----------------- | -------------------- | ------------------------------------------ | ------------ | ------- | ---------------------- | -------------------------------------- | ----------------------- | --------------------------- |
| `SLOT-C629C55E61` | `SLOT-C629C55E61` | `GENERIC_ULTRASOUND` | Ultrasound machine and sterile probe cover | optional     | Imaging | room_capital_equipment | Ultrasound-guided site assessment used | PERC_TRACH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### pre_induction_or_sedation

| Slot id           | Requirement key   | Role code         | Label                                | Requiredness | Section       | Zone            | Dependency rule | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ----------------- | ------------------------------------ | ------------ | ------------- | --------------- | --------------- | ----------------------- | --------------------------- |
| `SLOT-09D5542BAA` | `SLOT-09D5542BAA` | `PERC_TRACH_KIT`  | Percutaneous tracheostomy kit/tray   | required     | Procedure kit | sterile_field   | —               | PERC_TRACH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-657F12A89F` | `SLOT-657F12A89F` | `GENERIC_SUCTION` | Suction tubing/canister and catheter | required     | Suction       | equipment_tower | —               | PERC_TRACH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### airway_access

| Slot id           | Requirement key   | Role code                | Label                                       | Requiredness | Section     | Zone                   | Dependency rule | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ------------------------ | ------------------------------------------- | ------------ | ----------- | ---------------------- | --------------- | ----------------------- | --------------------------- |
| `SLOT-BC6864D752` | `SLOT-BC6864D752` | `GENERIC_AIRWAY_ADAPTER` | Bronchoscopy swivel and ventilation adapter | required     | Ventilation | room_capital_equipment | —               | PERC_TRACH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### diagnostic

| Slot id           | Requirement key   | Role code               | Label                                  | Requiredness | Section      | Zone            | Dependency rule | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ----------------------- | -------------------------------------- | ------------ | ------------ | --------------- | --------------- | ----------------------- | --------------------------- |
| `SLOT-658CF18CF0` | `SLOT-658CF18CF0` | `FLEX_SCOPE_SINGLE_USE` | Slim/regular bronchoscope for guidance | required     | Bronchoscopy | equipment_tower | —               | PERC_TRACH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-2C4CF749E6` | `SLOT-2C4CF749E6` | `VIDEO_PROCESSOR`       | Compatible display/processor           | required     | Bronchoscopy | equipment_tower | —               | PERC_TRACH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### therapeutic

| Slot id           | Requirement key   | Role code           | Label                                       | Requiredness | Section | Zone          | Dependency rule            | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ------------------- | ------------------------------------------- | ------------ | ------- | ------------- | -------------------------- | ----------------------- | --------------------------- |
| `SLOT-6EAB7FD727` | `SLOT-6EAB7FD727` | `TRACH_TUBE_CUFFED` | Primary cuffed tracheostomy tube            | required     | Tube    | sterile_field | —                          | PERC_TRACH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-738A987A4C` | `SLOT-738A987A4C` | `TRACH_TUBE_EVAC`   | Subglottic-suction tracheostomy tube        | optional     | Tube    | sterile_field | Subglottic suction desired | PERC_TRACH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-32739F7002` | `SLOT-32739F7002` | `TRACH_TUBE_CUFFED` | Backup tracheostomy tube - one size smaller | required     | Tube    | sterile_field | —                          | PERC_TRACH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### post_procedure

| Slot id           | Requirement key   | Role code             | Label                                                  | Requiredness | Section        | Zone       | Dependency rule | Module@version          | responsibleRole             |
| ----------------- | ----------------- | --------------------- | ------------------------------------------------------ | ------------ | -------------- | ---------- | --------------- | ----------------------- | --------------------------- |
| `SLOT-126F71E1BD` | `SLOT-126F71E1BD` | `DRESSING_SECUREMENT` | Tube labels, securement, dressing, and bedside signage | required     | Post-procedure | back_table | —               | PERC_TRACH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

## PHOTODYNAMIC_THERAPY — Photodynamic therapy (endobronchial) (12 slots)

### pre_room

| Slot id           | Requirement key   | Role code                      | Label                | Requiredness | Section         | Zone  | Dependency rule | Module@version                    | responsibleRole             |
| ----------------- | ----------------- | ------------------------------ | -------------------- | ------------ | --------------- | ----- | --------------- | --------------------------------- | --------------------------- |
| `SLOT-8A0CAE91FF` | `SLOT-8A0CAE91FF` | `PHOTODYNAMIC_PHOTOSENSITIZER` | Photosensitizer dose | required     | Photosensitizer | other | —               | PHOTODYNAMIC_THERAPY_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### therapeutic

| Slot id           | Requirement key   | Role code               | Label                                 | Requiredness | Section          | Zone            | Dependency rule | Module@version                    | responsibleRole             |
| ----------------- | ----------------- | ----------------------- | ------------------------------------- | ------------ | ---------------- | --------------- | --------------- | --------------------------------- | --------------------------- |
| `SLOT-C6B7BC56B1` | `SLOT-C6B7BC56B1` | `FLEX_SCOPE_DIAGNOSTIC` | Bronchoscope for light delivery       | required     | Light activation | equipment_tower | —               | PHOTODYNAMIC_THERAPY_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-63B9691422` | `SLOT-63B9691422` | `VIDEO_PROCESSOR`       | Compatible processor and light source | required     | Light activation | equipment_tower | —               | PHOTODYNAMIC_THERAPY_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-0C667F3D98` | `SLOT-0C667F3D98` | `PHOTODYNAMIC_LASER`    | Activation laser                      | required     | Light activation | equipment_tower | —               | PHOTODYNAMIC_THERAPY_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-395F6BD985` | `SLOT-395F6BD985` | `PHOTODYNAMIC_DIFFUSER` | Cylindrical light diffuser            | required     | Light activation | equipment_tower | —               | PHOTODYNAMIC_THERAPY_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-B0F3DFF86F` | `SLOT-B0F3DFF86F` | `BITE_BLOCK`            | Bite block                            | required     | Light activation | equipment_tower | —               | PHOTODYNAMIC_THERAPY_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-5D4FC2EC83` | `SLOT-5D4FC2EC83` | `GENERIC_SUCTION`       | Suction setup                         | required     | Light activation | equipment_tower | —               | PHOTODYNAMIC_THERAPY_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### post_procedure

| Slot id           | Requirement key   | Role code                   | Label                        | Requiredness | Section     | Zone       | Dependency rule            | Module@version                    | responsibleRole             |
| ----------------- | ----------------- | --------------------------- | ---------------------------- | ------------ | ----------- | ---------- | -------------------------- | --------------------------------- | --------------------------- |
| `SLOT-715F112605` | `SLOT-715F112605` | `FLEX_SCOPE_THERAPEUTIC`    | Bronchoscope for debridement | required     | Debridement | back_table | —                          | PHOTODYNAMIC_THERAPY_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-BE2DEBB4E7` | `SLOT-BE2DEBB4E7` | `FOREIGN_BODY_FORCEPS_FLEX` | Debridement forceps          | conditional  | Debridement | back_table | Obstructing slough present | PHOTODYNAMIC_THERAPY_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-2EF6D51123` | `SLOT-2EF6D51123` | `CRYOPROBE_FLEX`            | Cryoprobe for debridement    | conditional  | Debridement | back_table | Cryo debridement planned   | PHOTODYNAMIC_THERAPY_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-EADB8A307E` | `SLOT-EADB8A307E` | `GENERIC_SPECIMEN`          | Specimen containers          | conditional  | Debridement | back_table | Tissue sent for analysis   | PHOTODYNAMIC_THERAPY_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-543A73947E` | `SLOT-543A73947E` | `RIGID_BRONCHOSCOPE_BARREL` | Rigid barrel on standby      | conditional  | Debridement | back_table | Central airway lesion      | PHOTODYNAMIC_THERAPY_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

## RIGID_BRONCH — Rigid bronchoscopy (31 slots)

### pre_room

| Slot id           | Requirement key   | Role code                | Label                                      | Requiredness | Section       | Zone                   | Dependency rule     | Module@version            | responsibleRole             |
| ----------------- | ----------------- | ------------------------ | ------------------------------------------ | ------------ | ------------- | ---------------------- | ------------------- | ------------------------- | --------------------------- |
| `SLOT-A575600E20` | `SLOT-A575600E20` | `FLUOROSCOPY_C_ARM`      | Fluoroscopy C-arm                          | conditional  | Imaging       | room_capital_equipment | Fluoroscopy planned | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-E8965CB331` | `SLOT-E8965CB331` | `RADIATION_PROTECTION`   | Radiation protection                       | conditional  | Imaging       | room_capital_equipment | Fluoroscopy planned | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-6BDDC6260B` | `SLOT-6BDDC6260B` | `VIDEO_PROCESSOR`        | Camera/light/processor platform            | required     | Visualization | equipment_tower        | —                   | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-94783C387D` | `SLOT-94783C387D` | `FLEX_SCOPE_THERAPEUTIC` | Flexible bronchoscope through rigid barrel | optional     | Visualization | equipment_tower        | —                   | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-19FC83049A` | `SLOT-19FC83049A` | `RIGID_TELESCOPE`        | Rigid telescope                            | required     | Visualization | equipment_tower        | —                   | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-72BAE3EC7C` | `SLOT-72BAE3EC7C` | `ENDOSCOPY_LIGHT_CABLE`  | Fiber-optic light cable                    | required     | Visualization | equipment_tower        | —                   | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### pre_induction_or_sedation

| Slot id           | Requirement key   | Role code                | Label                  | Requiredness | Section | Zone            | Dependency rule | Module@version            | responsibleRole             |
| ----------------- | ----------------- | ------------------------ | ---------------------- | ------------ | ------- | --------------- | --------------- | ------------------------- | --------------------------- |
| `SLOT-2D59E32F4B` | `SLOT-2D59E32F4B` | `RIGID_SUCTION_CATHETER` | Rigid suction catheter | required     | Suction | equipment_tower | —               | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### airway_access

| Slot id           | Requirement key   | Role code                      | Label                                            | Requiredness | Section           | Zone            | Dependency rule                                       | Module@version            | responsibleRole             |
| ----------------- | ----------------- | ------------------------------ | ------------------------------------------------ | ------------ | ----------------- | --------------- | ----------------------------------------------------- | ------------------------- | --------------------------- |
| `SLOT-678712810C` | `SLOT-678712810C` | `LASER_RESISTANT_ETT`          | Laser-resistant endotracheal tube                | conditional  | Airway protection | mayo_stand      | Laser planned with an indwelling tube or tracheostomy | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-04C940D8B9` | `SLOT-04C940D8B9` | `RIGID_BRONCHOSCOPE_HEAD`      | Rigid bronchoscope head/base                     | required     | Rigid system      | equipment_tower | —                                                     | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-113FCB30ED` | `SLOT-113FCB30ED` | `RIGID_BRONCHOSCOPE_BARREL`    | Rigid tracheoscope/bronchoscope tubes            | required     | Rigid system      | equipment_tower | —                                                     | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-175CA9F5B4` | `SLOT-175CA9F5B4` | `RIGID_BRONCHOSCOPE_ACCESSORY` | Ventilation element, jet cannula, ports and caps | required     | Rigid system      | equipment_tower | —                                                     | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### therapeutic

| Slot id           | Requirement key   | Role code                         | Label                                       | Requiredness | Section         | Zone            | Dependency rule                                          | Module@version            | responsibleRole             |
| ----------------- | ----------------- | --------------------------------- | ------------------------------------------- | ------------ | --------------- | --------------- | -------------------------------------------------------- | ------------------------- | --------------------------- |
| `SLOT-00E8CCAE2A` | `SLOT-00E8CCAE2A` | `CRYOPROBE_FLEX`                  | Cryoprobe/system                            | conditional  | Cryotherapy     | equipment_tower | Cryotherapy planned                                      | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-D6219069A9` | `SLOT-D6219069A9` | `CRYO_SYSTEM_ACCESSORY`           | Cryosurgery platform accessories            | conditional  | Cryotherapy     | equipment_tower | Cryotherapy planned                                      | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-3D6358F157` | `SLOT-3D6358F157` | `AIRWAY_BALLOON_DILATOR`          | Balloon dilator                             | optional     | Dilation        | back_table      | —                                                        | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-C2EF0C350D` | `SLOT-C2EF0C350D` | `ENERGY_PLATFORM`                 | Energy/hemostasis platform and rigid probes | conditional  | Energy          | equipment_tower | Thermal modality planned                                 | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-18617846CD` | `SLOT-18617846CD` | `APC_APPLICATOR_RIGID`            | Rigid or malleable APC applicator           | conditional  | Energy          | equipment_tower | Rigid APC planned                                        | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-8AA6269352` | `SLOT-8AA6269352` | `ENERGY_CABLE_ADAPTER`            | Energy cable / adapter                      | conditional  | Energy          | equipment_tower | Selected energy device requires a separate cable/adapter | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-E8281AFEA1` | `SLOT-E8281AFEA1` | `APC_GAS_ACCESSORY`               | APC gas-system accessories                  | conditional  | Energy          | equipment_tower | Rigid APC planned                                        | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-3C8165659D` | `SLOT-3C8165659D` | `RIGID_BIPOLAR_FORCEPS`           | Rigid bipolar forceps system                | conditional  | Energy          | equipment_tower | —                                                        | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-A602F949A7` | `SLOT-A602F949A7` | `LASER_CONSOLE`                   | Surgical laser console                      | conditional  | Energy          | equipment_tower | Laser planned                                            | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-35ACE7FDA1` | `SLOT-35ACE7FDA1` | `LASER_FIBER`                     | Laser delivery fibre                        | conditional  | Energy          | equipment_tower | Laser planned                                            | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-CD2D51CF8D` | `SLOT-CD2D51CF8D` | `LASER_SAFETY_EQUIPMENT`          | Laser safety equipment                      | conditional  | Energy          | equipment_tower | Laser planned                                            | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-BC936B7BD8` | `SLOT-BC936B7BD8` | `RIGID_FORCEPS`                   | Rigid forceps/shaft/head set                | required     | Instrumentation | back_table      | —                                                        | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-66C8ADA940` | `SLOT-66C8ADA940` | `RIGID_BRONCH_SHAVER`             | Rigid bronchoscopic shaver system           | conditional  | Instrumentation | back_table      | —                                                        | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-140B672D52` | `SLOT-140B672D52` | `FOREIGN_BODY_FORCEPS_FLEX`       | Flexible retrieval forceps/basket           | optional     | Retrieval       | mayo_stand      | —                                                        | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-5F3642C851` | `SLOT-5F3642C851` | `AIRWAY_STENT_SILICONE_STRAIGHT`  | Straight silicone stent(s)                  | conditional  | Stent           | back_table      | Silicone stenting planned                                | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-D6B6FF156F` | `SLOT-D6B6FF156F` | `AIRWAY_STENT_SILICONE_Y`         | Silicone Y stent                            | conditional  | Stent           | back_table      | Y-stent planned                                          | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-6A75E6D661` | `SLOT-6A75E6D661` | `AIRWAY_STENT_SILICONE_HOURGLASS` | Hourglass silicone stent                    | conditional  | Stent           | back_table      | Hourglass stent planned                                  | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-3FFB2D272E` | `SLOT-3FFB2D272E` | `STENT_APPLICATOR`                | Silicone stent applicator/loading system    | conditional  | Stent           | back_table      | Silicone stent planned                                   | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-99199F9B11` | `SLOT-99199F9B11` | `AIRWAY_STENT_SEMS_COVERED`       | Covered SEMS                                | optional     | Stent           | back_table      | —                                                        | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-702FD644B7` | `SLOT-702FD644B7` | `AIRWAY_STENT_SIZING_DEVICE`      | Airway stent sizing device                  | optional     | Stent           | back_table      | —                                                        | RIGID_BRONCH_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

## TB_RULEOUT — TB rule-out bronchoscopy (11 slots)

### pre_room

| Slot id           | Requirement key   | Role code               | Label                               | Requiredness | Section   | Zone            | Dependency rule | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ----------------------- | ----------------------------------- | ------------ | --------- | --------------- | --------------- | ----------------------- | --------------------------- |
| `SLOT-C46D25AF46` | `SLOT-C46D25AF46` | `GENERIC_PPE`           | Airborne-isolation PPE              | required     | Isolation | other           | —               | TB_RULEOUT_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-0F96B1FA45` | `SLOT-0F96B1FA45` | `FLEX_SCOPE_SINGLE_USE` | Bronchoscope for isolation workflow | required     | Platform  | equipment_tower | —               | TB_RULEOUT_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-A19D105581` | `SLOT-A19D105581` | `VIDEO_PROCESSOR`       | Compatible display/processor        | required     | Platform  | equipment_tower | —               | TB_RULEOUT_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### pre_induction_or_sedation

| Slot id           | Requirement key   | Role code         | Label                              | Requiredness | Section | Zone            | Dependency rule | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ----------------- | ---------------------------------- | ------------ | ------- | --------------- | --------------- | ----------------------- | --------------------------- |
| `SLOT-2943D859CB` | `SLOT-2943D859CB` | `GENERIC_SUCTION` | Closed suction tubing and canister | required     | Suction | equipment_tower | —               | TB_RULEOUT_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### airway_access

| Slot id           | Requirement key   | Role code                | Label                                     | Requiredness | Section     | Zone                   | Dependency rule                 | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ------------------------ | ----------------------------------------- | ------------ | ----------- | ---------------------- | ------------------------------- | ----------------------- | --------------------------- |
| `SLOT-763A2D63F1` | `SLOT-763A2D63F1` | `GENERIC_AIRWAY_ADAPTER` | Airway adapter if mechanically ventilated | conditional  | Ventilation | room_capital_equipment | Mechanically ventilated patient | TB_RULEOUT_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### specimen_handling

| Slot id           | Requirement key   | Role code             | Label                                                     | Requiredness | Section  | Zone             | Dependency rule              | Module@version          | responsibleRole             |
| ----------------- | ----------------- | --------------------- | --------------------------------------------------------- | ------------ | -------- | ---------------- | ---------------------------- | ----------------------- | --------------------------- |
| `SLOT-46FDDCCF7C` | `SLOT-46FDDCCF7C` | `SPECIMEN_TRAP`       | BAL/wash specimen trap                                    | required     | Sampling | specimen_station | —                            | TB_RULEOUT_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-D73F3C8E6D` | `SLOT-D73F3C8E6D` | `GENERIC_SPECIMEN`    | AFB/microbiology containers, labels, and sealed transport | required     | Sampling | specimen_station | —                            | TB_RULEOUT_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-2E7FF49D2D` | `SLOT-2E7FF49D2D` | `CYTOLOGY_BRUSH`      | Protected microbiology/cytology brush                     | optional     | Sampling | specimen_station | Additional diagnostic target | TB_RULEOUT_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-05F71417F2` | `SLOT-05F71417F2` | `BIOPSY_FORCEPS_FLEX` | Biopsy forceps                                            | optional     | Sampling | specimen_station | Additional diagnosis pursued | TB_RULEOUT_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-9029673D34` | `SLOT-9029673D34` | `BAL_KIT`             | BAL convenience tubing/kit                                | optional     | Sampling | specimen_station | —                            | TB_RULEOUT_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### post_procedure

| Slot id           | Requirement key   | Role code                 | Label                                     | Requiredness | Section        | Zone       | Dependency rule                | Module@version          | responsibleRole             |
| ----------------- | ----------------- | ------------------------- | ----------------------------------------- | ------------ | -------------- | ---------- | ------------------------------ | ----------------------- | --------------------------- |
| `SLOT-313877F69F` | `SLOT-313877F69F` | `BRONCH_REPROCESSING_KIT` | Reusable scope pre-cleaning/transport kit | conditional  | Post-procedure | back_table | Reusable bronchoscope selected | TB_RULEOUT_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

## THERAPEUTIC_BRONCH — Therapeutic flexible bronchoscopy (30 slots)

### pre_room

| Slot id           | Requirement key                     | Role code                         | Label                                   | Requiredness | Section  | Zone                   | Dependency rule            | Module@version                  | responsibleRole             |
| ----------------- | ----------------------------------- | --------------------------------- | --------------------------------------- | ------------ | -------- | ---------------------- | -------------------------- | ------------------------------- | --------------------------- |
| `SLOT-F3BF1ECC7E` | `PROCEDURAL_FLUOROSCOPY_C_ARM`      | `FLUOROSCOPY_C_ARM`               | Fluoroscopy C-arm                       | conditional  | Imaging  | room_capital_equipment | Fluoroscopy planned        | PROCEDURAL_FLUOROSCOPY@1.0      | **OWNER DECISION REQUIRED** |
| `SLOT-1D13D48BD7` | `PROCEDURAL_RADIATION_PROTECTION`   | `RADIATION_PROTECTION`            | Radiation protection                    | conditional  | Imaging  | room_capital_equipment | Fluoroscopy planned        | PROCEDURAL_FLUOROSCOPY@1.0      | **OWNER DECISION REQUIRED** |
| `SLOT-38E5FB60B9` | `SLOT-38E5FB60B9`                   | `TOMOSYNTHESIS_NAVIGATION_SYSTEM` | Tomosynthesis navigation system         | conditional  | Imaging  | room_capital_equipment | Peripheral lesion targeted | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-B79D3CF198` | `THERAPEUTIC_BRONCHOSCOPE_PLATFORM` | `FLEX_SCOPE_THERAPEUTIC`          | Therapeutic bronchoscope                | required     | Platform | equipment_tower        | —                          | THERAPEUTIC_BRONCH_CORE@1.0     | **OWNER DECISION REQUIRED** |
| `SLOT-7DFA66EA2D` | `FLEX_BRONCH_VIDEO_PROCESSOR`       | `VIDEO_PROCESSOR`                 | Compatible video processor/light source | required     | Platform | equipment_tower        | —                          | FLEX_BRONCH_CORE@1.1            | **OWNER DECISION REQUIRED** |

### pre_induction_or_sedation

| Slot id           | Requirement key             | Role code         | Label                          | Requiredness | Section | Zone            | Dependency rule | Module@version       | responsibleRole             |
| ----------------- | --------------------------- | ----------------- | ------------------------------ | ------------ | ------- | --------------- | --------------- | -------------------- | --------------------------- |
| `SLOT-2E3065C976` | `FLEX_BRONCH_SUCTION_SETUP` | `GENERIC_SUCTION` | Suction source/tubing/syringes | required     | Suction | equipment_tower | —               | FLEX_BRONCH_CORE@1.1 | **OWNER DECISION REQUIRED** |

### airway_access

| Slot id           | Requirement key              | Role code                | Label                                     | Requiredness | Section           | Zone                   | Dependency rule                                       | Module@version                  | responsibleRole             |
| ----------------- | ---------------------------- | ------------------------ | ----------------------------------------- | ------------ | ----------------- | ---------------------- | ----------------------------------------------------- | ------------------------------- | --------------------------- |
| `SLOT-D6B291DC80` | `FLEX_BRONCH_BITE_BLOCK`     | `BITE_BLOCK`             | Bite block                                | conditional  | Airway protection | mayo_stand             | Oral insertion without protected airway               | FLEX_BRONCH_CORE@1.1            | **OWNER DECISION REQUIRED** |
| `SLOT-EE17F755B2` | `SLOT-EE17F755B2`            | `LASER_RESISTANT_ETT`    | Laser-resistant endotracheal tube         | conditional  | Airway protection | mayo_stand             | Laser planned with an indwelling tube or tracheostomy | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-0306E7B77D` | `FLEX_BRONCH_AIRWAY_ADAPTER` | `GENERIC_AIRWAY_ADAPTER` | Airway adapter if mechanically ventilated | conditional  | Ventilation       | room_capital_equipment | Mechanically ventilated patient                       | FLEX_BRONCH_CORE@1.1            | **OWNER DECISION REQUIRED** |

### diagnostic

| Slot id           | Requirement key   | Role code             | Label                      | Requiredness | Section  | Zone       | Dependency rule | Module@version                  | responsibleRole             |
| ----------------- | ----------------- | --------------------- | -------------------------- | ------------ | -------- | ---------- | --------------- | ------------------------------- | --------------------------- |
| `SLOT-D2974FC11B` | `SLOT-D2974FC11B` | `BIOPSY_FORCEPS_FLEX` | Biopsy forceps             | optional     | Sampling | back_table | —               | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-FDF73730B0` | `SLOT-FDF73730B0` | `BAL_KIT`             | BAL convenience tubing/kit | optional     | Sampling | back_table | —               | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### therapeutic

| Slot id           | Requirement key            | Role code                     | Label                                 | Requiredness | Section     | Zone            | Dependency rule                                          | Module@version                  | responsibleRole             |
| ----------------- | -------------------------- | ----------------------------- | ------------------------------------- | ------------ | ----------- | --------------- | -------------------------------------------------------- | ------------------------------- | --------------------------- |
| `SLOT-14453819D5` | `SLOT-14453819D5`          | `CRYOPROBE_FLEX`              | Flexible cryoprobe                    | conditional  | Cryotherapy | equipment_tower | Cryotherapy/extraction planned                           | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-971BBE6BF8` | `SLOT-971BBE6BF8`          | `CRYO_SYSTEM_ACCESSORY`       | Cryosurgery platform accessories      | conditional  | Cryotherapy | equipment_tower | Cryotherapy planned                                      | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-3FE6796B6D` | `SLOT-3FE6796B6D`          | `AIRWAY_BALLOON_DILATOR`      | Airway balloon dilator                | conditional  | Dilation    | back_table      | Dilation planned                                         | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-D43C866FB5` | `SLOT-D43C866FB5`          | `PULMONARY_GUIDEWIRE`         | Guidewire                             | conditional  | Dilation    | back_table      | Guidewire-compatible balloon/stent selected              | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-7412B3318B` | `SLOT-7412B3318B`          | `INFLATION_DEVICE`            | Inflation device                      | conditional  | Dilation    | back_table      | Balloon dilator selected                                 | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-FCE9E3810E` | `SLOT-FCE9E3810E`          | `ENERGY_PLATFORM`             | Energy/hemostasis platform and probes | conditional  | Energy      | equipment_tower | Thermal modality planned                                 | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-97CFA5C9A2` | `SLOT-97CFA5C9A2`          | `APC_PROBE_FLEX`              | Flexible APC probe                    | conditional  | Energy      | equipment_tower | APC planned                                              | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-90A43CBAEF` | `SLOT-90A43CBAEF`          | `ENERGY_CABLE_ADAPTER`        | Energy cable / adapter                | conditional  | Energy      | equipment_tower | Selected energy device requires a separate cable/adapter | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-1538BC9076` | `SLOT-1538BC9076`          | `APC_GAS_ACCESSORY`           | APC gas-system accessories            | conditional  | Energy      | equipment_tower | APC planned                                              | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-185FBB545F` | `SLOT-185FBB545F`          | `LASER_CONSOLE`               | Surgical laser console                | conditional  | Energy      | equipment_tower | Laser planned                                            | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-34CDBAB683` | `SLOT-34CDBAB683`          | `LASER_FIBER`                 | Laser delivery fibre                  | conditional  | Energy      | equipment_tower | Laser planned                                            | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-6630AD392A` | `SLOT-6630AD392A`          | `LASER_SAFETY_EQUIPMENT`      | Laser safety equipment                | conditional  | Energy      | equipment_tower | Laser planned                                            | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-1647A73048` | `AIRWAY_RETRIEVAL_FORCEPS` | `FOREIGN_BODY_FORCEPS_FLEX`   | Flexible grasping forceps             | optional     | Retrieval   | mayo_stand      | —                                                        | THERAPEUTIC_BRONCH_CORE@1.0     | **OWNER DECISION REQUIRED** |
| `SLOT-115310F554` | `SLOT-115310F554`          | `FOREIGN_BODY_BASKET`         | Retrieval basket/net                  | optional     | Retrieval   | mayo_stand      | —                                                        | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-45D721710F` | `SLOT-45D721710F`          | `AIRWAY_STENT_SEMS_COVERED`   | Covered metallic airway stent         | conditional  | Stent       | back_table      | Covered SEMS planned                                     | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-09A64B2C62` | `SLOT-09A64B2C62`          | `AIRWAY_STENT_SEMS_UNCOVERED` | Uncovered metallic airway stent       | conditional  | Stent       | back_table      | Uncovered SEMS planned                                   | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-081FB0C695` | `SLOT-081FB0C695`          | `AIRWAY_STENT_SIZING_DEVICE`  | Airway stent sizing device            | optional     | Stent       | back_table      | —                                                        | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### specimen_handling

| Slot id           | Requirement key   | Role code          | Label                      | Requiredness | Section  | Zone             | Dependency rule                 | Module@version                  | responsibleRole             |
| ----------------- | ----------------- | ------------------ | -------------------------- | ------------ | -------- | ---------------- | ------------------------------- | ------------------------------- | --------------------------- |
| `SLOT-0F8FA96C28` | `SLOT-0F8FA96C28` | `GENERIC_SPECIMEN` | Specimen containers/labels | conditional  | Sampling | specimen_station | Sampling or debulking performed | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### post_procedure

| Slot id           | Requirement key   | Role code                  | Label          | Requiredness | Section        | Zone       | Dependency rule                | Module@version                  | responsibleRole             |
| ----------------- | ----------------- | -------------------------- | -------------- | ------------ | -------------- | ---------- | ------------------------------ | ------------------------------- | --------------------------- |
| `SLOT-D7F2D36301` | `SLOT-D7F2D36301` | `ENDOSCOPE_CLEANING_BRUSH` | Cleaning brush | conditional  | Post-procedure | back_table | Reusable bronchoscope selected | THERAPEUTIC_BRONCH_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

## THORACENTESIS — Thoracentesis (6 slots)

### pre_room

| Slot id           | Requirement key              | Role code            | Label                                      | Requiredness | Section | Zone                   | Dependency rule | Module@version             | responsibleRole             |
| ----------------- | ---------------------------- | -------------------- | ------------------------------------------ | ------------ | ------- | ---------------------- | --------------- | -------------------------- | --------------------------- |
| `SLOT-E91A13EE9E` | `PLEURAL_ULTRASOUND_MACHINE` | `GENERIC_ULTRASOUND` | Ultrasound machine and sterile probe cover | required     | Imaging | room_capital_equipment | —               | PLEURAL_PROCEDURE_CORE@1.0 | **OWNER DECISION REQUIRED** |

### pre_induction_or_sedation

| Slot id           | Requirement key   | Role code                    | Label                                                         | Requiredness | Section  | Zone            | Dependency rule                                             | Module@version             | responsibleRole             |
| ----------------- | ----------------- | ---------------------------- | ------------------------------------------------------------- | ------------ | -------- | --------------- | ----------------------------------------------------------- | -------------------------- | --------------------------- |
| `SLOT-CA34F60BE9` | `SLOT-CA34F60BE9` | `GENERIC_SUCTION`            | Drainage tubing and vacuum bottle/bag or wall-suction adapter | required     | Drainage | equipment_tower | —                                                           | THORACENTESIS_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |
| `SLOT-C174DA0A4E` | `SLOT-C174DA0A4E` | `PLEURAL_DRAINAGE_ACCESSORY` | Drainage adapter / connecting tube                            | conditional  | Drainage | equipment_tower | Selected thoracentesis system requires separate accessories | THORACENTESIS_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### therapeutic

| Slot id           | Requirement key   | Role code           | Label                       | Requiredness | Section         | Zone          | Dependency rule | Module@version             | responsibleRole             |
| ----------------- | ----------------- | ------------------- | --------------------------- | ------------ | --------------- | ------------- | --------------- | -------------------------- | --------------------------- |
| `SLOT-A13A73CA93` | `SLOT-A13A73CA93` | `THORACENTESIS_KIT` | Thoracentesis catheter/tray | required     | Access/drainage | sterile_field | —               | THORACENTESIS_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### specimen_handling

| Slot id           | Requirement key   | Role code          | Label                                                   | Requiredness | Section  | Zone             | Dependency rule             | Module@version             | responsibleRole             |
| ----------------- | ----------------- | ------------------ | ------------------------------------------------------- | ------------ | -------- | ---------------- | --------------------------- | -------------------------- | --------------------------- |
| `SLOT-103FF61AAC` | `SLOT-103FF61AAC` | `GENERIC_SPECIMEN` | Chemistry, microbiology, cytology containers and labels | conditional  | Sampling | specimen_station | Diagnostic sampling planned | THORACENTESIS_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

### post_procedure

| Slot id           | Requirement key   | Role code             | Label                            | Requiredness | Section        | Zone       | Dependency rule | Module@version             | responsibleRole             |
| ----------------- | ----------------- | --------------------- | -------------------------------- | ------------ | -------------- | ---------- | --------------- | -------------------------- | --------------------------- |
| `SLOT-23A6DA3B89` | `SLOT-23A6DA3B89` | `DRESSING_SECUREMENT` | Dressing and securement supplies | required     | Post-procedure | back_table | —               | THORACENTESIS_SPECIFIC@1.1 | **OWNER DECISION REQUIRED** |

## WLL — Whole lung lavage (13 slots)

### airway_access

| Slot id           | Requirement key   | Role code                | Label                                             | Requiredness | Section          | Zone                   | Dependency rule | Module@version   | responsibleRole             |
| ----------------- | ----------------- | ------------------------ | ------------------------------------------------- | ------------ | ---------------- | ---------------------- | --------------- | ---------------- | --------------------------- |
| `SLOT-2947B0846D` | `SLOT-2947B0846D` | `DLT_LEFT`               | Left double-lumen tube - primary                  | required     | Airway isolation | equipment_tower        | —               | WLL_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-C3D82E151B` | `SLOT-C3D82E151B` | `DLT_RIGHT`              | Right double-lumen tube - backup/selected anatomy | optional     | Airway isolation | equipment_tower        | —               | WLL_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-506C864DCC` | `SLOT-506C864DCC` | `ENDOBRONCHIAL_BLOCKER`  | Endobronchial blocker - backup/alternative        | conditional  | Airway isolation | equipment_tower        | —               | WLL_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-DD40010751` | `SLOT-DD40010751` | `GENERIC_AIRWAY_ADAPTER` | DLT bronchoscopy/ventilation adapters and clamps  | required     | Ventilation      | room_capital_equipment | —               | WLL_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### diagnostic

| Slot id           | Requirement key   | Role code                  | Label                                         | Requiredness | Section        | Zone            | Dependency rule | Module@version   | responsibleRole             |
| ----------------- | ----------------- | -------------------------- | --------------------------------------------- | ------------ | -------------- | --------------- | --------------- | ---------------- | --------------------------- |
| `SLOT-1039D6C9E8` | `SLOT-1039D6C9E8` | `FLEX_SCOPE_SINGLE_USE`    | Slim bronchoscope for DLT confirmation        | required     | Bronchoscopy   | equipment_tower | —               | WLL_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-5B9AA7A469` | `SLOT-5B9AA7A469` | `VIDEO_PROCESSOR`          | Compatible display/processor                  | required     | Bronchoscopy   | equipment_tower | —               | WLL_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-41977168DA` | `SLOT-41977168DA` | `WLL_LAVAGE_CIRCUIT`       | Warmed saline delivery and drainage circuit   | required     | Lavage circuit | back_table      | —               | WLL_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-2015EC8357` | `SLOT-2015EC8357` | `GENERIC_SUCTION`          | Suction and large-volume collection canisters | required     | Lavage circuit | back_table      | —               | WLL_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-57741DB666` | `SLOT-57741DB666` | `WLL_WARMED_SALINE_SUPPLY` | Warmed saline supply                          | required     | Lavage circuit | back_table      | —               | WLL_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-9BD475F03A` | `SLOT-9BD475F03A` | `WLL_FLUID_WARMER`         | Fluid or irrigation warmer                    | required     | Lavage circuit | back_table      | —               | WLL_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-9EBCAD6487` | `SLOT-9EBCAD6487` | `WLL_CHEST_PERCUSSION`     | Chest percussion or HFCWO device              | required     | Lavage circuit | back_table      | —               | WLL_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
| `SLOT-23E62136B4` | `SLOT-23E62136B4` | `WLL_EFFLUENT_COLLECTION`  | Graduated effluent collection                 | required     | Lavage circuit | back_table      | —               | WLL_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |

### rescue_or_contingency

| Slot id           | Requirement key   | Role code               | Label                               | Requiredness | Section | Zone           | Dependency rule | Module@version   | responsibleRole             |
| ----------------- | ----------------- | ----------------------- | ----------------------------------- | ------------ | ------- | -------------- | --------------- | ---------------- | --------------------------- |
| `SLOT-ECF1B0860E` | `SLOT-ECF1B0860E` | `CHEST_TUBE_SMALL_BORE` | Chest tube kit available for rescue | conditional  | Rescue  | emergency_cart | Local protocol  | WLL_SPECIFIC@1.0 | **OWNER DECISION REQUIRED** |
