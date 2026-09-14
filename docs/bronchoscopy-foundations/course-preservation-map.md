# Objective and content preservation matrix

Baseline inventory made before implementation from `d209c800` (September 13, 2026); final locations below reflect the implemented course. All 92 core objective IDs remain; optional E01–E04 remain outside this course. Source claims and review status are retained, not newly approved.

Each objective maps to its existing item identities and/or the retained activity. The subtask and evidence columns preserve the authored meaning. Names such as M05-O3 describe the intended supervised learning objective; a screen task does not establish physical skill.

Blocks below retain their existing IDs, text (except obsolete navigation wording), source references, claim class and policy/review dependencies. Presentation and disclosure contracts are separate from evidence. All block IDs are validated and all 23 routes are walked through the rendered host.

## shared-airway

| Objective | Preserved subtask                                                                                                                                                | Evidence              | New location                         |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------ |
| M01-O1    | Places a well-returned lavage and a culture that would change treatment under different questions, separating a procedural observation from a diagnostic result. | committed-explanation | shared-airway-flow-v1-application    |
| M01-O2    | Sorts falling effort after sedation and gas drawn out by continuous suction as reasons the next move could be unsafe.                                            | committed-explanation | shared-airway-flow-v1-check (N01)    |
| M01-O3    | Commits an interpretation of unchanged oximetry on supplemental oxygen with reduced effort, in recovery.                                                         | committed-explanation | shared-airway-flow-v1-transfer (Q09) |
| M01-O4    | Commits a next step when a clear view coexists with lost airflow and a flattening capnography trace.                                                             | committed-explanation | shared-airway-flow-v1-check (N01)    |
| M01-O5    | Decides, in a practice case, how rigid access, flexible access, video and added guidance relate.                                                                 | case-decision         | Practice: mc-instrument-capabilities |

| Source block / role                     | Final chunk                         | Disclosure                                                           |
| --------------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| two-sources / framing                   | shared-airway-flow-v1-purpose       | Displayed teaching/debrief; absent during pending independent checks |
| what-is-available / signals             | shared-airway-flow-v1-purpose       | Displayed teaching/debrief; absent during pending independent checks |
| stable-examination / normal-reference   | shared-airway-flow-v1-purpose       | Displayed teaching/debrief; absent during pending independent checks |
| the-scope-shares-the-airway / mechanism | shared-airway-flow-v1-worked-safety | Displayed teaching/debrief; absent during pending independent checks |
| five-questions-worked / worked-example  | shared-airway-flow-v1-worked-safety | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors           | shared-airway-flow-v1-review        | Displayed teaching/debrief; absent during pending independent checks |
| capabilities / mechanism                | shared-airway-flow-v1-review        | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: shared-airway-flow-v1-application: sort. Explicit Finish is required.

Practice: mc-instrument-capabilities.

Model limit: The monitor in this section is scripted in words for teaching. It is not a physiological model, and no value on this page is a threshold for your patient.

## clinical-question

| Objective | Preserved subtask                                                                                                                                                                                                                                                                                                                                                                                | Evidence              | New location                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------ |
| M02-O1    | Commits, in the transfer, to establishing a missing current oxygen requirement before the plan is fixed, rather than assuming none, assuming the worst or cancelling; places two incomplete requests under “Not provided — must clarify” in the sort. The four-box plan itself is shown worked in “The lavage request, worked into a plan”; constructing one is observed in supervised practice. | committed-explanation | clinical-question-flow-v1-transfer (clinical-question-transfer); Practice: C03 |
| M02-O2    | Decides, in a practice case, the next move for a biopsy request in a patient on dual antiplatelet therapy after a recent coronary stent, where patient, procedure and prescribing-team factors change the plan.                                                                                                                                                                                  | case-decision         | clinical-question-flow-v1-transfer (clinical-question-transfer); Practice: C03 |
| M02-O3    | Reads how consent is explained and checked with teach-back, in the block on the consent conversation; the conversation itself is observed with a patient in supervised practice.                                                                                                                                                                                                                 | not-app-assessable    | clinical-question-flow-v1-application                                          |
| M02-O4    | Decides, in a practice case, what happens when the signed consent names a different side from the request and the CT at the time-out.                                                                                                                                                                                                                                                            | case-decision         | Practice: mc-time-out-side-discrepancy                                         |
| M02-O5    | Commits a justification for a requested diagnostic bronchoscopy, then sorts eight requests between noninvasive, bronchoscopic and not-yet-decidable pathways.                                                                                                                                                                                                                                    | committed-explanation | clinical-question-flow-v1-check (Q20)                                          |

| Source block / role                    | Final chunk                           | Disclosure                                                           |
| -------------------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| a-request-arrives / framing            | clinical-question-flow-v1-purpose     | Displayed teaching/debrief; absent during pending independent checks |
| in-front-of-you / signals              | clinical-question-flow-v1-purpose     | Displayed teaching/debrief; absent during pending independent checks |
| question-before-instrument / mechanism | clinical-question-flow-v1-purpose     | Displayed teaching/debrief; absent during pending independent checks |
| two-questions / mechanism              | clinical-question-flow-v1-purpose     | Displayed teaching/debrief; absent during pending independent checks |
| noninvasive-first / mechanism          | clinical-question-flow-v1-worked-plan | Displayed teaching/debrief; absent during pending independent checks |
| four-box-worked / worked-example       | clinical-question-flow-v1-worked-plan | Displayed teaching/debrief; absent during pending independent checks |
| what-changes-the-plan / mechanism      | clinical-question-flow-v1-planning    | Displayed teaching/debrief; absent during pending independent checks |
| risk-and-sedation / mechanism          | clinical-question-flow-v1-planning    | Displayed teaching/debrief; absent during pending independent checks |
| antithrombotic-decision / policy       | clinical-question-flow-v1-planning    | Displayed teaching/debrief; absent during pending independent checks |
| consent-conversation / mechanism       | clinical-question-flow-v1-team        | Displayed teaching/debrief; absent during pending independent checks |
| time-out / mechanism                   | clinical-question-flow-v1-team        | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors          | clinical-question-flow-v1-review      | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: clinical-question-flow-v1-application: sort. Explicit Finish is required.

Practice: C03, mc-time-out-side-discrepancy.

Model limit: The requests, patients and records in this section are constructed for teaching. Nothing here calculates for a patient: antithrombotic interruption, sedation and staffing follow your institution’s approved policies. The consent conversation and the time-out are team skills shown with a real patient and team, not on this page.

## pre-use-check

| Objective | Preserved subtask                                                                                                                                                                                                                                                                                                  | Evidence                         | New location                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| M03-O1    | Names eight outlined parts on real bronchoscope photographs — control section, suction valve and its port, biopsy valve adapter and the working-channel port, insertion tube, universal cord and rotary function — and reads what each does, what the bending section at the tip holds, and how misuse harms them. | committed-explanation            | pre-use-check-flow-v1-application                                                                                                     |
| M03-O2    | Chooses, in a practice case, between two released scopes from their device profiles for secretion clearance and a planned forceps biopsy, weighing the approved accessory against access and suction, and names what the choice still leaves to confirm.                                                           | case-decision                    | Practice: mc-scope-for-sampling                                                                                                       |
| M03-O3    | Commits the next move when suction does not draw at the tip while image and steering are ready; the four-system check itself is performed on a real instrument under faculty observation.                                                                                                                          | observed-physical-skill-required | pre-use-check-flow-v1-check (N02); pre-use-check-flow-v1-application; Faculty model station still required; physical skill unmeasured |
| M03-O4    | Decides, in a practice case, what happens to a clean, working scope with no documented reprocessing release, and to a single-use scope that has already been used.                                                                                                                                                 | case-decision                    | Practice: mc-unreleased-scope                                                                                                         |
| M03-O5    | Commits which conclusion easy passage through an endotracheal tube supports, separating external diameter, working-channel function, accessory compatibility and ventilation.                                                                                                                                      | committed-explanation            | pre-use-check-flow-v1-transfer (Q13)                                                                                                  |

