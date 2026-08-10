# F-21 — `selection_guidance` field-split review packet

**Status: OWNER AUTHORING DECISION — nothing in this packet is governed data.**

Every proposed destination below is a **NON-GOVERNED PROPOSAL** produced for review
convenience only. No runtime, generator, or governed artifact consumes this file, and no
`selection_criteria` / `teaching_guidance` field exists in governed data until the owner
dispositions each row. The current 200-character rendering threshold remains an interim
presentation heuristic (owner finding F-21) and is shown per row as context only — it is
NOT the migration rule.

Proposal vocabulary: `selection_criteria` (short filter/lookup instruction) ·
`teaching_guidance` (substantive teaching prose) · `requires split` (contains both) ·
`OWNER DECISION REQUIRED` (ambiguous).

Corpus: 135 roles, all with non-empty `selection_guidance`.
Interim UI classification today: 125 under 200 chars (render as criteria), 10 at/over (render as guidance blockquote).

Proposal tally (NON-GOVERNED):

- selection_criteria: 119
- OWNER DECISION REQUIRED: 12
- teaching_guidance: 4

| #   | Role code                               | Name                                                  | Category                            | Chars | UI today         | Proposed destination (NON-GOVERNED) | Confidence | Needs rewrite/split? |
| --- | --------------------------------------- | ----------------------------------------------------- | ----------------------------------- | ----- | ---------------- | ----------------------------------- | ---------- | -------------------- |
| 1   | `AIRWAY_BALLOON_DILATOR`                | Pulmonary balloon dilator                             | Therapeutic bronchoscopy            | 74    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 2   | `AIRWAY_STENT_PATIENT_SPECIFIC`         | Patient-specific airway stent service                 | Airway stents                       | 54    | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 3   | `AIRWAY_STENT_SEMS_COVERED`             | Covered or partially covered SEMS                     | Airway stents                       | 78    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 4   | `AIRWAY_STENT_SEMS_UNCOVERED`           | Uncovered SEMS                                        | Airway stents                       | 68    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 5   | `AIRWAY_STENT_SILICONE_HOURGLASS`       | Hourglass silicone stent                              | Airway stents                       | 65    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 6   | `AIRWAY_STENT_SILICONE_STRAIGHT`        | Straight silicone airway stent                        | Airway stents                       | 79    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 7   | `AIRWAY_STENT_SILICONE_Y`               | Silicone Y stent                                      | Airway stents                       | 56    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 8   | `AIRWAY_STENT_SIZING_DEVICE`            | Airway stent sizing device                            | Airway stents                       | 73    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 9   | `APC_APPLICATOR_RIGID`                  | Rigid or malleable APC applicator                     | Therapeutic bronchoscopy            | 72    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 10  | `APC_GAS_ACCESSORY`                     | APC gas-system accessory                              | Therapeutic bronchoscopy            | 93    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 11  | `APC_PROBE_FLEX`                        | Flexible APC probe                                    | Therapeutic bronchoscopy            | 103   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 12  | `AUTOMATED_ENDOSCOPE_REPROCESSOR`       | Automated endoscope reprocessor                       | Reprocessing                        | 121   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 13  | `BAL_KIT`                               | BAL kit                                               | Tissue sampling                     | 86    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 14  | `BIOPSY_FORCEPS_ENERGY_ENABLED`         | Energy-enabled biopsy forceps                         | Tissue sampling                     | 150   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 15  | `BIOPSY_FORCEPS_FLEX`                   | Flexible bronchoscopy biopsy forceps                  | Tissue sampling                     | 60    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 16  | `BITE_BLOCK`                            | Bite block                                            | Flexible bronchoscopy               | 69    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 17  | `BRONCH_REPROCESSING_KIT`               | Bronchoscope reprocessing kit                         | Reprocessing                        | 32    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 18  | `CHEST_TUBE_LARGE_BORE`                 | Large-bore chest tube set                             | Pleural drainage                    | 73    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 19  | `CHEST_TUBE_SMALL_BORE`                 | Small-bore chest drain                                | Pleural drainage                    | 70    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 20  | `CHEST_TUBE_SURGICAL`                   | Surgical thoracic catheter                            | Pleural drainage                    | 63    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 21  | `CO2_INSUFFLATOR`                       | CO2 insufflator                                       | Medical thoracoscopy                | 81    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 22  | `COLLATERAL_VENTILATION_SYSTEM`         | Collateral ventilation assessment system              | Bronchoscopic lung volume reduction | 49    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 23  | `CRYOPROBE_FLEX`                        | Flexible cryoprobe                                    | Therapeutic bronchoscopy            | 76    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 24  | `CRYO_SYSTEM_ACCESSORY`                 | Cryosurgery platform accessory                        | Therapeutic bronchoscopy            | 107   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 25  | `CYTOLOGY_BRUSH`                        | Pulmonary cytology brush                              | Tissue sampling                     | 64    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 26  | `DLT_LEFT`                              | Left double-lumen tube                                | Airway isolation & tracheostomy     | 53    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 27  | `DLT_RIGHT`                             | Right double-lumen tube                               | Airway isolation & tracheostomy     | 64    | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 28  | `DRESSING_SECUREMENT`                   | Dressing and securement supplies                      | Room & generic supply               | 104   | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 29  | `EBUS_BALLOON`                          | EBUS balloon                                          | EBUS                                | 35    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 30  | `EBUS_MINIFORCEPS`                      | EBUS intranodal mini-forceps                          | Tissue sampling                     | 65    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 31  | `EBUS_NEEDLE_ADAPTER`                   | EBUS needle adapter or biopsy valve                   | EBUS                                | 87    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 32  | `EBUS_NEEDLE_FNA`                       | EBUS-TBNA FNA needle                                  | Tissue sampling                     | 69    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 33  | `EBUS_NEEDLE_FNB`                       | EBUS FNB needle                                       | Tissue sampling                     | 70    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 34  | `EBUS_SCOPE`                            | Linear EBUS bronchoscope                              | EBUS                                | 84    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 35  | `EBV_DELIVERY_CATHETER`                 | Valve deployment catheter                             | Bronchoscopic lung volume reduction | 53    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 36  | `EBV_SIZING_BALLOON`                    | Endobronchial valve sizing balloon catheter           | Bronchoscopic lung volume reduction | 76    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 37  | `EBV_SIZING_KIT`                        | Endobronchial valve sizing kit                        | Bronchoscopic lung volume reduction | 70    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 38  | `EBV_VALVE`                             | Endobronchial valve                                   | Bronchoscopic lung volume reduction | 64    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 39  | `ENB_PROCEDURE_KIT`                     | Electromagnetic navigation bronchoscopy procedure kit | Peripheral & robotic bronchoscopy   | 83    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 40  | `ENDOBRONCHIAL_BLOCKER`                 | Endobronchial blocker                                 | Airway isolation & tracheostomy     | 121   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 41  | `ENDOBRONCHIAL_SPIGOT`                  | Endobronchial occlusion spigot/plug                   | Bronchoscopic lung volume reduction | 97    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 42  | `ENDOSCOPE_CLEANING_BRUSH`              | Endoscope cleaning brush                              | Reprocessing                        | 66    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 43  | `ENDOSCOPIC_IRRIGATION_PUMP`            | Endoscopic irrigation pump                            | Endoscopy platform                  | 73    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 44  | `ENDOSCOPIC_SUCTION_PUMP`               | Endoscopic suction pump                               | Endoscopy platform                  | 69    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 45  | `ENDOSCOPY_CART`                        | Endoscopy system cart                                 | Flexible bronchoscopy               | 67    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 46  | `ENDOSCOPY_LIGHT_CABLE`                 | Endoscopy light cable                                 | Endoscopy platform                  | 73    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 47  | `ENDOSCOPY_MONITOR`                     | Endoscopy monitor                                     | Endoscopy platform                  | 77    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 48  | `ENDOSCOPY_PROCESSOR_MOUNT_ACCESSORY`   | Endoscopy processor mount accessory                   | Endoscopy platform                  | 155   | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 49  | `ENERGY_CABLE_ADAPTER`                  | Energy-platform cable or adapter                      | Therapeutic bronchoscopy            | 120   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 50  | `ENERGY_PLATFORM`                       | Energy/hemostasis platform                            | Energy platforms                    | 88    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 51  | `ENERGY_PLATFORM_ACCESSORY`             | Energy platform accessory                             | Energy platforms                    | 140   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 52  | `FLEX_SCOPE_DIAGNOSTIC`                 | Diagnostic flexible bronchoscope                      | Flexible bronchoscopy               | 94    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 53  | `FLEX_SCOPE_SINGLE_USE`                 | Single-use flexible bronchoscope                      | Flexible bronchoscopy               | 79    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 54  | `FLEX_SCOPE_THERAPEUTIC`                | Therapeutic flexible bronchoscope                     | Flexible bronchoscopy               | 69    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 55  | `FLEX_SCOPE_THIN`                       | Thin flexible bronchoscope                            | Flexible bronchoscopy               | 178   | criteria (<200)  | OWNER DECISION REQUIRED             | low        | owner judgement      |
| 56  | `FLUOROSCOPY_C_ARM`                     | Fluoroscopy C-arm                                     | Procedural imaging                  | 220   | guidance (>=200) | OWNER DECISION REQUIRED             | low        | owner judgement      |
| 57  | `FOREIGN_BODY_BASKET`                   | Airway retrieval basket/net                           | Therapeutic bronchoscopy            | 63    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 58  | `FOREIGN_BODY_FORCEPS_FLEX`             | Flexible grasping forceps                             | Therapeutic bronchoscopy            | 47    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 59  | `GENERIC_AIRWAY_ADAPTER`                | Airway bronchoscopy adapter                           | Room & generic supply               | 56    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 60  | `GENERIC_DRAINAGE_UNIT`                 | Pleural drainage unit                                 | Room & generic supply               | 24    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 61  | `GENERIC_PPE`                           | PPE / isolation supplies                              | Room & generic supply               | 34    | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 62  | `GENERIC_SPECIMEN`                      | Specimen containers/labels                            | Room & generic supply               | 38    | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 63  | `GENERIC_SUCTION`                       | Suction source/tubing/canister                        | Room & generic supply               | 23    | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 64  | `GENERIC_ULTRASOUND`                    | Ultrasound machine/probe cover                        | Room & generic supply               | 27    | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 65  | `GUIDE_SHEATH_KIT`                      | Peripheral biopsy guide-sheath kit                    | Tissue sampling                     | 118   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 66  | `GUIDING_DEVICE`                        | Peripheral guiding device                             | Tissue sampling                     | 78    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 67  | `INFLATION_DEVICE`                      | Balloon inflation device                              | Therapeutic bronchoscopy            | 47    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 68  | `IPC_DRAINAGE_KIT`                      | Indwelling pleural catheter drainage kit              | Pleural drainage                    | 41    | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 69  | `IPC_DRESSING_KIT`                      | IPC dressing kit                                      | Pleural drainage                    | 57    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 70  | `IPC_INSERTION_KIT`                     | Indwelling pleural catheter insertion kit             | Pleural drainage                    | 47    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 71  | `IPC_MANAGEMENT_ACCESSORY`              | IPC management accessory                              | Pleural drainage                    | 44    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 72  | `LASER_CONSOLE`                         | Surgical laser console                                | Laser                               | 1118  | guidance (>=200) | teaching_guidance                   | high       | no                   |
| 73  | `LASER_FIBER`                           | Laser delivery fibre                                  | Laser                               | 608   | guidance (>=200) | teaching_guidance                   | high       | no                   |
| 74  | `LASER_RESISTANT_ETT`                   | Laser-resistant endotracheal tube                     | Laser                               | 517   | guidance (>=200) | teaching_guidance                   | high       | no                   |
| 75  | `LASER_SAFETY_EQUIPMENT`                | Laser safety equipment                                | Laser                               | 531   | guidance (>=200) | teaching_guidance                   | high       | no                   |
| 76  | `MICROWAVE_ABLATION_CATHETER`           | Bronchoscopic microwave ablation catheter             | Therapeutic bronchoscopy            | 151   | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 77  | `NAV_ACCESSORY_SENSOR`                  | Navigation sensor or patient patch                    | Peripheral & robotic bronchoscopy   | 101   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 78  | `NAV_BRONCHOSCOPE_ADAPTER`              | Navigation bronchoscope adapter                       | Peripheral & robotic bronchoscopy   | 82    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 79  | `NAV_CATHETER_GUIDE`                    | Navigation catheter or guide                          | Peripheral & robotic bronchoscopy   | 116   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 80  | `NAV_PLATFORM_ACCESSORY`                | Navigation platform accessory                         | Peripheral & robotic bronchoscopy   | 120   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 81  | `NAV_TBNA_NEEDLE`                       | Navigation-compatible TBNA needle                     | Peripheral & robotic bronchoscopy   | 110   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 82  | `PERC_TRACH_KIT`                        | Percutaneous tracheostomy kit                         | Airway isolation & tracheostomy     | 65    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 83  | `PHOTODYNAMIC_DIFFUSER`                 | Photodynamic light diffuser                           | Photodynamic therapy                | 214   | guidance (>=200) | OWNER DECISION REQUIRED             | low        | owner judgement      |
| 84  | `PHOTODYNAMIC_LASER`                    | Photodynamic activation laser                         | Photodynamic therapy                | 202   | guidance (>=200) | OWNER DECISION REQUIRED             | low        | owner judgement      |
| 85  | `PHOTODYNAMIC_PHOTOSENSITIZER`          | Photodynamic photosensitizer                          | Photodynamic therapy                | 223   | guidance (>=200) | OWNER DECISION REQUIRED             | low        | owner judgement      |
| 86  | `PLEURAL_DRAINAGE_ACCESSORY`            | Pleural drainage accessory                            | Pleural drainage                    | 77    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 87  | `PNEUMOTHORAX_KIT`                      | Pneumothorax catheter or aspiration kit               | Pleural drainage                    | 104   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 88  | `PULMONARY_GUIDEWIRE`                   | Pulmonary guidewire                                   | Tissue sampling                     | 30    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 89  | `PULSED_FIELD_ABLATION_CATHETER`        | Pulsed electric field electrode                       | Therapeutic bronchoscopy            | 121   | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 90  | `PULSED_FIELD_ABLATION_SYSTEM`          | Pulsed electric field system                          | Energy platforms                    | 202   | guidance (>=200) | OWNER DECISION REQUIRED             | low        | owner judgement      |
| 91  | `RADIAL_EBUS_DRIVE_UNIT`                | Radial EBUS probe drive unit                          | Peripheral & robotic bronchoscopy   | 44    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 92  | `RADIAL_EBUS_PROBE`                     | Radial EBUS probe                                     | Peripheral & robotic bronchoscopy   | 85    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 93  | `RADIATION_PROTECTION`                  | Radiation protection                                  | Procedural imaging                  | 196   | criteria (<200)  | OWNER DECISION REQUIRED             | low        | owner judgement      |
| 94  | `RIGID_BIPOLAR_FORCEPS`                 | Rigid bipolar forceps                                 | Rigid bronchoscopy                  | 70    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 95  | `RIGID_BRONCHOSCOPE_ACCESSORY`          | Rigid bronchoscopy accessory                          | Rigid bronchoscopy                  | 72    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 96  | `RIGID_BRONCHOSCOPE_BARREL`             | Rigid bronchoscope barrel/tube                        | Rigid bronchoscopy                  | 80    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 97  | `RIGID_BRONCHOSCOPE_HEAD`               | Rigid bronchoscope head                               | Rigid bronchoscopy                  | 61    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 98  | `RIGID_BRONCH_ASPIRATION_BIOPSY_NEEDLE` | Rigid bronchoscopy aspiration biopsy needle           | Rigid bronchoscopy                  | 146   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 99  | `RIGID_BRONCH_PUNCTURE_NEEDLE`          | Rigid bronchoscopy puncture needle                    | Rigid bronchoscopy                  | 133   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 100 | `RIGID_BRONCH_SHAVER`                   | Rigid bronchoscopic shaver                            | Rigid bronchoscopy                  | 98    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 101 | `RIGID_FORCEPS`                         | Rigid bronchoscopy forceps/instrument                 | Rigid bronchoscopy                  | 65    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 102 | `RIGID_SUCTION_CATHETER`                | Rigid bronchoscopy suction catheter                   | Rigid bronchoscopy                  | 52    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 103 | `RIGID_TELESCOPE`                       | Rigid telescope                                       | Rigid bronchoscopy                  | 83    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 104 | `ROBOTIC_BIOPSY_NEEDLE`                 | Robotic bronchoscopy biopsy needle                    | Peripheral & robotic bronchoscopy   | 114   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 105 | `ROBOTIC_BRONCHOSCOPE`                  | Robotic bronchoscope                                  | Peripheral & robotic bronchoscopy   | 123   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 106 | `ROBOTIC_BRONCH_PLATFORM`               | Robotic bronchoscopy platform                         | Peripheral & robotic bronchoscopy   | 138   | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 107 | `ROBOTIC_CATHETER`                      | Robotic bronchoscopy catheter                         | Peripheral & robotic bronchoscopy   | 157   | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 108 | `ROBOTIC_PROCEDURE_KIT`                 | Robotic bronchoscopy procedure kit                    | Peripheral & robotic bronchoscopy   | 87    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 109 | `SPECIMEN_TRAP`                         | Bronchoscopy specimen trap                            | Tissue sampling                     | 51    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 110 | `STENT_APPLICATOR`                      | Silicone stent applicator                             | Airway stents                       | 54    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 111 | `TALC_POUDRAGE_KIT`                     | Talc poudrage kit                                     | Medical thoracoscopy                | 42    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 112 | `TALC_VIAL`                             | Sterile talc vial                                     | Medical thoracoscopy                | 49    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 113 | `TBNA_NEEDLE`                           | Conventional TBNA needle                              | Tissue sampling                     | 54    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 114 | `TBNA_NEEDLE_CONVENTIONAL`              | Conventional TBNA needle                              | Tissue sampling                     | 103   | criteria (<200)  | selection_criteria                  | high       | no                   |
| 115 | `THORACENTESIS_KIT`                     | Thoracentesis kit/catheter                            | Pleural drainage                    | 70    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 116 | `THORACOSCOPE_RIGID`                    | Thoracoscopy telescope                                | Medical thoracoscopy                | 83    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 117 | `THORACOSCOPE_SEMIRIGID`                | Pleuroscope                                           | Medical thoracoscopy                | 66    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 118 | `THORACOSCOPY_BIOPSY_FORCEPS`           | Pleural biopsy forceps                                | Medical thoracoscopy                | 45    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 119 | `THORACOSCOPY_ELECTRODE`                | Thoracoscopy electrode                                | Medical thoracoscopy                | 197   | criteria (<200)  | OWNER DECISION REQUIRED             | low        | owner judgement      |
| 120 | `THORACOSCOPY_PROBE`                    | Thoracoscopy surgical probe                           | Medical thoracoscopy                | 49    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 121 | `THORACOSCOPY_SCISSORS`                 | Thoracoscopy scissors                                 | Medical thoracoscopy                | 67    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 122 | `THORACOSCOPY_TROCAR`                   | Pleuroscopy trocar                                    | Medical thoracoscopy                | 38    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 123 | `TOMOSYNTHESIS_NAVIGATION_SYSTEM`       | Tomosynthesis navigation system                       | Procedural imaging                  | 174   | criteria (<200)  | OWNER DECISION REQUIRED             | low        | owner judgement      |
| 124 | `TRACH_TUBE_CUFFED`                     | Adult cuffed tracheostomy tube                        | Airway isolation & tracheostomy     | 65    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 125 | `TRACH_TUBE_CUFFLESS`                   | Adult cuffless tracheostomy tube                      | Airway isolation & tracheostomy     | 59    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 126 | `TRACH_TUBE_EVAC`                       | Subglottic suction tracheostomy tube                  | Airway isolation & tracheostomy     | 57    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 127 | `ULTRASOUND_CABLE`                      | Ultrasound cable                                      | EBUS                                | 26    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 128 | `ULTRASOUND_PROCESSOR`                  | Endoscopic ultrasound processor                       | EBUS                                | 27    | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 129 | `VACUUM_LOCKING_SYRINGE`                | Vacuum locking syringe                                | Tissue sampling                     | 61    | criteria (<200)  | selection_criteria                  | high       | no                   |
| 130 | `VIDEO_PROCESSOR`                       | Video processor / light source                        | Endoscopy platform                  | 60    | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 131 | `WLL_CHEST_PERCUSSION`                  | Chest percussion device                               | Whole lung lavage                   | 185   | criteria (<200)  | OWNER DECISION REQUIRED             | low        | owner judgement      |
| 132 | `WLL_EFFLUENT_COLLECTION`               | Graduated effluent collection                         | Whole lung lavage                   | 157   | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 133 | `WLL_FLUID_WARMER`                      | Fluid warmer                                          | Whole lung lavage                   | 175   | criteria (<200)  | OWNER DECISION REQUIRED             | low        | owner judgement      |
| 134 | `WLL_LAVAGE_CIRCUIT`                    | WLL saline/tubing/drainage circuit                    | Whole lung lavage                   | 52    | criteria (<200)  | selection_criteria                  | medium     | no                   |
| 135 | `WLL_WARMED_SALINE_SUPPLY`              | Warmed saline supply                                  | Whole lung lavage                   | 216   | guidance (>=200) | OWNER DECISION REQUIRED             | low        | owner judgement      |

