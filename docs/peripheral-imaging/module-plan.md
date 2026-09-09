# Peripheral bronchoscopy imaging — curriculum and model contract

Authoring date: 2026-09-08. Replaces the learner-facing FluoroView route at /fluoroview.

## Scope and instructional design

Learners: pulmonary and IP fellows with basic CT anatomy and bronchoscopy knowledge; technologists and suite staff can use the same fundamentals. Desktop or tablet for labs, phone for review; short resumable units. Intended level: Miller knows how (Bloom apply/analyze), not procedural competence. Supervised C-arm operation, anesthesia, radiation credentialing and biopsy training remain necessary.

Need: the former front door was a large simulator with four objectives and no ordered curriculum, retrieval schedule or completion contract. No relevant learner analytics were found. The redesign uses the medical-education-modules skill (Kern, Gagné, cognitive load, worked-to-independent practice) and the repository education skill. Content types: device physics, procedural timeline and systematic image interpretation.

Spine: plan current anatomy → acquire the missing information → verify lesion and actual sampling component → reassess after change → record exposure and outcome. One lesson registry supplies pathway, titles, counts, minutes and next-incomplete navigation.

Objectives and alignment:

| ID       | Discrimination (apply/analyze; knows how)                                            | Lessons                                             | Checks                                        |
| -------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------- |
| choose   | Select imaging for the question and distinguish navigation, lesion and tool evidence | imaging-questions, current-anatomy, two-dimensional | choose-1, anatomy-1, workflow-1; case-1       |
| optimize | Distinguish projection, contrast, field, sampling and temporal problems              | projection, signal, field, time                     | geometry-1, signal-1, field-1, time-1; case-2 |
| dts      | Interpret limited-angle measurements and prior-informed reconstruction               | dts-acquisition, dts-interpretation                 | dts-1, prior-1; case-3                        |
| cbct     | Plan an acquisition and distinguish fixed/mobile workflow constraints                | cbct-acquisition, fixed-suite, mobile-suite         | acquisition-1, fixed-1, mobile-1; case-4      |
| verify   | Assess the actual sampling component and the validity of its acquisition state       | tool-confirmation, changing-anatomy                 | tool-1, change-1; case-5, case-6              |
| protect  | Select staff protection and interpret patient dose indices                           | staff-protection, dose-reporting                    | safety-1, dose-1; case-7, case-8              |

Every lesson has one primary concept, an explicit prerequisite list, recall, cited teaching blocks, a worked example, a committed check with option-specific feedback, takeaways and a named next destination. The data file carries the individual lesson specs: outcome, concept, prerequisites, clinical question (why), worked reasoning, model activity, checks and source provenance. Check records carry the wrong mental models as option rationales and a harmful-reflex flag for safety-critical cases. All stems are authored teaching scenarios. Checks occupy a separate screen: no teaching, takeaways or interpreted image findings beside a pending item.

## Stage ladder and retrieval

| Stage       | Lessons in canonical order          | Single increment / scaffold                                         | Minutes |
| ----------- | ----------------------------------- | ------------------------------------------------------------------- | ------- |
| Orientation | imaging-questions                   | Information question / worked                                       | 4       |
| Foundation  | current-anatomy, projection         | Map timestamp; projection depth / worked + lab                      | 5, 6    |
| Mechanism   | signal, field, time                 | Signal budget; acquired field; measured time / worked + lab         | 5, 6, 6 |
| Application | two-dimensional                     | Integrates prior 2D concepts / guided                               | 5       |
| Mechanism   | dts-acquisition, dts-interpretation | Limited angles; reconstruction provenance / worked + lab            | 6, 5    |
| Mechanism   | cbct-acquisition                    | Volume acquisition / guided lab                                     | 6       |
| Application | fixed-suite, mobile-suite           | Suite-specific application of acquisition requirements / completion | 4, 4    |
| Application | tool-confirmation, changing-anatomy | Sampling window; validity after change / guided → independent       | 7, 6    |
| Mechanism   | staff-protection, dose-reporting    | Scatter protection; dose quantities / worked + lab                  | 5, 6    |
| Practice    | suite-cases                         | Interleaves existing concepts, no new mechanisms / independent      | 12      |