| Source block / role            | Final chunk                      | Disclosure                                                           |
| ------------------------------ | -------------------------------- | -------------------------------------------------------------------- |
| what-ready-means / framing     | pre-use-check-flow-v1-instrument | Displayed teaching/debrief; absent during pending independent checks |
| ready-scope / normal-reference | pre-use-check-flow-v1-readiness  | Displayed teaching/debrief; absent during pending independent checks |
| suction-is-a-path / mechanism  | pre-use-check-flow-v1-readiness  | Displayed teaching/debrief; absent during pending independent checks |
| scene-worked / worked-example  | pre-use-check-flow-v1-readiness  | Displayed teaching/debrief; absent during pending independent checks |
| two-diameters / mechanism      | pre-use-check-flow-v1-release    | Displayed teaching/debrief; absent during pending independent checks |
| released-not-clean / mechanism | pre-use-check-flow-v1-release    | Displayed teaching/debrief; absent during pending independent checks |
| reprocessing-program / policy  | pre-use-check-flow-v1-release    | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors  | pre-use-check-flow-v1-review     | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: pre-use-check-flow-v1-application: identify. Explicit Finish is required.

Practice: mc-unreleased-scope, mc-scope-for-sampling.

Model limit: The photographs show one flexible bronchoscope and are authored teaching media, pending review. Parts, controls, dimensions and approved accessories differ between models, and the device’s instructions govern. Nothing on this page simulates suction, image quality or reprocessing, and the page’s text states no dimension for any scope; a number printed on the instrument in a photograph belongs to that model and is read against its instructions.

## sedation-and-monitoring

| Objective | Preserved subtask                                                                                                                                                                  | Evidence              | New location                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| M04-O1    | Decides, in a practice case, whether a patient’s responses after a further sedative dose still fit the planned depth, and separates a topical effect from sedation.                | case-decision         | Practice: mc-sedation-depth                                                                                                             |
| M04-O2    | Enters the milligrams for each measured line of a shared topical-anesthetic record from its concentration and volume, then commits what the cumulative record can state.           | committed-explanation | sedation-and-monitoring-flow-v1-check (Q19); sedation-and-monitoring-flow-v1-transfer (sedation-and-monitoring-transfer); Practice: C14 |
| M04-O3    | Reads responsiveness, the need for airway support, the capnography trace and oximetry together, in the same practice case.                                                         | case-decision         | Practice: mc-sedation-depth                                                                                                             |
| M04-O4    | Commits a next move, in a practice case, when confusion and a new irregular rhythm follow repeated topical doses.                                                                  | case-decision         | Practice: mc-toxicity-recognition                                                                                                       |
| M04-O5    | Commits what the shared record should state when one administration has no recorded amount, then decides the next move at a handoff where one administration was never called out. | committed-explanation | sedation-and-monitoring-flow-v1-check (Q19); sedation-and-monitoring-flow-v1-transfer (sedation-and-monitoring-transfer); Practice: C14 |

| Source block / role                  | Final chunk                                       | Disclosure                                                           |
| ------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------- |
| medicine-and-count / framing         | sedation-and-monitoring-flow-v1-medication-record | Displayed teaching/debrief; absent during pending independent checks |
| what-the-team-has / signals          | sedation-and-monitoring-flow-v1-medication-record | Displayed teaching/debrief; absent during pending independent checks |
| reconciled-record / normal-reference | sedation-and-monitoring-flow-v1-medication-record | Displayed teaching/debrief; absent during pending independent checks |
| arithmetic-worked / worked-example   | sedation-and-monitoring-flow-v1-medication-record | Displayed teaching/debrief; absent during pending independent checks |
| different-purposes / mechanism       | sedation-and-monitoring-flow-v1-monitoring        | Displayed teaching/debrief; absent during pending independent checks |
| depth-is-the-response / mechanism    | sedation-and-monitoring-flow-v1-monitoring        | Displayed teaching/debrief; absent during pending independent checks |
| monitoring-continuous / mechanism    | sedation-and-monitoring-flow-v1-monitoring        | Displayed teaching/debrief; absent during pending independent checks |
| medication-events / mechanism        | sedation-and-monitoring-flow-v1-review            | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors        | sedation-and-monitoring-flow-v1-review            | Displayed teaching/debrief; absent during pending independent checks |
| local-policy / policy                | sedation-and-monitoring-flow-v1-review            | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: sedation-and-monitoring-flow-v1-application: ledger. Explicit Finish is required.

Practice: C14, mc-sedation-depth, mc-toxicity-recognition.

Model limit: The monitor and the medication record in this section are scripted in words for teaching, and its arithmetic is educational. No value on this page is a threshold or a dose for your patient.

## five-controls

| Objective | Preserved subtask                                                                                                                                                                                                                      | Evidence                         | New location                                                                                                                                                                                                                                                                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M05-O1    | Decides, in a practice case, what to reset first when a trainee follows the image by walking around the bed with a raised elbow; the working position itself is observed at a faculty model station.                                   | observed-physical-skill-required | Practice: mc-trainee-circling-bed; five-controls-learn-depth; five-controls-learn-depth-repeat; five-controls-learn-bend; five-controls-learn-bend-repeat; five-controls-learn-rotation; five-controls-learn-rotation-repeat; five-controls-learn-combine; five-controls-learn-suction; five-controls-learn-suction-repeat; Faculty model station still required; physical skill unmeasured |
| M05-O2    | Predicts what turning the control section does to the image and the bending plane, then uses rotation, deflection, advancement and withdrawal, and suction one at a time at the bench; the hands are observed at the faculty stations. | observed-physical-skill-required | five-controls-learn-check (N03); five-controls-learn-depth; five-controls-learn-depth-repeat; five-controls-learn-bend; five-controls-learn-bend-repeat; five-controls-learn-rotation; five-controls-learn-rotation-repeat; five-controls-learn-combine; five-controls-learn-suction; five-controls-learn-suction-repeat; Faculty model station still required; physical skill unmeasured   |

| Source block / role                   | Final chunk                    | Disclosure                                                                                          |
| ------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| what-the-hands-change / framing       | five-controls-learn-instrument | Extended technique reference; essential cue and model boundary also in the displayed pilot teaching |
| what-to-watch / signals               | five-controls-learn-depth      | Extended technique reference; essential cue and model boundary also in the displayed pilot teaching |
| working-position / normal-reference   | five-controls-learn-instrument | Extended technique reference; essential cue and model boundary also in the displayed pilot teaching |
| what-each-control-changes / mechanism | five-controls-learn-rotation   | Extended technique reference; essential cue and model boundary also in the displayed pilot teaching |
| bench-sequence / worked-example       | five-controls-learn-combine    | Extended technique reference; essential cue and model boundary also in the displayed pilot teaching |
| common-errors / common-errors         | five-controls-learn-suction    | Extended technique reference; essential cue and model boundary also in the displayed pilot teaching |
| faculty-station / boundary            | five-controls-learn-suction    | Extended technique reference; essential cue and model boundary also in the displayed pilot teaching |

Activity evidence: five-controls-learn-depth: scope-task (advance-then-withdraw); five-controls-learn-depth-repeat: scope-task (advance-then-withdraw); five-controls-learn-bend: scope-task (bend-and-release); five-controls-learn-bend-repeat: scope-task (bend-and-release); five-controls-learn-rotation: scope-task (rotate-bend-rotate); five-controls-learn-rotation-repeat: scope-task (turn-bent-tip); five-controls-learn-combine: scope-task (center-and-approach); five-controls-learn-suction: scope-task (suction-on-off); five-controls-learn-suction-repeat: scope-task (suction-repeat); five-controls-learn-transfer: scope-task (center-and-approach). Explicit Finish is required.

Practice: mc-trainee-circling-bed.

Model limit: The bench in this section is a keyboard, pointer and touch model of one teaching scope. It does not reproduce the weight or feel of the instrument, the resistance of the lever, torque transmission along a real shaft in a curved airway, or suction behavior: what the channel actually draws, or the wall drawn onto the tip. Goals met here show the idea, not the hands; the hands are observed by faculty at a model station.

## branch-entry