## Verbatim text per role

The exact governed `selection_guidance`, quoted verbatim so the owner can disposition
without opening the data file:

### `AIRWAY_BALLOON_DILATOR` — Pulmonary balloon dilator (74 chars)

> Filter by diameter range, balloon length, guidewire, and inflation device.

### `AIRWAY_STENT_PATIENT_SPECIFIC` — Patient-specific airway stent service (54 chars)

> Treat as a service workflow, not an off-the-shelf SKU.

### `AIRWAY_STENT_SEMS_COVERED` — Covered or partially covered SEMS (78 chars)

> Filter by diameter, length, delivery profile, coverage, and release direction.

### `AIRWAY_STENT_SEMS_UNCOVERED` — Uncovered SEMS (68 chars)

> Filter by diameter, length, delivery profile, and release direction.

### `AIRWAY_STENT_SILICONE_HOURGLASS` — Hourglass silicone stent (65 chars)

> Filter by proximal, waist, distal diameters, and segment lengths.

### `AIRWAY_STENT_SILICONE_STRAIGHT` — Straight silicone airway stent (79 chars)

> Filter by model, outer diameter, length, wall thickness, and radiopaque option.

### `AIRWAY_STENT_SILICONE_Y` — Silicone Y stent (56 chars)

> Filter by tracheal/bronchial diameters and limb lengths.