Each unit after the first includes explicit retrieval of an earlier concept in its recall prompt and a second check drawn from an earlier lesson. Repeated items have separate lesson-scoped attempt keys; a correct prior response cannot silently complete a later unit. The capstone uses eight different surface situations and retains first decisions. Review is always available; no unsupported test-out or competence label. Deviations: no placement pretest (narrow fellow audience; free browsing supports experienced users); stage order returns to mechanism when a new modality is introduced, explicitly named in navigation. Multi-control lessons field/time use one common concept with deeper physics in optional disclosure. Authored estimates require learner piloting.

Completion (amended 2026-09-08, stage rebuild): a section is worked through when its last step is finished on the lesson stage; the first decision on each item is written once, as made, and is never rewritten. Commitments, lab values and the step reached are never persisted mid-section — a reload restarts the section at its first step while the record keeps the first attempts (the rule the critical-care modules share). No mastery claim. The capstone (Assess) standard is at least seven of eight decisions held AND every safety-critical decision held; it opens only once every section is worked through, and its verdicts open together after the last decision. Practice cases sit outside completion entirely: a learner may answer one as often as they like, and
only the first decision is recorded, so nothing there gates or marks anything. Changing controls
alone never completes a section. The record lives in local storage under one versioned key; a legacy record is migrated once. Required progress is never attributed to hands-on competence.

## One decision aid

The imaging decision guide is defined once in data/resources.ts and reused as a reference. Decision panel: geometry, acquisition field, temporal sampling, information source, reassessment. The guide links to relevant lesson ids.

## Models and numbers

The visual revision reuses the original FluoroView teaching CT, segmented airway tree, volume DRR renderer and C-arm animation. 3D Slicer generated layered lung, bone and body surfaces, a quantized browser CT atlas and limited-angle projections. The former schematic thorax and support downloads are retired. The sampling-window model, staff/barrier geometry, target, instrument, cases and numerical control ranges remain authored for teaching. Source provenance, processing, asset budgets, regeneration commands and interpretation limits are documented in [slicer-assets.md](slicer-assets.md). No new runtime dependency is introduced.

Coordinate convention: model x = patient left, y = anterior, z = superior. The projection lab uses the same cone detector frame as the original FluoroView CT renderer; the numeric result and target/tool overlays share that frame. The gantry is a separately labeled, single-axis motion reference. DTS refocuses 13 CT-derived parallel projections with background suppression and shift-and-add; it is not a vendor reconstruction. MPR uses analytic sphere/needle sections over CT context; the analytic geometry remains the source of the sampling feedback. Acquisition is a CT-derived centering and checklist exercise, not a collision detector. All lab angles and tolerances are authored rather than recommended acquisition settings. Named camera buttons, layer toggles, images and text explanations support inspection without a mandatory drag gesture.

Dose lab computes KAP = kerma × area with authored inputs and explicit units, not skin dose. Temporal lab computes mAs/s and ideal motion displacement at fixed energy/geometry; never labels this patient dose. Inverse-square illustration holds output fixed and treats scatter as a point source; no physical shield attenuation or safe-distance prediction. Numeric clinical recommendations are deferred to current IFU/local protocol. No universal apnea duration, pressure/PEEP target, occupational limit table or scan-count ceiling is taught. No measured instrument safety margin is inferred from the 3D models.

## Evidence and review

The user's Peripheral_Bronchoscopy_Imaging_Knowledge_Document_v2.md is a synthesis used as source material, not operational instructions. Clinical claims are mapped to published papers, professional reports and guidelines in sources.ts. No video, transcript or manufacturer marketing references appear in the learner module. Exact study yields are not used as a device ranking. Current abstracts and accessible full text are checked where available; limitations are visible per source. All rewritten clinical prose is independently authored from the supplied synthesis and cited published materials. Reference metadata checked 2026-09-08.

Verification: pure projection/analytic geometry, pulse-output/dose-unit arithmetic, prerequisite closure, source ids and progress validation; UI commit boundary, immutable attempts, critical-error pass block and reload/resume; responsive browser inspection and keyboard/accessibility checks; repo lint, type check, test and build. Review rubric and cueing audit run as separate passes. No deployment or clinical validation claimed.

Evaluation after release: pilot with 3–5 fellows and a technologist using start, resume, change controls, finish, and locate-term tasks. Collect consented time estimates, first-attempt errors and drop-off using the site's future analytics policy; no new tracking is introduced. Review retention with mixed cases at a later teaching session. This is a post-release proposal, not a claim that a pilot occurred.