| Objective | Preserved subtask                                                                                                                                                                                                                                                                                                                                                                           | Evidence                         | New location                                                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M05-O3    | In the bronchoscope view, travels to the carina, enters the right main bronchus, withdraws to the trachea and enters the left with no wall contact and no advance refused for lack of aim, then stays above the carina through an image capture and the assistant’s call with no forward drift or wall contact. The same movements with real hands are shown to faculty at a model station. | observed-physical-skill-required | branch-entry-flow-v1-transfer (branch-entry-transfer); branch-entry-flow-v1-application; branch-entry-flow-v1-hold-view; Faculty model station still required; physical skill unmeasured                   |
| M05-O4    | Commits the correction for a tip dragging along the wall while withdrawing from a sharply angled bronchus, with the landmark that ends the move. Making that correction with real hands is shown to faculty at a model station.                                                                                                                                                             | committed-explanation            | branch-entry-flow-v1-transfer (branch-entry-transfer)                                                                                                                                                      |
| M05-O5    | Commits the first correction when the control section turns and the image barely moves, reading an observer’s view of both hands as well as the image, and again in a practice case with a different cause. The correction itself, with an observer watching both hands and the screen, is shown to faculty at a model station.                                                             | observed-physical-skill-required | branch-entry-flow-v1-check (Q14); Practice: mc-handle-turns-view-static; branch-entry-flow-v1-application; branch-entry-flow-v1-hold-view; Faculty model station still required; physical skill unmeasured |

| Source block / role                    | Final chunk                       | Disclosure                                                           |
| -------------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| carina-and-back / framing              | branch-entry-flow-v1-reference    | Displayed teaching/debrief; absent during pending independent checks |
| what-to-watch / signals                | branch-entry-flow-v1-reference    | Displayed teaching/debrief; absent during pending independent checks |
| controlled-entry / normal-reference    | branch-entry-flow-v1-reference    | Displayed teaching/debrief; absent during pending independent checks |
| entry-sequence-worked / worked-example | branch-entry-flow-v1-worked-entry | Displayed teaching/debrief; absent during pending independent checks |
| where-the-turn-goes / mechanism        | branch-entry-flow-v1-worked-entry | Displayed teaching/debrief; absent during pending independent checks |
| holding-the-view / mechanism           | branch-entry-flow-v1-hold         | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors          | branch-entry-flow-v1-review       | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: branch-entry-flow-v1-application: scope-task (reach-carina, enter-right, back-to-trachea, enter-left, no-force); branch-entry-flow-v1-hold-view: observe (acknowledge, capture, hold, no-drift). Explicit Finish is required.

Practice: mc-handle-turns-view-static.

Model limit: The scope pane shows the image and the controls you press. It cannot show your hands or the part of the scope outside the patient, and it does not represent the feel of the instrument; what the hands and the outside shaft do in this section is described in words. Guided walk keeps the tip on each airway’s centerline and waits until the tip is aimed before it advances: entry here is assisted and recorded as such. Wall contact and drift are feedback signals, not measures of force, injury or skill.

## reference-frames

| Objective | Preserved subtask                                                                                                                                                                                                                                      | Evidence              | New location                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------- |
| M06-O1    | Places the trachea’s ringless membranous wall in the patient’s frame, then names each marked airway on one path down the right side, across coronal and axial CT slices and a camera still, from the main carina and the main-bronchial relationships. | committed-explanation | Practice: C12                                                    |
| M06-O2    | Commits what decides which opening leads toward the lower lobe after a shaft rotation has turned the image and, in practice, reads an atlas clock position against the view from the patient’s side.                                                   | committed-explanation | reference-frames-flow-v1-check (Q03); Practice: mc-rotated-image |
| M06-O5    | Traces the right upper lobe takeoff, the bronchus intermedius and the middle lobe across CT slices, and commits what a quarter-turn rotation of a displayed still changes.                                                                             | committed-explanation | reference-frames-flow-v1-transfer (Q15); Practice: C12           |

| Source block / role                                | Final chunk                         | Disclosure                                                           |
| -------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| which-airway / framing                             | reference-frames-flow-v1-viewpoints | Displayed teaching/debrief; absent during pending independent checks |
| on-hand-at-the-scope / signals                     | reference-frames-flow-v1-viewpoints | Displayed teaching/debrief; absent during pending independent checks |
| trachea-to-bronchus-intermedius / normal-reference | reference-frames-flow-v1-viewpoints | Displayed teaching/debrief; absent during pending independent checks |
| how-each-display-is-made / normal-reference        | reference-frames-flow-v1-ct-display | Displayed teaching/debrief; absent during pending independent checks |
| one-airway-three-frames / mechanism                | reference-frames-flow-v1-viewpoints | Displayed teaching/debrief; absent during pending independent checks |
| tracing-the-right-side / worked-example            | reference-frames-flow-v1-ct-display | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors                      | reference-frames-flow-v1-review     | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: reference-frames-flow-v1-application: identify. Explicit Finish is required.

Practice: C12, mc-rotated-image.

Model limit: The CT slices and camera stills are authored teaching media, pending review: fixed, pre-rendered views from normal teaching airways, with crosshairs and outlines placed by the lesson. They are not a stack you can scroll, they are not offered as one patient’s matched study, and they show no variant anatomy.

## view-loss

| Objective | Preserved subtask                                                                                                                                                                                                                                                                                                                                                          | Evidence              | New location                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| M06-O3    | Commits the next move for a close red field during a stable inspection with nothing deployed, then recovers a scripted red field and a smeared lens in the model, each by its own recovery.                                                                                                                                                                                | committed-explanation | view-loss-flow-v1-check (Q04); view-loss-flow-v1-transfer (view-loss-transfer); Practice: mc-dark-field |
| M06-O4    | Commits a recovery for a clear view of an airway that cannot be named while a brush is exposed, accounting for the accessory before the scope is withdrawn; the exception, a scope holding back a bleed, is named after commitment and committed in the bleeding-priorities section; the practice case retraces a left-sided misidentification to the last certain parent. | committed-explanation | view-loss-flow-v1-transfer (view-loss-transfer); Practice: C02                                          |

| Source block / role                  | Final chunk                   | Disclosure                                                           |
| ------------------------------------ | ----------------------------- | -------------------------------------------------------------------- |
| lumen-disappears / framing           | view-loss-flow-v1-normal-view | Displayed teaching/debrief; absent during pending independent checks |
| what-to-read / signals               | view-loss-flow-v1-normal-view | Displayed teaching/debrief; absent during pending independent checks |
| usable-view / normal-reference       | view-loss-flow-v1-normal-view | Displayed teaching/debrief; absent during pending independent checks |
| one-sign-five-problems / mechanism   | view-loss-flow-v1-recovery    | Displayed teaching/debrief; absent during pending independent checks |
| recovery-routine / worked-example    | view-loss-flow-v1-recovery    | Displayed teaching/debrief; absent during pending independent checks |
| accessory-out / mechanism            | view-loss-flow-v1-exceptions  | Displayed teaching/debrief; absent during pending independent checks |
| scope-holding-a-bleed / mechanism    | view-loss-flow-v1-exceptions  | Displayed teaching/debrief; absent during pending independent checks |
| darkness-not-a-direction / mechanism | view-loss-flow-v1-recovery    | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors        | view-loss-flow-v1-review      | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: view-loss-flow-v1-application: scope-task (lumen-back-without-advancing, lumen-back-without-suction, on-to-the-carina); view-loss-flow-v1-lens: observe (lens-cleared-without-advancing). Explicit Finish is required.

Practice: C02, mc-dark-field.

Model limit: The bronchoscope view is a teaching model of the adult airway, and each change in the view on these steps is scripted. The model does not represent tissue or force, and nothing it records is a measure of injury or skill. The patients in the items are constructed for teaching.

## larynx-and-entry

| Objective | Preserved subtask                                                                                                                                                                                                                | Evidence                         | New location                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| M07-O1    | Decides, in a practice case on the airway model, what the tip is aimed at when the arytenoid region is taken for the opening, and which pair of folds bounds the opening into the trachea.                                       | case-decision                    | Practice: mc-arytenoids-as-glottis                                                                                                          |
| M07-O2    | Commits the moment to cross from the movement of the true folds with breathing and phonation, and records a larynx hidden by a tube as not assessed.                                                                             | committed-explanation            | larynx-and-entry-flow-v1-check (N04); larynx-and-entry-flow-v1-transfer (Q17)                                                               |
| M07-O3    | Decides, in a practice case, what resistance, pain and bleeding during a nasal entry change, including a change to the oral approach; controlled model entry is observed by faculty.                                             | observed-physical-skill-required | Practice: mc-nasal-resistance; larynx-and-entry-flow-v1-application; Faculty model station still required; physical skill unmeasured        |
| M07-O4    | In the bronchoscope view, crosses the glottis while the true folds are apart, without advancing against closure, and names the trachea below by its rings and membranous wall; the hand skill on a model is observed by faculty. | observed-physical-skill-required | larynx-and-entry-flow-v1-check (N04); larynx-and-entry-flow-v1-application; Faculty model station still required; physical skill unmeasured |
| M07-O5    | Commits a withdrawal plan through an endotracheal tube: a deliberate look below the tube on the way out, the covered larynx and trachea recorded as not assessed, and the tube left to the airway team.                          | committed-explanation            | larynx-and-entry-flow-v1-transfer (Q17)                                                                                                     |