### `AIRWAY_STENT_SIZING_DEVICE` — Airway stent sizing device (73 chars)

> Verify measurement method, channel, guidewire, and intended stent family.

### `APC_APPLICATOR_RIGID` — Rigid or malleable APC applicator (72 chars)

> Match shaft geometry, electrode type, platform, and local credentialing.

### `APC_GAS_ACCESSORY` — APC gas-system accessory (93 chars)

> Match local gas standard, generator, cylinder connector, and institutional gas-safety policy.

### `APC_PROBE_FLEX` — Flexible APC probe (103 chars)

> Match probe diameter, beam form, working length, compatible APC generator, and airway-fire precautions.

### `AUTOMATED_ENDOSCOPE_REPROCESSOR` — Automated endoscope reprocessor (121 chars)

> Match validated endoscope models, connectors, detergents/disinfectants, facility utilities, and institutional SPD policy.

### `BAL_KIT` — BAL kit (86 chars)

> Verify connectors, anti-reflux features, specimen collection, and scope compatibility.

### `BIOPSY_FORCEPS_ENERGY_ENABLED` — Energy-enabled biopsy forceps (150 chars)

> Confirm bronchoscope channel fit and compatibility with the selected energy platform, accessories, settings, airway-fire precautions, and current IFU.

### `BIOPSY_FORCEPS_FLEX` — Flexible bronchoscopy biopsy forceps (60 chars)

