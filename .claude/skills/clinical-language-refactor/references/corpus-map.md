# Starting transcript corpus and coverage

## Source files

**CC:** `Pasted markdown(20260910-221407).md` — 20,441 raw file lines.

**IP:** `Pasted markdown (2)(2).md` — 13,211 raw file lines.

The raw files are intentionally **not included** in this skill package. Keep the supplied copies in a private local source directory or the coding assistant's permitted attachment workspace. Do not publish them in the website repository. The SHA-256 fingerprints and exact episode ranges are in `source-manifest.json`.

**Local availability.** When this skill was installed (2026-09-10), neither file was found on the owner's machine, so the locators below were not re-verified; they come from the package author's structural index. Put the files in the private source folder (see `transcript-calibration.md`) and check their SHA-256 against the manifest before relying on a line range. Until then, cite a locator as package-derived.

All source line numbers below refer to the original UTF-8 files, including blank lines and timestamps. Timestamps are local to the episode. The episode titles are descriptive labels assigned for this package, not verified official publication titles. A timestamp reset alone was treated as a candidate and checked against nearby topic/introduction context.

## Identified sessions

| ID    | Descriptive session label               | Original source lines | Last timestamp |
| ----- | --------------------------------------- | --------------------- | -------------- |
| CC-01 | Hemodynamic monitoring                  | 1–2,368               | 24:15          |
| CC-02 | Acid-base interpretation                | 2,369–7,530           | 2:12:54        |
| CC-03 | ARDS                                    | 7,531–12,088          | 1:56:24        |
| CC-04 | APRV                                    | 12,089–15,654         | 1:31:20        |
| CC-05 | ECMO therapy                            | 15,655–17,996         | 1:03:39        |
| CC-06 | Mechanical ventilation bootcamp         | 17,997–20,441         | 20:11          |
| IP-01 | Peripheral bronchoscopy fundamentals    | 1–2,320               | 1:00:15        |
| IP-02 | EBUS and mediastinal staging (2023)     | 2,321–4,494           | 59:21          |
| IP-03 | Anesthesia for rigid bronchoscopy       | 4,495–7,446           | 1:05:27        |
| IP-04 | IPC for nonmalignant pleural effusions  | 7,447–10,224          | 1:01:43        |
| IP-05 | Nonmalignant central airway obstruction | 10,225–13,211         | 1:06:28        |

## Review status

The two files were structurally indexed, and relevant terminology passages and selected qualifications/Q&A were reviewed across the sessions. This is **not a claim that every utterance was read or that every clinical assertion was verified**. The profiles are draft editorial guides, not physician-approved medical policies. The per-module workflow requires reading the relevant source context before applying a medically meaningful replacement.

IP-02 explicitly places its staging discussion in December 2023. CC-06 explicitly introduces the bootcamp as 2022. Other recording dates and original URLs are not established by this package. References to “current,” “new,” or “the latest trial” in a recording are relative to that recording, not September 2026 or a later execution date.

## What this corpus can calibrate

| Area                       | Usable language coverage                                                                               | Boundary                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Peripheral bronchoscopy    | Scope handling, CT-anatomic correlation, rEBUS, localization, specimen acquisition                     | Not a current device comparison or diagnostic-yield synthesis                         |
| EBUS and staging           | Station identification, systematic assessment, ultrasound morphology, needle/suction/stylet discussion | Historical staging/device claims and personal preferences require separate review     |
| Rigid bronchoscopy         | Airway/anesthesia communication, ventilation approaches, case descriptions                             | No unverified safety rule, anesthetic regimen, or rescue procedure should be imported |
| Pleural disease            | IPCs, nonmalignant effusions, refractory symptoms, drainage/pleurodesis outcomes                       | Not comprehensive pleural disease, thoracoscopy, infection, or pneumothorax guidance  |
| Central airway obstruction | Location, extent, morphology, etiology, dynamic features, stenosis terminology                         | Preserve classification/version and stated definitions                                |
| Hemodynamics               | Measurements, fluid responsiveness, perfusion, fluid overload, bedside reasoning                       | Do not turn one speaker's sequence into a universal shock algorithm                   |
| Acid-base                  | pH state/process distinction, clinical context, mixed-process reasoning                                | Heuristics, numerical conversions, and disputed physiology are not validated here     |
| Mechanical ventilation     | Mode terminology, triggering/cycling, settings/readouts, respiratory mechanics                         | No replacement of model equations or protocol settings                                |
| ARDS/APRV                  | Terminology and examples of physiologic reasoning and debate                                           | Outcome claims and preferred settings remain attributed/unverified                    |
| ECMO                       | Circuit, cannulation, support categories, sweep terminology                                            | Limited as a modern troubleshooting or device-operating manual                        |
| CRRT and non-ECMO MCS      | Passing mentions only; no dedicated full teaching session identified                                   | Build from the selected module's own sources or additional supplied material          |

## High-value context checks

- **CC-02, 32:14–34:21, lines 3623–3707:** later explanation of chloride relative to sodium after earlier shorthand. Read both passages rather than extracting an absolute rule.
- **CC-02, 34:50–35:26, lines 3723–3747:** author describes the ownership and limits of her acid-base framework.
- **CC-02, 36:11–38:03, lines 3775–3847:** pH state versus underlying processes; meaningful use of the word “state.”
- **IP-01, 50:00–51:01, lines 1929–1965:** Q&A corrects the impression created by the scope-exchange demonstration.
- **IP-02, 18:02–18:57, lines 2975–3007:** imaging/inspection and sampling are separately described.
- **IP-04, 5:16–5:56, lines 7685–7715:** rationale for “nonmalignant” rather than “benign” effusion in this discussion.
- **CC-06, 11:03–14:07, lines 19339–19705:** technical ventilator terminology and a spoken correction distinguishing breath types from sequences.
- **CC-04, 1:25:06–1:28:13, lines 15407–15531:** late discussion separates enthusiasm for a mechanism from a definitive clinical-outcome conclusion.

Use `transcript-safeguards.md` for source-specific quarantine examples. Do not treat the list above as an exhaustive catalog of every qualification in the files.