| Source block / role                             | Final chunk                     | Disclosure                                                           |
| ----------------------------------------------- | ------------------------------- | -------------------------------------------------------------------- |
| before-the-trachea / framing                    | larynx-and-entry-flow-v1-tour   | Displayed teaching/debrief; absent during pending independent checks |
| in-view-above / signals                         | larynx-and-entry-flow-v1-tour   | Displayed teaching/debrief; absent during pending independent checks |
| normal-laryngeal-examination / normal-reference | larynx-and-entry-flow-v1-tour   | Displayed teaching/debrief; absent during pending independent checks |
| crossing-on-the-opening / mechanism             | larynx-and-entry-flow-v1-entry  | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors                   | larynx-and-entry-flow-v1-review | Displayed teaching/debrief; absent during pending independent checks |
| darkness-above-the-glottis / mechanism          | larynx-and-entry-flow-v1-entry  | Displayed teaching/debrief; absent during pending independent checks |
| mouth-or-nose / mechanism                       | larynx-and-entry-flow-v1-entry  | Displayed teaching/debrief; absent during pending independent checks |
| where-to-look / mechanism                       | larynx-and-entry-flow-v1-entry  | Displayed teaching/debrief; absent during pending independent checks |
| entry-and-withdrawal / mechanism                | larynx-and-entry-flow-v1-review | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: larynx-and-entry-flow-v1-application: scope-task (cross-glottis-open, name-the-trachea, no-advance-against-closure). Explicit Finish is required.

Practice: mc-arytenoids-as-glottis, mc-nasal-resistance.

Model limit: The larynx in this course is a model. Its folds move on a scripted cycle, with a scripted cough now and then, that stands in for a patient’s; its tissue has no feel and does not bleed or swell; and contact is counted, not felt as force. A patient’s larynx can be narrower, can close on contact and can cough, so the ease of crossing here says nothing about crossing in a patient. A still image is a single frame and cannot show how the folds move.

## right-side

| Objective | Preserved subtask                                                                                                                                                                                                                                                                                  | Evidence                         | New location                                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M08-O1    | Commits which structure the scope is in after a steady advance from the right main bronchus, when an anterior opening lies ahead with the lumen continuing beyond it.                                                                                                                              | committed-explanation            | right-side-flow-v1-check (Q01)                                                                                                                               |
| M08-O2    | Commits the name and parent of a posteriorly directed opening at the middle lobe level in a practice case, after the normal reference names RB1 to RB10 by parent; the scope tasks bring RB1 to RB3 into view and enter RB4 to RB6 with the parentage readout as an assist, not as identification. | case-decision                    | Practice: mc-rb6-parentage                                                                                                                                   |
| M08-O3    | Enters RB4 and RB5 from the middle lobe, returns through the bronchus intermedius and enters RB6 from the right lower lobe; the hand skill itself needs faculty observation.                                                                                                                       | observed-physical-skill-required | Practice: mc-rb6-parentage; right-side-flow-v1-application; right-side-flow-v1-changed-view; Faculty model station still required; physical skill unmeasured |
| M08-O4    | Commits the next move when three large basal openings are in view and the medial basal origin has not been seen, and explains why the basal group is a grouping rather than one division.                                                                                                          | committed-explanation            | right-side-flow-v1-transfer (N05)                                                                                                                            |
| M08-O5    | Decides, in a practice case, what to do when a teaching model shows two right upper lobe openings and a separate opening in the proximal trachea.                                                                                                                                                  | case-decision                    | Practice: C11                                                                                                                                                |

| Source block / role                    | Final chunk                    | Disclosure                                                           |
| -------------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| short-right-main / framing             | right-side-flow-v1-normal-tour | Displayed teaching/debrief; absent during pending independent checks |
| what-names-an-airway / signals         | right-side-flow-v1-normal-tour | Displayed teaching/debrief; absent during pending independent checks |
| right-side-in-order / normal-reference | right-side-flow-v1-normal-tour | Displayed teaching/debrief; absent during pending independent checks |
| beyond-and-back / mechanism            | right-side-flow-v1-parentage   | Displayed teaching/debrief; absent during pending independent checks |
| two-parents / mechanism                | right-side-flow-v1-parentage   | Displayed teaching/debrief; absent during pending independent checks |
| grouping-not-division / mechanism      | right-side-flow-v1-parentage   | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors          | right-side-flow-v1-review      | Displayed teaching/debrief; absent during pending independent checks |
| missing-branch / mechanism             | right-side-flow-v1-review      | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: right-side-flow-v1-application: scope-task (expose-upper-lobe-origin, enter-from-parent, upper-lobe-segments); right-side-flow-v1-changed-view: observe (enter-lateral, enter-medial, superior-from-lower-lobe). Explicit Finish is required.

Practice: C11, mc-rb6-parentage.

Model limit: This section drives one declared teaching profile of normal right-sided anatomy. A variant such as a tracheal bronchus appears only in a practice case, in words; the scope shows no variant. Guided, centerline-locked travel and a camera roll set to a reference view at the upper and middle lobes are assists, and contact and red-out are feedback signals, not measurements of force, mucosal injury or hand skill.

## left-side

| Objective | Preserved subtask                                                                                                                                                                                          | Evidence                         | New location                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| M09-O1    | From a rotated start in the left main bronchus, enters the lingular division without entering the upper division, then withdraws to the left main bronchus and enters LB6 without entering a basal branch. | simulated-navigation             | left-side-flow-v1-application                                                                  |
| M09-O2    | Commits the name of left B4 against the right side’s name for the same number, before the section’s naming block opens at Explain.                                                                         | committed-explanation            | left-side-flow-v1-check (Q02)                                                                  |
| M09-O3    | Walks LB4, LB5 and then LB6, retracing to the left main bronchial division between the lingula and the lower lobe; the hand skill itself needs faculty observation.                                        | observed-physical-skill-required | left-side-flow-v1-application; Faculty model station still required; physical skill unmeasured |
| M09-O4    | Decides, in a practice case, what the record says when a checklist expects a separate LB7 on a combined LB7+8 profile.                                                                                     | case-decision                    | Practice: mc-lb7-8-convention                                                                  |
| M09-O5    | Commits the next move before naming the basal bronchi of the left lower lobe after the shaft has been turned, when a count or a screen order offers a name.                                                | committed-explanation            | left-side-flow-v1-transfer (left-side-transfer)                                                |

| Source block / role                    | Final chunk                 | Disclosure                                                           |
| -------------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| naming-the-left / framing              | left-side-flow-v1-tour      | Displayed teaching/debrief; absent during pending independent checks |
| what-you-have / signals                | left-side-flow-v1-tour      | Displayed teaching/debrief; absent during pending independent checks |
| usual-left-side / normal-reference     | left-side-flow-v1-tour      | Displayed teaching/debrief; absent during pending independent checks |
| left-names / mechanism                 | left-side-flow-v1-tour      | Displayed teaching/debrief; absent during pending independent checks |
| lingula-to-lower-lobe / worked-example | left-side-flow-v1-parentage | Displayed teaching/debrief; absent during pending independent checks |
| basal-convention / mechanism           | left-side-flow-v1-parentage | Displayed teaching/debrief; absent during pending independent checks |
| basal-relationships / mechanism        | left-side-flow-v1-parentage | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors          | left-side-flow-v1-review    | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: left-side-flow-v1-application: scope-task (lingular-division, lingular-segments, retrace, superior-segment). Explicit Finish is required.

Practice: mc-lb7-8-convention.

Model limit: One declared teaching profile, with a combined LB7+8; patients vary, and a separate LB7 or another variant is a different profile. The walk is guided along the centerline, the starting rotation is authored for teaching, this section shows no secretions or patient movement, and nothing here shows the hand skill.