> Filter by jaw type, OD, working length, and minimum channel.

### `BITE_BLOCK` — Bite block (69 chars)

> Match maximum endoscope outer diameter and local reprocessing policy.

### `BRONCH_REPROCESSING_KIT` — Bronchoscope reprocessing kit (32 chars)

> Match local reprocessing policy.

### `CHEST_TUBE_LARGE_BORE` — Large-bore chest tube set (73 chars)

> Filter by French size, insertion technique, and included tray components.

### `CHEST_TUBE_SMALL_BORE` — Small-bore chest drain (70 chars)

> Filter by French size, length, locking/pigtail design, and indication.

### `CHEST_TUBE_SURGICAL` — Surgical thoracic catheter (63 chars)

> Filter by French size, length, tip geometry, and trocar option.

### `CO2_INSUFFLATOR` — CO2 insufflator (81 chars)

> Verify institutional technique, tubing, pressure limits, and scope of indication.

### `COLLATERAL_VENTILATION_SYSTEM` — Collateral ventilation assessment system (49 chars)

> Match selected valve workflow and local protocol.

### `CRYOPROBE_FLEX` — Flexible cryoprobe (76 chars)

> Match probe OD, oversheath, cryosurgical platform, and bronchoscope channel.

### `CRYO_SYSTEM_ACCESSORY` — Cryosurgery platform accessory (107 chars)

