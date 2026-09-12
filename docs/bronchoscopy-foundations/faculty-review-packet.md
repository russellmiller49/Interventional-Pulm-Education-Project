# Faculty and asset review packet

The core module is ready for content and anatomy review in its unlisted preview. This packet records what a reviewer must decide; it is not approval. No reviewer, rights holder, release date or publication permission has been inferred.

## Material to review

- Open `/en/bronchoscopy-foundations`, then the 23-section Learn pathway, paired Practice and eight-case Assess surface. [Module plan](module-plan.md) lists the sequence and progress boundary.
- [Implementation report](implementation-report.md) maps A01–A44 and H1–H12 to evidence and remaining scope.
- [Existing media register](media-register.json) inventories 94 existing photographs, stills, CT renders and the source survey video by public URI, bytes and hash. The video is available in the repository but is not played by the current foundations stage. Its stills are used. All rights, de-identification confirmations and clinical review fields remain pending.
- [Anatomy manifest](../../public/bronchoscopy-foundations/anatomy/manifest.json) records every new/derived geometry file and technical capture; [asset notes](scope-assets.md) describe source preservation, authored numbers and measured limits.
- Clinical content remains in `draft` validation state. Transcript citations explicitly carry approximate times and the statement that recordings/slides have not been reviewed. No generated prop replaces a missing source recording, waveform, culture table or finding image.

## Decisions and record

| Review area               | Question for the reviewer                                                                                                                               | Current disposition                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Core teaching and options | Do the claims, cited locations, distractors and keyed decisions support the stated beginner objective?                                                  | Pending; technical and cueing checks are not item validation         |
| Safety decisions          | Confirm the critical cases, unsafe choices, immediate safety feedback and noncompensatory capstone standard                                             | Pending faculty approval                                             |
| Default airway profile    | Confirm orientation, RML/RB4/RB5, lingula/LB4/LB5 and the combined left basal convention                                                                | One explicit normal profile; variants absent                         |
| Larynx                    | Review authored registration, fold morphology, airway appearance and scripted crossing                                                                  | Pending anatomical review                                            |
| Source inlet junction     | Permit an authored inlet exception with separate deviation accounting, or retain the visible pending limitation?                                        | Unresolved 2.4168 mm maximum surface gap; no seamless-geometry claim |
| Device props              | Are protected/exposed states recognizable and the teaching dimensions appropriately labeled?                                                            | Generic authored values; not device compatibility evidence           |
| Existing media            | Verify the rights holder, permissions, orientation and de-identification for each inventoried item                                                      | All clearance fields pending                                         |
| Local policies            | Confirm which institutional policies and IFUs should be linked for sedation, topical anesthesia, fasting, antithrombotics, samples, rescue and recovery | All 16 policy values remain null; no patient calculator              |
| Completion wording        | Confirm that activities, decisions, simulation inputs, observed hands and clinical performance remain distinct                                          | App records limited evidence; no independent-practice authorization  |
| Release                   | Approve content revision, anatomy profile, cleared assets and public entry/cutover                                                                      | No release or cutover performed                                      |

For an approval, record the reviewed commit, asset hashes, reviewer, date, permitted use and any limits. New geometry or content after that decision requires an updated review record. Optional E01–E04 must be reviewed as separate advanced-awareness extensions, not added silently to the core completion claim.

## Suggested review walkthrough

1. Start as a fresh learner. Confirm the single entry and the six-phase sequence in Shared airway and Five controls. Submit a deliberately unsupported prediction, then complete the actions and reload; the first decision must remain unchanged.
2. At the bench, distinguish rotation, deflection and depth. In Branch entry, aim before advancing. In View loss, compare contact red-out with a lens smear and the separate bleeding decision.
3. In Larynx and entry, inspect open, narrowing and closed folds, the manual Step option, and the transition into the trachea. Inspect the documented junction issue alongside the images.
4. In the survey, try to declare an unseen airway inspected, enter a branch without declaring it, and record RB10's limitation after seeing it. Inspect the explicit declaration record.
5. In Tube and Protected accessories, compare the authored geometry with the readouts and protected/exposed state. Confirm that no ventilation adequacy or device compatibility is inferred.
6. In Honest report, attempt a normal vocal-fold claim without the required observation. In Assess, choose one unsafe critical answer and seven held decisions; the standard must remain unmet. Inspect feedback before and after the final decision.
7. Repeat the main actions on a narrow display and with keyboard or touch. A personal observation of the actual hands and supervised patient care remains a separate faculty activity.