## systematic-survey

| Objective | Preserved subtask                                                                                                                                                                                                                                        | Evidence                         | New location                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| M10-O1    | Surveys the right lower lobe in the guided walk without avoidable omissions — each accessible airway inspected and each limitation recorded, including a medial basal segment that may arise early; the survey itself is observed by faculty on a model. | observed-physical-skill-required | systematic-survey-flow-v1-application; Faculty model station still required; physical skill unmeasured |
| M10-O2    | Commits the status a segment may carry when the scope entered it while the lens stayed smeared, then sets each airway’s status in the inspection record during the survey.                                                                               | committed-explanation            | systematic-survey-flow-v1-check (N07); systematic-survey-flow-v1-transfer (N08)                        |
| M10-O3    | After the survey, returns to the superior segment of the right lower lobe in the guided walk, with the assists used recorded.                                                                                                                            | simulated-navigation             | systematic-survey-flow-v1-application                                                                  |
| M10-O4    | Records a narrowed posterior basal segment as not safely accessible without forcing entry, and commits what the record says when the patient ends a survey early.                                                                                        | committed-explanation            | systematic-survey-flow-v1-transfer (N08)                                                               |
| M10-O5    | Decides, in a practice case, whether a rapid narrated survey sets the standard for a complete one.                                                                                                                                                       | case-decision                    | Practice: mc-narrated-ninety-seconds                                                                   |

| Source block / role                | Final chunk                             | Disclosure                                                           |
| ---------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| what-a-survey-leaves / framing     | systematic-survey-flow-v1-survey-order  | Displayed teaching/debrief; absent during pending independent checks |
| what-the-record-rests-on / signals | systematic-survey-flow-v1-survey-order  | Displayed teaching/debrief; absent during pending independent checks |
| default-order / normal-reference   | systematic-survey-flow-v1-survey-order  | Displayed teaching/debrief; absent during pending independent checks |
| separate-observations / mechanism  | systematic-survey-flow-v1-worked-record | Displayed teaching/debrief; absent during pending independent checks |
| lower-lobe-worked / worked-example | systematic-survey-flow-v1-worked-record | Displayed teaching/debrief; absent during pending independent checks |
| withdrawal-and-return / mechanism  | systematic-survey-flow-v1-worked-record | Displayed teaching/debrief; absent during pending independent checks |
| when-the-survey-yields / mechanism | systematic-survey-flow-v1-worked-record | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors      | systematic-survey-flow-v1-review        | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: systematic-survey-flow-v1-application: scope-task (inspect-the-lobe, clear-the-smeared-lens, record-the-posterior-basal, no-airway-left-blank, return-to-the-superior-segment). Explicit Finish is required.

Practice: mc-narrated-ninety-seconds.

Model limit: The survey here is an assisted walk along the airway centerlines of one teaching profile, with a scripted narrowing, a scripted smear on the lens and no drawn mucosa or findings. The model cannot judge whether a view was adequate, so any status you set is recorded as your declaration. It also leaves out the patient, whose signals can end a survey at any airway.

## describe-findings

| Objective | Preserved subtask                                                                                                                                                                                                                                                                     | Evidence              | New location                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------- |
| M11-O1    | Chooses, field by field, the structure, caliber, distal view, mucosa and contents entries the examination supports for a lesion in the right main bronchus; in a practice case, inspects the wall a cleared plug covered and keeps the secretions’ appearance apart from a diagnosis. | committed-explanation | Practice: mc-plug-then-lesion                                        |
| M11-O2    | Commits whether to record a smooth lesion with prominent vessels by its site and appearance or by the diagnosis it suggests, and refuses a histological label in the report.                                                                                                          | committed-explanation | describe-findings-flow-v1-check (N09); Practice: mc-plug-then-lesion |
| M11-O3    | Refuses, in the report, “safe to biopsy” and a single small sample for a lesion with prominent surface vessels, and holds sampling for experienced guidance; the prediction refuses a report line that clears it for biopsy.                                                          | committed-explanation | describe-findings-flow-v1-check (N09)                                |
| M11-O4    | Refuses, in the report, a narrowing “measured” from an uncalibrated monitor image and a dynamic collapse read from a single saved still.                                                                                                                                              | committed-explanation | describe-findings-flow-v1-application                                |
| M11-O5    | Builds the report under structure, mucosa and contents, with the narrowing given as a visual estimate of the diameter, and works out in the transfer how much cross-sectional area a halved diameter takes away.                                                                      | committed-explanation | describe-findings-flow-v1-transfer (Q18)                             |

| Source block / role                   | Final chunk                               | Disclosure                                                           |
| ------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| something-unexpected / framing        | describe-findings-flow-v1-normal          | Displayed teaching/debrief; absent during pending independent checks |
| normal-right-main / normal-reference  | describe-findings-flow-v1-normal          | Displayed teaching/debrief; absent during pending independent checks |
| the-finding / signals                 | describe-findings-flow-v1-written-finding | Displayed teaching/debrief; absent during pending independent checks |
| structure-mucosa-contents / mechanism | describe-findings-flow-v1-normal          | Displayed teaching/debrief; absent during pending independent checks |
| finding-described / worked-example    | describe-findings-flow-v1-written-finding | Displayed teaching/debrief; absent during pending independent checks |
| findings-that-pause / mechanism       | describe-findings-flow-v1-review          | Displayed teaching/debrief; absent during pending independent checks |
| still-and-screen / mechanism          | describe-findings-flow-v1-written-finding | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors         | describe-findings-flow-v1-review          | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: describe-findings-flow-v1-application: report. Explicit Finish is required.

Practice: mc-plug-then-lesion.

Model limit: The finding in this section is given in words, because the course has no image of an abnormal airway; the introductory still is a normal right main bronchus, for comparison. Choosing entries on a card is practice for the report you will write and speak, which faculty review.

## washing-and-lavage

| Objective | Preserved subtask                                                                                                                                                                                                                     | Evidence                         | New location                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| M12-O1    | Commits a name for saline instilled and recovered in the trachea, and, in the transfer, the next move when a therapeutic aspiration stalls, where a lavage’s method does not apply.                                                   | committed-explanation            | washing-and-lavage-flow-v1-check (Q06); washing-and-lavage-flow-v1-transfer (washing-and-lavage-transfer) |
| M12-O2    | Chooses the lavage segment for a focal consolidation from the imaging rather than a habitual site, in a practice case; places the choice of segment first, and its confirmation before the wedge and any saline, in the BAL sequence. | case-decision                    | Practice: mc-lavage-site-selection                                                                        |
| M12-O3    | Places the gentle wedge before instillation, and the reassessment of the seal, the airway, the return and the patient before any further aliquot, in the BAL sequence; the hands are shown to faculty.                                | observed-physical-skill-required | washing-and-lavage-flow-v1-application; Faculty model station still required; physical skill unmeasured   |
| M12-O4    | Chooses, in a practice case, what a lavage note must add when serial returns change — each return’s character in order, the volumes and how the fractions were handled — and closes the BAL sequence with the record.                 | case-decision                    | Practice: mc-lavage-note                                                                                  |

| Source block / role                | Final chunk                                | Disclosure                                                           |
| ---------------------------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| saline-in-the-airway / framing     | washing-and-lavage-flow-v1-purposes        | Displayed teaching/debrief; absent during pending independent checks |
| what-to-notice / signals           | washing-and-lavage-flow-v1-purposes        | Displayed teaching/debrief; absent during pending independent checks |
| four-procedures / mechanism        | washing-and-lavage-flow-v1-purposes        | Displayed teaching/debrief; absent during pending independent checks |
| lavage-worked / worked-example     | washing-and-lavage-flow-v1-worked-sequence | Displayed teaching/debrief; absent during pending independent checks |
| gentle-seal / mechanism            | washing-and-lavage-flow-v1-worked-sequence | Displayed teaching/debrief; absent during pending independent checks |
| volumes-recorded / policy          | washing-and-lavage-flow-v1-worked-sequence | Displayed teaching/debrief; absent during pending independent checks |
| therapeutic-aspiration / mechanism | washing-and-lavage-flow-v1-review          | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors      | washing-and-lavage-flow-v1-review          | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: washing-and-lavage-flow-v1-application: sequence. Explicit Finish is required.