> Match the cryosurgery platform, gas source, country-specific connector, and local engineering requirements.

### `CYTOLOGY_BRUSH` — Pulmonary cytology brush (64 chars)

> Filter by sheath, brush dimensions, working length, and channel.

### `DLT_LEFT` — Left double-lumen tube (53 chars)

> Filter by French size and bronchoscope compatibility.

### `DLT_RIGHT` — Right double-lumen tube (64 chars)

> Usually a backup/selected-anatomy option; filter by French size.

### `DRESSING_SECUREMENT` — Dressing and securement supplies (104 chars)

> Use the organization-specific dressing and securement standard for the access site or indwelling device.

### `EBUS_BALLOON` — EBUS balloon (35 chars)

> Match the EBUS scope model and IFU.

### `EBUS_MINIFORCEPS` — EBUS intranodal mini-forceps (65 chars)

> Filter by channel, access-hole workflow, and scope compatibility.

### `EBUS_NEEDLE_ADAPTER` — EBUS needle adapter or biopsy valve (87 chars)

> Match the exact needle family and scope model; do not infer cross-family compatibility.

### `EBUS_NEEDLE_FNA` — EBUS-TBNA FNA needle (69 chars)

> Filter by gauge, scope compatibility, minimum channel, and packaging.

### `EBUS_NEEDLE_FNB` — EBUS FNB needle (70 chars)

> Filter by gauge, scope compatibility, and intended pathology workflow.

### `EBUS_SCOPE` — Linear EBUS bronchoscope (84 chars)

> Match ultrasound processor, cable, balloon, needle system, and channel requirements.

### `EBV_DELIVERY_CATHETER` — Valve deployment catheter (53 chars)

> Match valve family, size, scope channel, and anatomy.

### `EBV_SIZING_BALLOON` — Endobronchial valve sizing balloon catheter (76 chars)

> Match the valve system, scope channel, balloon diameter, and working length.

### `EBV_SIZING_KIT` — Endobronchial valve sizing kit (70 chars)

> Match valve family, sizing catheter/balloon, channel, and current IFU.

### `EBV_VALVE` — Endobronchial valve (64 chars)

> Match airway sizing workflow and manufacturer deployment system.

### `ENB_PROCEDURE_KIT` — Electromagnetic navigation bronchoscopy procedure kit (83 chars)

> Match the kit to the exact navigation platform, catheter workflow, and current IFU.

### `ENDOBRONCHIAL_BLOCKER` — Endobronchial blocker (121 chars)

> Match blocker Fr size to ETT internal diameter and bronchoscope outer diameter; verify balloon and adapter compatibility.

### `ENDOBRONCHIAL_SPIGOT` — Endobronchial occlusion spigot/plug (97 chars)

> Match indication, airway size, deployment/removal technique, and current local regulatory status.

### `ENDOSCOPE_CLEANING_BRUSH` — Endoscope cleaning brush (66 chars)

> Match channel diameter/length and local reprocessing instructions.

### `ENDOSCOPIC_IRRIGATION_PUMP` — Endoscopic irrigation pump (73 chars)

> Match tubing set, connector, pressure/flow range, and endoscope platform.

### `ENDOSCOPIC_SUCTION_PUMP` — Endoscopic suction pump (69 chars)

> Match canister, tubing, vacuum range, and infection-control workflow.

### `ENDOSCOPY_CART` — Endoscopy system cart (67 chars)

> Match the processor/display platform and facility equipment policy.

### `ENDOSCOPY_LIGHT_CABLE` — Endoscopy light cable (73 chars)

> Match endoscope-side and light-source-side connectors and cable diameter.

### `ENDOSCOPY_MONITOR` — Endoscopy monitor (77 chars)

> Match video inputs, resolution, mounting, and current platform compatibility.

### `ENDOSCOPY_PROCESSOR_MOUNT_ACCESSORY` — Endoscopy processor mount accessory (155 chars)