Practice: mc-lavage-site-selection, mc-lavage-note.

Model limit: Nothing in this section models fluid, suction or a wedge. The sequence teaches the order and the reasons; it does not measure wedge quality, instilled or recovered volume, or lavage technique, and no volume on this page is a target for your patient.

## poor-return

| Objective | Preserved subtask                                                                                                                                                                                                                                                                                                                                                                 | Evidence              | New location                                                          |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------- |
| M12-O5    | Commits, in the prediction, to the response when the lumen closes under suction, and in practice to what follows when low return persists after the seal, the lumen and the suction path are checked; rehearses, frame by frame in a scripted lavage, the response to a leak around the tip, collapse under suction, no return through a patent airway and a change in tolerance. | committed-explanation | poor-return-flow-v1-check (Q07); Practice: mc-low-return-after-checks |
| M12-O6    | Commits, in the transfer, to clearing secretions that impair breathing before a planned microbiologic lavage and recording the sequence; stops instilling short of the planned volume when tolerance worsens; records an interrupted lavage as it happened, in practice.                                                                                                          | committed-explanation | poor-return-flow-v1-transfer (Q22); Practice: C15                     |

| Source block / role              | Final chunk                   | Disclosure                                                           |
| -------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| little-comes-back / framing      | poor-return-flow-v1-baseline  | Displayed teaching/debrief; absent during pending independent checks |
| where-to-look / signals          | poor-return-flow-v1-baseline  | Displayed teaching/debrief; absent during pending independent checks |
| going-to-plan / normal-reference | poor-return-flow-v1-baseline  | Displayed teaching/debrief; absent during pending independent checks |
| two-more-causes / mechanism      | poor-return-flow-v1-reasoning | Displayed teaching/debrief; absent during pending independent checks |
| patient-first / mechanism        | poor-return-flow-v1-reasoning | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors    | poor-return-flow-v1-review    | Displayed teaching/debrief; absent during pending independent checks |
| protocol / policy                | poor-return-flow-v1-review    | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: poor-return-flow-v1-application: scenario. Explicit Finish is required.

Practice: C15, mc-low-return-after-checks.

Model limit: The monitor and the scenario frames are scripted in words for teaching. Nothing on this page models fluid or suction: it teaches the reasoning, and it cannot measure a seal, a suction pressure or a volume recovered. No value here is a volume, return or tolerance threshold for your patient.

## protected-accessories

| Objective | Preserved subtask                                                                                                                                                                                                                  | Evidence                         | New location                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M13-O1    | Loads the brush into the working channel in its sheath in the Simulator panel, and commits, in the transfer, the next move when a smeared lens hides forceps jaws reported closed before they are drawn into the channel.          | committed-explanation            | protected-accessories-flow-v1-transfer (protected-accessories-transfer)                                                                                                             |
| M13-O2    | Works a brush exchange against a scripted assistant in the Simulator panel and, as the assistant in a practice case, makes an ambiguous command specific before anything moves; the spoken exchange itself is observed by faculty. | observed-physical-skill-required | Practice: mc-role-swap; protected-accessories-flow-v1-application; Faculty model station still required; physical skill unmeasured                                                  |
| M13-O3    | Reads the forceps sequence, including the look at the site after the sample, and commits the forceps decision in the transfer; the handling itself is observed by faculty with an inert training accessory.                        | observed-physical-skill-required | protected-accessories-flow-v1-transfer (protected-accessories-transfer); protected-accessories-flow-v1-application; Faculty model station still required; physical skill unmeasured |
| M13-O4    | Commits, in the prediction, the state to confirm before a needle catheter is drawn back through the scope, and commits, in a practice case, that confirming it is basic handling rather than competence in needle aspiration.      | committed-explanation            | protected-accessories-flow-v1-check (Q08); Practice: mc-needle-rule-not-aspiration                                                                                                  |
| M13-O5    | In the Simulator panel, loads the brush sheathed, extends and exposes it beyond the tip, and draws it into the channel only after checking its sheathed state at the tip against a scripted assistant’s report.                    | simulated-navigation             | protected-accessories-flow-v1-application                                                                                                                                           |

| Source block / role                    | Final chunk                                    | Disclosure                                                           |
| -------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| one-channel / framing                  | protected-accessories-flow-v1-instrument-state | Displayed teaching/debrief; absent during pending independent checks |
| team-signals / signals                 | protected-accessories-flow-v1-instrument-state | Displayed teaching/debrief; absent during pending independent checks |
| where-it-sits / normal-reference       | protected-accessories-flow-v1-instrument-state | Displayed teaching/debrief; absent during pending independent checks |
| brush-exchange-worked / worked-example | protected-accessories-flow-v1-exchange         | Displayed teaching/debrief; absent during pending independent checks |
| forceps-short-supported / mechanism    | protected-accessories-flow-v1-exchange         | Displayed teaching/debrief; absent during pending independent checks |
| en-bloc / mechanism                    | protected-accessories-flow-v1-exchange         | Displayed teaching/debrief; absent during pending independent checks |
| needle-rule / mechanism                | protected-accessories-flow-v1-exchange         | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors          | protected-accessories-flow-v1-review           | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: protected-accessories-flow-v1-application: scope-task (load-sheathed, extend-and-expose, retrieve-protected). Explicit Finish is required.

Practice: mc-role-swap, mc-needle-rule-not-aspiration.

Model limit: The accessory’s state in this scene is drawn from the model, and the assistant’s words are scripted for teaching. The scene does not measure how far an accessory extends, force at the tip, tissue engagement, bleeding or specimen quality, and it has no device profile: channel size, working length and compatibility come from the device’s instructions.

## specimen-pathway

| Objective | Preserved subtask                                                                                                                                                                   | Evidence              | New location                                                                  |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------- |
| M14-O1    | Places nine statements from one biopsy plan and the room under question, site, method, study, container and destination, and flags the links still to clarify.                      | committed-explanation | specimen-pathway-flow-v1-application                                          |
| M14-O2    | Flags a label carried forward from the previous patient, and a requisition naming only the broad abnormality, as links to settle before collection.                                 | committed-explanation | specimen-pathway-flow-v1-application                                          |
| M14-O3    | Commits a next move when histology and a culture are planned and only formalin is in the room; weighs contamination from biopsy before a lavage in the transfer.                    | committed-explanation | specimen-pathway-flow-v1-check (Q10); specimen-pathway-flow-v1-transfer (Q24) |
| M14-O4    | Decides, in a practice case, what a cytology report negative for malignant cells establishes when the samples may not represent the target.                                         | case-decision         | Practice: mc-negative-is-not-benign                                           |
| M14-O5    | Commits a conclusion about a low-return lavage taken after biopsy with no susceptibility table, without switching thresholds or drawing an antibiotic choice from the missing data. | committed-explanation | specimen-pathway-flow-v1-transfer (Q24)                                       |

| Source block / role                         | Final chunk                              | Disclosure                                                           |
| ------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| a-sample-leaves-the-room / framing          | specimen-pathway-flow-v1-question-to-lab | Displayed teaching/debrief; absent during pending independent checks |
| what-travels / signals                      | specimen-pathway-flow-v1-question-to-lab | Displayed teaching/debrief; absent during pending independent checks |
| plan-from-the-question / normal-reference   | specimen-pathway-flow-v1-question-to-lab | Displayed teaching/debrief; absent during pending independent checks |
| container-before-sample / mechanism         | specimen-pathway-flow-v1-question-to-lab | Displayed teaching/debrief; absent during pending independent checks |
| identity-site-handling / mechanism          | specimen-pathway-flow-v1-identity        | Displayed teaching/debrief; absent during pending independent checks |
| what-a-result-can-say / mechanism           | specimen-pathway-flow-v1-identity        | Displayed teaching/debrief; absent during pending independent checks |
| quality-travels-with-the-result / mechanism | specimen-pathway-flow-v1-identity        | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors               | specimen-pathway-flow-v1-review          | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: specimen-pathway-flow-v1-application: sort. Explicit Finish is required.

Practice: mc-negative-is-not-benign.

Model limit: This section does not model a laboratory. Containers, minimum volumes, temperature and time to processing come from your laboratory’s specimen directory, and no result value, colony count or antibiotic choice appears here.