> Treat as catalog-only room equipment unless a local workflow requires it; match the exact processor or display model and current manufacturer instructions.

### `ENERGY_CABLE_ADAPTER` — Energy-platform cable or adapter (120 chars)

> Match both connector standards, generator model, instrument, maximum electrical capacity, and reprocessing requirements.

### `ENERGY_PLATFORM` — Energy/hemostasis platform (88 chars)

> Match intended modality, probe, grounding/airway-fire protocol, and local credentialing.

### `ENERGY_PLATFORM_ACCESSORY` — Energy platform accessory (140 chars)

> Match the exact generator model and its mounting configuration; a footswitch is generation-specific and does not transfer between platforms.

### `FLEX_SCOPE_DIAGNOSTIC` — Diagnostic flexible bronchoscope (94 chars)

> Filter by outer diameter, working channel, image platform, and single-use/reusable preference.

### `FLEX_SCOPE_SINGLE_USE` — Single-use flexible bronchoscope (79 chars)

> Filter by outer diameter, channel, ETT/DLT compatibility, and display platform.

### `FLEX_SCOPE_THERAPEUTIC` — Therapeutic flexible bronchoscope (69 chars)

> Filter by channel requirement of planned accessories and airway size.

### `FLEX_SCOPE_THIN` — Thin flexible bronchoscope (178 chars)

> Filter by outer diameter, working-channel diameter, airway size, image platform, and current IFU; thin classification does not by itself establish therapeutic-tool compatibility.

### `FLUOROSCOPY_C_ARM` — Fluoroscopy C-arm (220 chars)

> Confirm the room can accommodate the system and that 3D acquisition is available if the plan depends on it. Identity only is recorded here — no dose, detector, or image-quality claim is carried from a marketing brochure.

### `FOREIGN_BODY_BASKET` — Airway retrieval basket/net (63 chars)

> Filter by sheath OD, opening size, channel, and working length.

### `FOREIGN_BODY_FORCEPS_FLEX` — Flexible grasping forceps (47 chars)

> Filter by jaw design, opening, OD, and channel.

### `GENERIC_AIRWAY_ADAPTER` — Airway bronchoscopy adapter (56 chars)

> Match ETT/DLT/tracheostomy tube and ventilation circuit.

### `GENERIC_DRAINAGE_UNIT` — Pleural drainage unit (24 chars)

> Hospital formulary item.

### `GENERIC_PPE` — PPE / isolation supplies (34 chars)

> Hospital infection-control policy.

### `GENERIC_SPECIMEN` — Specimen containers/labels (38 chars)

> Hospital and laboratory-specific item.

### `GENERIC_SUCTION` — Suction source/tubing/canister (23 chars)

> Hospital-specific item.

### `GENERIC_ULTRASOUND` — Ultrasound machine/probe cover (27 chars)

> Hospital-specific platform.

### `GUIDE_SHEATH_KIT` — Peripheral biopsy guide-sheath kit (118 chars)

> Match minimum channel, working length, compatible radial probe, included forceps/brush, and local navigation workflow.

### `GUIDING_DEVICE` — Peripheral guiding device (78 chars)

> Match bronchoscope channel, working length, compatible tools, and current IFU.

### `INFLATION_DEVICE` — Balloon inflation device (47 chars)

> Match balloon system and pressure requirements.

### `IPC_DRAINAGE_KIT` — Indwelling pleural catheter drainage kit (41 chars)

> Must match the implanted catheter family.

### `IPC_DRESSING_KIT` — IPC dressing kit (57 chars)

> Match catheter valve/system and local home-care workflow.

### `IPC_INSERTION_KIT` — Indwelling pleural catheter insertion kit (47 chars)

> Match catheter family and drainage accessories.

### `IPC_MANAGEMENT_ACCESSORY` — IPC management accessory (44 chars)

> Match exact catheter system and current IFU.

### `LASER_CONSOLE` — Surgical laser console (1118 chars)

> Wavelength decides tissue effect, and the choice is between depth and precision. Nd:YAG 1064 nm penetrates 5-15 mm and is the airway workhorse: poorly absorbed by water and haemoglobin, so it coagulates deeply and devascularizes a tumour before debulking, at 20-40 W. Nd:YAP 1340 nm penetrates 3-10 mm at about 20 W. Diode 980 nm penetrates 2-4 mm at about 20 W and 1470 nm penetrates 2-3 mm at about 10 W, both compact and air-cooled. KTP 532 nm and Ho:YAG 2100 nm penetrate under 1 mm and cut rather than coagulate — KTP at 15-35 W is what to reach for to incise a web-like stricture before dilation. CO2 10,600 nm penetrates under 1 mm at 4-8 W and is preferred for laryngeal and subglottic strictures, where precise cutting matters and deep haemostasis does not. Nd:YAG availability in the United States is now limited, and mobile laser service is how many centres reach Nd:YAG, KTP, and Ho:YAG at all — the catalogued consoles for those three wavelengths are all mobile-service offerings, and each records how far its own paperwork actually goes. Every product carries its lasing medium where a source states one.

### `LASER_FIBER` — Laser delivery fibre (608 chars)

> The fibre has to be made for the console wavelength — CO2 needs a hollow-core waveguide, the near-infrared wavelengths run on quartz. Contact with a bare fibre cuts; non-contact with an air-cooled catheter coagulates over a wider area, avoids the tip fouling with debris and blood, and is the mode to use for haemostasis. Power density is set as much by distance as by watts: close and high-power carbonizes and vaporizes, farther and low-power coagulates broadly, and most operators start low to coagulate the tumour before debulking. Check core diameter against the working channel, and keep the tip clean.

### `LASER_RESISTANT_ETT` — Laser-resistant endotracheal tube (517 chars)

> A standard endotracheal tube is not recommended when a laser will be fired in the airway: it is a flammable fuel source sitting in an oxidizer-rich field. Select a laser-resistant tube matched to the wavelength in use — resistance is not universal across wavelengths — and fill the cuff with saline or water so a cuff strike floods rather than feeds the fire. This is separate from the airway a rigid case uses, and it is the requirement whenever laser is applied through or beside an indwelling tube or tracheostomy.

### `LASER_SAFETY_EQUIPMENT` — Laser safety equipment (531 chars)

> Eyewear is specific to the laser and is not interchangeable between systems — protection at one wavelength gives none at another, so the eyewear that comes with the console is the eyewear the room wears, and everyone inside the nominal hazard zone wears it. Airway lasers are class 3B or 4. Cover door and window signage, wet drapes or towels around the site, sterile water or saline within reach, no alcohol-based prep, no hairspray or oil-based lubricants on team or patient, and a gown, gloves, and face shield for the operator.

### `MICROWAVE_ABLATION_CATHETER` — Bronchoscopic microwave ablation catheter (151 chars)

> Every device in this category is investigational in the United States; confirm study enrolment and regulatory status before planning a case around one.

### `NAV_ACCESSORY_SENSOR` — Navigation sensor or patient patch (101 chars)

> Match the sensor or patch to the exact platform generation, procedure configuration, and current IFU.

### `NAV_BRONCHOSCOPE_ADAPTER` — Navigation bronchoscope adapter (82 chars)

> Match the adapter to the bronchoscope model, navigation platform, and current IFU.

### `NAV_CATHETER_GUIDE` — Navigation catheter or guide (116 chars)

> Match the guide to the bronchoscope channel, navigation platform, working length, compatible tools, and current IFU.

### `NAV_PLATFORM_ACCESSORY` — Navigation platform accessory (120 chars)

> Match the accessory to the exact platform and generation; do not treat capital components as disposable catheter guides.

### `NAV_TBNA_NEEDLE` — Navigation-compatible TBNA needle (110 chars)

> Match the needle to the navigation platform, catheter or guide, working length, channel size, and current IFU.

### `PERC_TRACH_KIT` — Percutaneous tracheostomy kit (65 chars)

> Filter by technique, dilator/tube sizes, and included components.

### `PHOTODYNAMIC_DIFFUSER` — Photodynamic light diffuser (214 chars)

> Choose the diffuser length to cover the lesion while sparing normal mucosa, and avoid overlapping treatments that would overdose normal bronchial mucosa. Diffuser length sets the delivered power at a fixed fluence.

### `PHOTODYNAMIC_LASER` — Photodynamic activation laser (202 chars)

> Wavelength tolerance is narrow and is part of the labelling, not a preference. A red laser with different output characteristics can under-activate, overtreat, injure normal tissue, or damage the fibre.

### `PHOTODYNAMIC_PHOTOSENSITIZER` — Photodynamic photosensitizer (223 chars)

> Dose by weight and record the administration time: light activation follows at a defined interval, and the interval is part of the therapy rather than scheduling convenience. Counsel on prolonged cutaneous photosensitivity.

### `PLEURAL_DRAINAGE_ACCESSORY` — Pleural drainage accessory (77 chars)

> Match catheter hub, drainage system, intended air/fluid use, and current IFU.

### `PNEUMOTHORAX_KIT` — Pneumothorax catheter or aspiration kit (104 chars)

> Filter by insertion method, French size, catheter length, included one-way valve, and intended duration.

### `PULMONARY_GUIDEWIRE` — Pulmonary guidewire (30 chars)

> Match diameter and device IFU.

### `PULSED_FIELD_ABLATION_CATHETER` — Pulsed electric field electrode (121 chars)

> Restrict selection to the electrode the generator manufacturer names; confirm the cleared indication and the current IFU.

### `PULSED_FIELD_ABLATION_SYSTEM` — Pulsed electric field system (202 chars)

> Confirm the cleared indication before selecting: US clearance in this category is for surgical ablation of soft tissue, not for an airway indication. Match the generator to its own single-use electrode.

### `RADIAL_EBUS_DRIVE_UNIT` — Radial EBUS probe drive unit (44 chars)

> Match ultrasound processor and probe family.

### `RADIAL_EBUS_PROBE` — Radial EBUS probe (85 chars)

> Match probe frequency, working length, minimum channel, drive unit, and guide sheath.

### `RADIATION_PROTECTION` — Radiation protection (196 chars)

> Sized per person and worn by every person in the room, not only the operator. Catalogued products are hospital-local, so this is normally recorded as a custom line describing what the room stocks.

### `RIGID_BIPOLAR_FORCEPS` — Rigid bipolar forceps (70 chars)

> Match insert, sheath, handle, cable, generator, and barrel dimensions.

### `RIGID_BRONCHOSCOPE_ACCESSORY` — Rigid bronchoscopy accessory (72 chars)

> Match the rigid system model and opening required for accessory passage.

### `RIGID_BRONCHOSCOPE_BARREL` — Rigid bronchoscope barrel/tube (80 chars)

> Filter by internal/external diameter, working length, and ventilation interface.

### `RIGID_BRONCHOSCOPE_HEAD` — Rigid bronchoscope head (61 chars)

> Match barrel family, ports, ventilation strategy, and optics.

### `RIGID_BRONCH_ASPIRATION_BIOPSY_NEEDLE` — Rigid bronchoscopy aspiration biopsy needle (146 chars)

> Match straight or angled geometry, diameter, working length, compatible rigid bronchoscope components, reprocessing requirements, and current IFU.

### `RIGID_BRONCH_PUNCTURE_NEEDLE` — Rigid bronchoscopy puncture needle (133 chars)

> Match the required instrument guide, telescope, bronchoscope barrel size, working length, reprocessing requirements, and current IFU.

### `RIGID_BRONCH_SHAVER` — Rigid bronchoscopic shaver (98 chars)

> Match handpiece, motor controller, blade diameter, barrel lumen, and electrosurgical requirements.

### `RIGID_FORCEPS` — Rigid bronchoscopy forceps/instrument (65 chars)

> Match handle, shaft diameter, head, barrel ID, and intended task.