## deterioration

| Objective | Preserved subtask                                                                                                                                                                                                                                                                                                                     | Evidence              | New location                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| M15-O1    | Commits a first response when a sedated patient becomes restless with falling oximetry and a further sedative dose is offered; commits a next move as the designated monitoring clinician when the operator has not seen a change.                                                                                                    | committed-explanation | deterioration-flow-v1-check (N11); deterioration-flow-v1-transfer (deterioration-transfer) |
| M15-O3    | Chooses, frame by frame on one bronchoscopy list, the first response and escalation for a new wheeze, a low saturation after topical benzocaine and sudden chest pain with instability after biopsy; decides, in practice cases, what effort without airflow at the larynx and new pleuritic pain after an uneventful biopsy require. | committed-explanation | Practice: C08; Practice: mc-airflow-stops-at-the-cords                                     |
| M15-O4    | Chooses the next move once the event that interrupted an inspection has eased and the operator asks to carry on, and reads what has to be rechecked before any procedure resumes.                                                                                                                                                     | committed-explanation | deterioration-flow-v1-application                                                          |

| Source block / role                   | Final chunk                      | Disclosure                                                           |
| ------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| breathing-changes / framing           | deterioration-flow-v1-baseline   | Displayed teaching/debrief; absent during pending independent checks |
| what-can-change / signals             | deterioration-flow-v1-baseline   | Displayed teaching/debrief; absent during pending independent checks |
| inspection-to-plan / normal-reference | deterioration-flow-v1-baseline   | Displayed teaching/debrief; absent during pending independent checks |
| response-bundle / mechanism           | deterioration-flow-v1-priorities | Displayed teaching/debrief; absent during pending independent checks |
| causes-and-escalation / mechanism     | deterioration-flow-v1-priorities | Displayed teaching/debrief; absent during pending independent checks |
| before-resuming / mechanism           | deterioration-flow-v1-priorities | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors         | deterioration-flow-v1-review     | Displayed teaching/debrief; absent during pending independent checks |
| institution-supplies / policy         | deterioration-flow-v1-review     | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: deterioration-flow-v1-application: scenario. Explicit Finish is required.

Practice: C08, mc-airflow-stops-at-the-cords.

Model limit: The monitor and every frame in this section are scripted in words for teaching. They are not a physiological model: where a patient settles, it is because the scripted team treated the cause, not because of a choice on this card. No value here is a threshold, a dose or a rescue step for your patient; those come from your institution’s approved pathways.

## bleeding-priorities

| Objective | Preserved subtask                                                                                                                                                                                                                                                                                                                                               | Evidence              | New location                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| M15-O2    | Turns down an indiscriminate withdrawal or suction rule in the committed items — the recovery routine run on a wedged bleed, repeated suction to clear the view, waiting on a volume, and holding still for a red field from wall contact after a sample elsewhere — and, in practice, judges a bleed by the view and the patient rather than the suction trap. | committed-explanation | bleeding-priorities-flow-v1-check (Q27); bleeding-priorities-flow-v1-transfer (bleeding-priorities-transfer); Practice: mc-red-trap |
| M15-O5    | Commits the first move for a fresh biopsy bleed with the tip still wedged, then chooses, frame by frame, the priorities as the bleed changes — a wedge holding while a look at the other side is urged, blood reaching the carina and the right main bronchus, and a quieter field that is not source control — with help called from the start.                | committed-explanation | bleeding-priorities-flow-v1-check (Q27)                                                                                             |

| Source block / role                      | Final chunk                                         | Disclosure                                                           |
| ---------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------- |
| blood-after-a-sample / framing           | bleeding-priorities-flow-v1-baseline                | Displayed teaching/debrief; absent during pending independent checks |
| what-to-read / signals                   | bleeding-priorities-flow-v1-baseline                | Displayed teaching/debrief; absent during pending independent checks |
| expected-after-biopsy / normal-reference | bleeding-priorities-flow-v1-baseline                | Displayed teaching/debrief; absent during pending independent checks |
| what-the-scope-is-doing / mechanism      | bleeding-priorities-flow-v1-position-and-priorities | Displayed teaching/debrief; absent during pending independent checks |
| breathing-before-circulation / mechanism | bleeding-priorities-flow-v1-position-and-priorities | Displayed teaching/debrief; absent during pending independent checks |
| first-moves-worked / worked-example      | bleeding-priorities-flow-v1-position-and-priorities | Displayed teaching/debrief; absent during pending independent checks |
| suction-has-a-purpose / mechanism        | bleeding-priorities-flow-v1-position-and-priorities | Displayed teaching/debrief; absent during pending independent checks |
| temporary-control / mechanism            | bleeding-priorities-flow-v1-review                  | Displayed teaching/debrief; absent during pending independent checks |
| your-bleeding-response / policy          | bleeding-priorities-flow-v1-review                  | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors            | bleeding-priorities-flow-v1-review                  | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: bleeding-priorities-flow-v1-application: scenario. Explicit Finish is required.

Practice: mc-red-trap.

Model limit: The monitor and the airway view in this section are scripted in words for teaching. They are not a physiological or bleeding model, no amount or reading on these steps is a threshold for your patient, and the patients are constructed. A real bleed is managed by the supervising team under your institution’s bleeding response.

## scope-in-a-tube

| Objective | Preserved subtask                                                                                                                                                                                                                                                                | Evidence              | New location                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| M16-O1    | Commits, in the transfer, what should settle the choice between a larger-channel scope and a slimmer one that both go through the tube: the task’s suction needs weighed against the ventilation consequences of each external diameter, not fit alone.                          | committed-explanation | scope-in-a-tube-flow-v1-check (Q26); scope-in-a-tube-flow-v1-transfer (scope-in-a-tube-transfer) |
| M16-O2    | Decides, in a practice case, the next move after a paused loss of ventilation with the scope in the tube when raising the alarm limits is offered: reassess, then plan any return with the respiratory therapist, with the scope-in time and pause agreed and the alarms as set. | case-decision         | Practice: mc-alarm-limits                                                                        |
| M16-O6    | Commits how to read the geometric space left around a scope in a tube, then reads it for two teaching pairings in the tube scene; in the practice case keeps pneumothorax among the causes when ventilation falls with the scope in.                                             | committed-explanation | scope-in-a-tube-flow-v1-check (Q26); Practice: mc-alarm-limits                                   |

| Source block / role                    | Final chunk                      | Disclosure                                                           |
| -------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| one-tube / framing                     | scope-in-a-tube-flow-v1-geometry | Displayed teaching/debrief; absent during pending independent checks |
| what-the-team-can-read / signals       | scope-in-a-tube-flow-v1-geometry | Displayed teaching/debrief; absent during pending independent checks |
| steady-procedure / normal-reference    | scope-in-a-tube-flow-v1-geometry | Displayed teaching/debrief; absent during pending independent checks |
| space-worked / worked-example          | scope-in-a-tube-flow-v1-geometry | Displayed teaching/debrief; absent during pending independent checks |
| fitting-is-not-ventilating / mechanism | scope-in-a-tube-flow-v1-geometry | Displayed teaching/debrief; absent during pending independent checks |
| plan-before / policy                   | scope-in-a-tube-flow-v1-review   | Displayed teaching/debrief; absent during pending independent checks |
| when-ventilation-worsens / mechanism   | scope-in-a-tube-flow-v1-review   | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors          | scope-in-a-tube-flow-v1-review   | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: scope-in-a-tube-flow-v1-application: scope-task (advance-along-tube, beyond-the-tube, reach-carina); scope-in-a-tube-flow-v1-changed-tube: observe (advance-tighter-tube, beyond-tighter-tube). Explicit Finish is required.

Practice: mc-alarm-limits.

Model limit: The tube scene draws one tube and one scope as ideal circles, at teaching sizes from the course’s worked examples, not taken from any product’s instructions for use, and calculates its readouts from those two diameters. It is not a physiological model, and contact with the tube is counted, not felt.

## icu-physiology