### `RIGID_SUCTION_CATHETER` — Rigid bronchoscopy suction catheter (52 chars)

> Filter by ID/OD, length, flexibility, and connector.

### `RIGID_TELESCOPE` — Rigid telescope (83 chars)

> Match telescope diameter, length, direction of view, and compatible barrel/forceps.

### `ROBOTIC_BIOPSY_NEEDLE` — Robotic bronchoscopy biopsy needle (114 chars)

> Match the needle to the robotic platform, bronchoscope or catheter, working length, channel size, and current IFU.

### `ROBOTIC_BRONCHOSCOPE` — Robotic bronchoscope (123 chars)

> Match the bronchoscope to the exact robotic platform generation and compatible procedure kit, accessories, and current IFU.

### `ROBOTIC_BRONCH_PLATFORM` — Robotic bronchoscopy platform (138 chars)

> Treat as installed capital equipment; match all scopes, catheters, kits, and accessories to the exact platform generation and current IFU.

### `ROBOTIC_CATHETER` — Robotic bronchoscopy catheter (157 chars)

> Restrict selection to the named robotic platform and generation; confirm tool-channel dimensions, compatible tools, procedure configuration, and current IFU.

### `ROBOTIC_PROCEDURE_KIT` — Robotic bronchoscopy procedure kit (87 chars)

> Match the kit to the exact robotic platform, bronchoscope or catheter, and current IFU.

### `SPECIMEN_TRAP` — Bronchoscopy specimen trap (51 chars)

> Match suction tubing and local laboratory workflow.

### `STENT_APPLICATOR` — Silicone stent applicator (54 chars)

> Match stent model, dimensions, and rigid bronchoscope.

### `TALC_POUDRAGE_KIT` — Talc poudrage kit (42 chars)

> Match local formulary and delivery method.

### `TALC_VIAL` — Sterile talc vial (49 chars)

> Match local formulary, dose, and delivery method.

### `TBNA_NEEDLE` — Conventional TBNA needle (54 chars)

> Filter by gauge, sheath diameter, and minimum channel.

### `TBNA_NEEDLE_CONVENTIONAL` — Conventional TBNA needle (103 chars)

> Filter by gauge, sheath diameter, working length, and minimum working channel; confirm the current IFU.

### `THORACENTESIS_KIT` — Thoracentesis kit/catheter (70 chars)

> Filter by French size, length, valved design, and drainage connection.

### `THORACOSCOPE_RIGID` — Thoracoscopy telescope (83 chars)

> Match diameter, working length, direction of view, trocar, camera, and light cable.

### `THORACOSCOPE_SEMIRIGID` — Pleuroscope (66 chars)

> Match processor, trocar, biopsy forceps, and channel requirements.

### `THORACOSCOPY_BIOPSY_FORCEPS` — Pleural biopsy forceps (45 chars)

> Match pleuroscope channel and working length.

### `THORACOSCOPY_ELECTRODE` — Thoracoscopy electrode (197 chars)

> Match shaft diameter and working length to the telescope channel, and confirm the generator, waveform, power setting, and return electrode against the current IFU — sell sheets state none of these.

### `THORACOSCOPY_PROBE` — Thoracoscopy surgical probe (49 chars)

> Match shaft diameter, working length, and trocar.

### `THORACOSCOPY_SCISSORS` — Thoracoscopy scissors (67 chars)

> Match diameter, working length, trocar capacity, and handle system.

### `THORACOSCOPY_TROCAR` — Pleuroscopy trocar (38 chars)

> Match pleuroscope and access strategy.

### `TOMOSYNTHESIS_NAVIGATION_SYSTEM` — Tomosynthesis navigation system (174 chars)

> Confirm C-arm compatibility and whether a per-procedure kit is required. These platforms supplement rather than replace the navigation modality already recorded for the case.

### `TRACH_TUBE_CUFFED` — Adult cuffed tracheostomy tube (65 chars)

> Filter by size, length, cuff, inner cannula, and flange geometry.

### `TRACH_TUBE_CUFFLESS` — Adult cuffless tracheostomy tube (59 chars)

> Filter by size, length, inner cannula, and flange geometry.

### `TRACH_TUBE_EVAC` — Subglottic suction tracheostomy tube (57 chars)

> Filter by tube size/length and suction-lumen requirement.

### `ULTRASOUND_CABLE` — Ultrasound cable (26 chars)

> Match scope and processor.

### `ULTRASOUND_PROCESSOR` — Endoscopic ultrasound processor (27 chars)

> Must match scope and cable.

### `VACUUM_LOCKING_SYRINGE` — Vacuum locking syringe (61 chars)

> Match volume, locking positions, stopcock, and needle system.

### `VIDEO_PROCESSOR` — Video processor / light source (60 chars)

> Must match the selected reusable or single-use bronchoscope.

### `WLL_CHEST_PERCUSSION` — Chest percussion device (185 chars)

> Confirm what the unit stocks and who applies it. Percussion during dwell is what mobilizes proteinaceous material into the effluent, so it is part of the therapy rather than an adjunct.

### `WLL_EFFLUENT_COLLECTION` — Graduated effluent collection (157 chars)

> Graduated so input and output can be reconciled each cycle, and clear enough to judge when the effluent stops clearing — both are how the endpoint is called.

### `WLL_FLUID_WARMER` — Fluid warmer (175 chars)

> Confirm the warmer can sustain the flow rate rather than only reach the temperature; instilling cool fluid causes shivering, bronchospasm, and heat loss across tens of litres.

### `WLL_LAVAGE_CIRCUIT` — WLL saline/tubing/drainage circuit (52 chars)

> Institution-designed and clinically validated setup.

### `WLL_WARMED_SALINE_SUPPLY` — Warmed saline supply (216 chars)

> Plan 30 to 50 L per lung in 3 L bags, warmed to body temperature before instillation. Confirm the stock actually on hand: this is far more volume than a routine case, and running short mid-lavage is the failure mode.