| Objective | Preserved subtask                                                                                                                                                                                                                   | Evidence              | New location                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| M16-O3    | Sorts eight procedures by the compartment they sample and what shows the tool in the target, separating a needle seen on ultrasound from a sample taken under direct view, and a peripheral probe from a needle beside the airway.  | committed-explanation | Practice: mc-cryobiopsy-readiness                                                                            |
| M16-O4    | Decides, in one practice case, what happens to fluoroscopy while the team deliberates at a supervised lung biopsy, and in another, declines a cryobiopsy on the strength of forceps experience.                                     | case-decision         | Practice: mc-fluoroscopy-while-deciding; Practice: mc-cryobiopsy-readiness                                   |
| M16-O5    | Commits to what ends a conventional mandatory pressure-control breath, predicts which reading can move once a scope enters a different patient’s tracheostomy tube, and weighs that breath within a broad differential in practice. | committed-explanation | icu-physiology-flow-v1-check (Q25); icu-physiology-flow-v1-transfer (icu-physiology-transfer); Practice: C17 |

| Source block / role                   | Final chunk                              | Disclosure                                                           |
| ------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| inside-the-breath / framing           | icu-physiology-flow-v1-baseline          | Displayed teaching/debrief; absent during pending independent checks |
| ventilator-signals / signals          | icu-physiology-flow-v1-baseline          | Displayed teaching/debrief; absent during pending independent checks |
| breath-at-baseline / normal-reference | icu-physiology-flow-v1-baseline          | Displayed teaching/debrief; absent during pending independent checks |
| what-ends-the-breath / mechanism      | icu-physiology-flow-v1-baseline          | Displayed teaching/debrief; absent during pending independent checks |
| compartment-and-guidance / mechanism  | icu-physiology-flow-v1-procedure-purpose | Displayed teaching/debrief; absent during pending independent checks |
| own-training / boundary               | icu-physiology-flow-v1-procedure-purpose | Displayed teaching/debrief; absent during pending independent checks |
| fluoroscopy-principles / policy       | icu-physiology-flow-v1-review            | Displayed teaching/debrief; absent during pending independent checks |
| radiation-and-staff / policy          | icu-physiology-flow-v1-review            | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors         | icu-physiology-flow-v1-review            | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: icu-physiology-flow-v1-application: sort. Explicit Finish is required.

Practice: C17, mc-fluoroscopy-while-deciding, mc-cryobiopsy-readiness.

Model limit: The monitor and the ventilator readings in this section are scripted in words for teaching. No waveform, value or ventilator setting is modelled, and the lecture’s original waveforms were not available. What a particular ventilator’s alarms and protective actions do comes from its instructions and the respiratory therapist. The procedure sort names what each procedure samples and how its target is verified; it teaches none of their technique.

## honest-report

| Objective | Preserved subtask                                                                                                                                                                                                                                 | Evidence              | New location                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| M17-O1    | Chooses, in the report for a procedure under moderate sedation, the limitations, specimens, recovery plan and results owner the end-of-procedure handoff carries; the spoken handoff itself is observed in supervised practice.                   | committed-explanation | honest-report-flow-v1-application; honest-report-flow-v1-your-record                                 |
| M17-O2    | Commits which record, if any, may fill the vocal-fold line after a bronchoscopy through an endotracheal tube, then completes the larynx, right-sided airways, extent and sampling lines from the record of a procedure entered through the mouth. | committed-explanation | honest-report-flow-v1-check (Q11); honest-report-flow-v1-transfer (N10); Practice: mc-curtailed-note |
| M17-O3    | Chooses a recovery line that follows the institution’s recovery criteria and approved pathway, and refuses discharge by elapsed time or by one oximetry reading.                                                                                  | committed-explanation | honest-report-flow-v1-application; honest-report-flow-v1-your-record                                 |
| M17-O4    | Chooses a pending-results line that names who reviews the lavage results and how the patient hears them, and refuses “results to follow”.                                                                                                         | committed-explanation | honest-report-flow-v1-application; honest-report-flow-v1-your-record                                 |
| M17-O5    | Decides, in a practice case, how a note records a completed therapeutic aspiration and a survey stopped when oximetry fell, and commits in the transfer how the report records an event that resolved.                                            | case-decision         | honest-report-flow-v1-transfer (N10); Practice: mc-curtailed-note                                    |

| Source block / role                     | Final chunk                         | Disclosure                                                           |
| --------------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| what-a-report-is-for / framing          | honest-report-flow-v1-record        | Displayed teaching/debrief; absent during pending independent checks |
| what-the-report-rests-on / signals      | honest-report-flow-v1-record        | Displayed teaching/debrief; absent during pending independent checks |
| uncomplicated-report / normal-reference | honest-report-flow-v1-record        | Displayed teaching/debrief; absent during pending independent checks |
| four-states / mechanism                 | honest-report-flow-v1-record        | Displayed teaching/debrief; absent during pending independent checks |
| template-line-by-line / worked-example  | honest-report-flow-v1-worked-report | Displayed teaching/debrief; absent during pending independent checks |
| ending-and-handoff / mechanism          | honest-report-flow-v1-handoff       | Displayed teaching/debrief; absent during pending independent checks |
| recovery-and-results / policy           | honest-report-flow-v1-handoff       | Displayed teaching/debrief; absent during pending independent checks |
| describe-what-was-done / mechanism      | honest-report-flow-v1-worked-report | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors           | honest-report-flow-v1-review        | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: honest-report-flow-v1-application: report; honest-report-flow-v1-your-record: report. Explicit Finish is required.

Practice: mc-curtailed-note.

Model limit: The report on this card is built for teaching from one constructed procedure. It is not an institutional template, and the course stores no patient information. Recovery criteria, oral intake after topical anesthetic, activity, escort, medication resumption and the results pathway belong to your institution’s approved policies, none of which is configured here; reimbursement rules are outside this course.

## what-completion-means

| Objective | Preserved subtask                                                                                                                                                                                    | Evidence                         | New location                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| M18-O1    | Sorts an observation of the hands and a supervised patient task apart from simulator events; the integrated, faculty-observed simulation itself happens outside this course.                         | observed-physical-skill-required | what-completion-means-flow-v1-application; Faculty model station still required; physical skill unmeasured |
| M18-O2    | Commits how far an observed, unprompted inspection on a bench model carries into an inspection through an endotracheal tube in a ventilated patient, with a rotated image.                           | committed-explanation            | what-completion-means-flow-v1-transfer (what-completion-means-transfer)                                    |
| M18-O3    | Follows a worked example that turns an observer’s correction and a self-rating into one specific next-practice objective, which the learner keeps in their own training record, outside this course. | not-app-assessable               | what-completion-means-flow-v1-application                                                                  |
| M18-O4    | Commits what a file of finished sections, committed answers, an unassisted simulator log and a high self-rating can support, then sorts evidence statements into the record each belongs to.         | committed-explanation            | what-completion-means-flow-v1-check (N12)                                                                  |
| M18-O5    | Explains, in the transfer, which part of a familiar skill’s evidence stops carrying when the device, the image orientation and the patient change.                                                   | committed-explanation            | what-completion-means-flow-v1-transfer (what-completion-means-transfer)                                    |

| Source block / role                | Final chunk                                   | Disclosure                                                           |
| ---------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| records-in-a-file / framing        | what-completion-means-flow-v1-evidence        | Displayed teaching/debrief; absent during pending independent checks |
| this-fellows-file / signals        | what-completion-means-flow-v1-evidence        | Displayed teaching/debrief; absent during pending independent checks |
| four-records / normal-reference    | what-completion-means-flow-v1-evidence        | Displayed teaching/debrief; absent during pending independent checks |
| manual-tools / mechanism           | what-completion-means-flow-v1-supervised-next | Displayed teaching/debrief; absent during pending independent checks |
| what-evidence-shows / mechanism    | what-completion-means-flow-v1-supervised-next | Displayed teaching/debrief; absent during pending independent checks |
| where-this-course-sits / mechanism | what-completion-means-flow-v1-evidence        | Displayed teaching/debrief; absent during pending independent checks |
| common-errors / common-errors      | what-completion-means-flow-v1-review          | Displayed teaching/debrief; absent during pending independent checks |
| next-objective / worked-example    | what-completion-means-flow-v1-supervised-next | Displayed teaching/debrief; absent during pending independent checks |

Activity evidence: what-completion-means-flow-v1-application: sort. Explicit Finish is required.

Practice: none.

Model limit: The fellow, the file and the sessions in this section are constructed for teaching. The airway map shows the one anatomy profile of the course’s teaching model, which has no patient, no tube and no ventilator.
